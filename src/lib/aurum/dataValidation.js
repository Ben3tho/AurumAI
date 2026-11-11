// Data integrity validation — real checks on parsed candles.
// Classifies every timestamp gap instead of treating all gaps as corruption:
//   MARKET_CLOSED (weekend/holiday), DATA_MISSING (intraday gap during hours),
//   DUPLICATE, INVALID_OHLC, OUT_OF_ORDER.
// Only DATA_MISSING gaps inside the recent lookback window block the signal.
import { TIMEFRAME_MS } from "./multiTimeframe";

const LOOKBACK_WINDOW = 200; // bars considered "critical" for the calculation window

export function validateData(candles, expectedIntervalMs = TIMEFRAME_MS.M15) {
  const report = {
    totalCandles: candles.length,
    missingCandles: 0,
    duplicateCandles: 0,
    ohlcAnomalies: 0,
    volumeAnomalies: 0,
    outOfOrder: 0,
    timezoneConsistent: true,
    dateRange: { start: null, end: null },
    intervalMs: expectedIntervalMs,
    gapBreakdown: { marketClosed: 0, dataMissing: 0, outOfOrder: 0 },
    criticalMissingBars: 0,
    issues: []
  };

  if (!candles.length) {
    report.issues.push("No candles parsed.");
    return report;
  }

  report.dateRange.start = new Date(candles[0].time).toISOString();
  report.dateRange.end = new Date(candles[candles.length - 1].time).toISOString();

  const seen = new Set();
  let prevTime = null;
  let intervalCounts = {};
  // Track gaps within the recent window for the "critical" count.
  const windowStart = candles.length > LOOKBACK_WINDOW ? candles[candles.length - LOOKBACK_WINDOW].time : candles[0].time;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // Duplicates
    if (seen.has(c.time)) {
      report.duplicateCandles++;
    } else {
      seen.add(c.time);
    }

    // OHLC anomalies (INVALID_OHLC)
    if (c.high < c.low) report.ohlcAnomalies++;
    if (c.open < c.low || c.open > c.high) report.ohlcAnomalies++;
    if (c.close < c.low || c.close > c.high) report.ohlcAnomalies++;

    // Gaps / ordering
    if (prevTime != null) {
      const diff = c.time - prevTime;
      if (diff < 0) {
        // OUT_OF_ORDER timestamp — not a missing bar, just flagged
        report.outOfOrder++;
        report.gapBreakdown.outOfOrder++;
      } else if (diff > 0) {
        intervalCounts[diff] = (intervalCounts[diff] || 0) + 1;
        if (diff > expectedIntervalMs) {
          const prevDate = new Date(prevTime);
          const curDate = new Date(c.time);
          const prevDay = prevDate.getUTCDay();
          const curDay = curDate.getUTCDay();
          // MARKET_CLOSED / EXPECTED GAP — forex weekend (Fri late -> Sun early)
          const isWeekendGap =
            prevDay === 6 || curDay === 6 ||
            (prevDay === 5 && prevDate.getUTCHours() >= 20) ||
            (curDay === 0 && curDate.getUTCHours() < 22);
          // Any gap > 2 days = holiday / market closure (EXPECTED)
          const isClosureGap = diff > 2 * 24 * 60 * 60 * 1000;
          if (isWeekendGap || isClosureGap) {
            report.gapBreakdown.marketClosed++;
          } else {
            // DATA_MISSING — intraday gap during market hours
            const missing = Math.round(diff / expectedIntervalMs) - 1;
            if (missing > 0) {
              report.missingCandles += missing;
              report.gapBreakdown.dataMissing += missing;
              if (c.time >= windowStart) report.criticalMissingBars += missing;
            }
          }
        }
      }
    }
    prevTime = c.time;
  }

  // Timezone / interval consistency: dominant interval should match expected
  const sortedIntervals = Object.entries(intervalCounts).sort((a, b) => b[1] - a[1]);
  if (sortedIntervals.length) {
    const dominant = Number(sortedIntervals[0][0]);
    if (dominant !== expectedIntervalMs) {
      report.timezoneConsistent = false;
      report.issues.push(
        `Dominant interval is ${dominant / 60000} min, expected ${expectedIntervalMs / 60000} min.`
      );
    }
  }

  // Volume anomalies via z-score on non-zero volumes
  const vols = candles.map((c) => c.volume).filter((v) => v > 0);
  if (vols.length > 10) {
    const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
    const variance = vols.reduce((a, b) => a + (b - mean) ** 2, 0) / vols.length;
    const std = Math.sqrt(variance);
    if (std > 0) {
      for (const v of vols) {
        if (Math.abs((v - mean) / std) > 6) report.volumeAnomalies++;
      }
    }
  }

  if (report.ohlcAnomalies > 0) report.issues.push(`${report.ohlcAnomalies} INVALID_OHLC candle(s).`);
  if (report.duplicateCandles > 0) report.issues.push(`${report.duplicateCandles} DUPLICATE timestamp(s).`);
  if (report.outOfOrder > 0) report.issues.push(`${report.outOfOrder} OUT_OF_ORDER timestamp(s).`);
  if (report.missingCandles > 0) report.issues.push(`${report.missingCandles} DATA_MISSING bar(s) (${report.criticalMissingBars} in critical window).`);
  if (report.gapBreakdown.marketClosed > 0) report.issues.push(`${report.gapBreakdown.marketClosed} MARKET_CLOSED/EXPECTED gap(s) ignored.`);

  return report;
}

// v3.2 — single source of truth for "is the data clean enough to run SMC + signal
// calculations?". True only when there are no missing bars in the critical
// lookback window and no INVALID_OHLC anomalies. Used by the Final Signal Gate
// to force BLOCKED / DATA RE-SYNC REQUIRED and suppress SMC detection.
export function isDataClean(validation) {
  if (!validation) return false;
  const criticalMissing = validation.criticalMissingBars ?? validation.missingCandles ?? 0;
  const ohlc = validation.ohlcAnomalies ?? 0;
  return criticalMissing === 0 && ohlc === 0;
}