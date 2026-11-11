// Orchestrator — runs the full validation + backtest pipeline on parsed candles.
import { validateData } from "./dataValidation";
import { buildAllTimeframes, detectSourceTimeframe, TIMEFRAME_MS, TF_ORDER } from "./multiTimeframe";
import { emaSeries } from "./indicators";
import { detectStructure, premiumDiscount } from "./smc";
import { generateSignals } from "./signalEngine";
import { runBacktest } from "./backtest";
import {
  computeStatistics,
  sessionBreakdown,
  directionBreakdown,
  scoreBreakdown,
  monteCarlo,
  walkForwardSplit,
  classify
} from "./statistics";
import { computeMTFConfidence } from "./mtfConfidenceEngine";

// Timeframes at or above daily — a single bar spans all trading sessions,
// so the intraday session gate is meaningless and must be bypassed.
const HIGHER_TF = new Set(["D1", "W1", "MN"]);

export function runFullPipeline(candles, config = {}) {
  // TASK 1: Detect source timeframe + validate at the correct interval
  const sourceTimeframe = detectSourceTimeframe(candles);
  const expectedInterval = TIMEFRAME_MS[sourceTimeframe] || TIMEFRAME_MS.M15;
  const validation = validateData(candles, expectedInterval);

  // TASK 2: Multi-timeframe (aggregate coarser TFs from source)
  const { timeframes, sourceTimeframe: srcTf } = buildAllTimeframes(candles);
  const sourceTf = srcTf && srcTf !== "UNKNOWN" ? srcTf : sourceTimeframe;

  // MTF trend bias per available timeframe (coarsest -> finest available)
  const mtfBias = {};
  const mtfOrder = [];
  // V2.4 — never display N/A if higher timeframe data exists. Compute bias with
  // whatever EMAs are available; only "N/A" when a TF is genuinely null (finer
  // than source and cannot be aggregated). "BUILDING" when < 30 bars.
  for (const tf of TF_ORDER) {
    const tfc = timeframes[tf];
    if (!tfc) { mtfBias[tf] = "N/A"; continue; }
    if (tfc.length < 30) { mtfBias[tf] = "BUILDING"; continue; }
    const e20 = emaSeries(tfc, 20);
    const e50 = emaSeries(tfc, 50);
    const last = tfc.length - 1;
    if (Number.isNaN(e20[last]) || Number.isNaN(e50[last])) { mtfBias[tf] = "N/A"; continue; }
    let bias;
    if (tfc.length >= 200) {
      const e200 = emaSeries(tfc, 200);
      if (Number.isNaN(e200[last])) { mtfBias[tf] = "N/A"; continue; }
      bias = e20[last] > e50[last] && e50[last] > e200[last] ? "BULLISH"
        : e20[last] < e50[last] && e50[last] < e200[last] ? "BEARISH"
        : "MIXED";
    } else {
      bias = e20[last] > e50[last] ? "BULLISH" : e20[last] < e50[last] ? "BEARISH" : "MIXED";
    }
    mtfBias[tf] = bias;
    mtfOrder.push(tf);
  }

  // TASK 3 + 4: Signals + backtest (bypass intraday session gate for D1+ source)
  const skipSession = HIGHER_TF.has(sourceTf) || sourceTf === "UNKNOWN";
  // Coarser timeframes (H1+) spread SMC events across fewer bars, so the confluence
  // cutoff is lowered to 60 — equivalent selectivity to 70 on dense M5/M15 data.
  const COARSE_TF = new Set(["H1", "H4", "D1", "W1", "MN", "UNKNOWN"]);
  const minScore = COARSE_TF.has(sourceTf) ? 60 : 70;
  const signals = generateSignals(candles, { skipSession, minScore });
  const backtest = runBacktest(candles, signals, config.backtest || {});
  const { trades, equityCurve } = backtest;

  // TASK 5: Statistics
  const stats = computeStatistics(trades, equityCurve, config.backtest?.accountSize || 10000);

  // TASK 6: Breakdowns
  const byDirection = directionBreakdown(trades);
  const bySession = sessionBreakdown(trades);
  const byScore = scoreBreakdown(trades);

  // TASK 7: Walk-forward
  const wf = walkForwardSplit(trades);
  const walkForward = {
    train: computeStatistics(wf.train, null, 10000),
    validation: computeStatistics(wf.validation, null, 10000),
    outOfSample: computeStatistics(wf.outOfSample, null, 10000),
    counts: { train: wf.train.length, validation: wf.validation.length, outOfSample: wf.outOfSample.length }
  };

  // TASK 8: Monte Carlo
  const mc = monteCarlo(trades, 1000, config.backtest?.accountSize || 10000);

  // TASK 9 (v2.0): Multi-timeframe confidence score (D1→M5 hierarchy + 6 factors)
  const mtfConfidence = computeMTFConfidence(timeframes, sourceTf);

  // Classification
  const classification = classify(stats, mc, candles.length);

  // Latest signal (for dashboard live card)
  const latestSignal = signals.length ? signals[signals.length - 1] : null;
  const lastCandle = candles[candles.length - 1];
  const pd = premiumDiscount(candles, 50);
  const { finalTrend } = detectStructure(candles);

  // V2.3 — Dataset info + backtest status + zero-trade reason.
  const datasetInfo = {
    startDate: candles.length ? new Date(candles[0].time).toISOString() : null,
    endDate: candles.length ? new Date(candles[candles.length - 1].time).toISOString() : null,
    candlesLoaded: candles.length,
    candlesUsed: candles.length,
    sourceTimeframe: sourceTf
  };
  let zeroTradeReason = null;
  if (trades.length === 0) {
    if (candles.length < 200) zeroTradeReason = "Dataset loading failed - too few candles to build signals";
    else if (signals.length === 0) zeroTradeReason = "No qualifying setups - strategy filters too strict (no signal reached the confluence threshold)";
    else zeroTradeReason = "No qualifying setups - min RR or position-size filters rejected all signals";
  }
  const backtestStatus = candles.length < 50 ? "FAILED" : "COMPLETED";

  return {
    validation,
    timeframes,
    mtfBias,
    mtfOrder,
    sourceTimeframe: sourceTf,
    signals,
    trades,
    equityCurve,
    stats,
    byDirection,
    bySession,
    byScore,
    walkForward,
    monteCarlo: mc,
    classification,
    latestSignal,
    lastCandle,
    premiumDiscount: pd,
    finalTrend,
    mtfConfidence,
    datasetInfo,
    backtestStatus,
    zeroTradeReason,
    signalCount: signals.length,
    config
  };
}