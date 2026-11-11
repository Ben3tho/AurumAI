// AURUM AI v3.2 — Sniper Entry AI.
// Rules:
//   1. Entry only after D1, H4, H1, M15 confluence (all aligned same direction).
//   2. M5 provides the final execution candle (liquidity sweep + unmitigated FVG).
//      If M5 has no strict trigger but H1+M15 are confirmed, fall back to the M15
//      POI zone so the engine still outputs an execution reference (grade B).
//   3. Confidence (Confluence Score) must be 85+ for A+ trades.
//   4. v3.2 execution distance gate: only eligible when price is INSIDE the POI
//      entry zone. When price is far from the zone (>$38 or outside bounds), the
//      setup is withheld — no orders are computed until price retraces in.
// Entry references the M5 execution candle close (stable per M5 update), NOT the
// tick live price, so heavy SMC detection only re-runs when M5/M15 data changes.

import { emaSeries, atr } from "./indicators";
import { detectFVG, detectLiquiditySweeps } from "./smc";
import { computeRR } from "./riskManager";
import { round2, priceInZone } from "./format";

const M5_MS = 5 * 60 * 1000;
const M5_WINDOW = 600; // recent M5 candles for trigger detection
const M15_WINDOW = 400;
const MAX_EXEC_DISTANCE_USD = 38;

function emaStackTf(candles) {
  if (!candles || candles.length < 50) return "mixed";
  const e20 = emaSeries(candles, 20);
  const e50 = emaSeries(candles, 50);
  const i = candles.length - 1;
  if (Number.isNaN(e20[i]) || Number.isNaN(e50[i])) return "mixed";
  if (candles.length >= 200) {
    const e200 = emaSeries(candles, 200);
    if (!Number.isNaN(e200[i])) {
      if (e20[i] > e50[i] && e50[i] > e200[i]) return "bullish";
      if (e20[i] < e50[i] && e50[i] < e200[i]) return "bearish";
      return "mixed";
    }
  }
  return e20[i] > e50[i] ? "bullish" : e20[i] < e50[i] ? "bearish" : "mixed";
}

export function computeSniperSignal({ mtfConfidence, m15Candles, m5Candles, newsBlock, livePrice, entryZone }) {
  const direction = mtfConfidence?.direction || null;
  const score = mtfConfidence?.score || 0;
  const per = mtfConfidence?.perTimeframe || {};
  const reasons = [];

  if (!direction) {
    return { eligible: false, grade: null, direction: null, reasons: ["No macro direction from D1/H4/H1"], candleIntervalMs: M5_MS };
  }
  if (newsBlock) reasons.push("High-impact USD news within +/-30 min — entries blocked");

  const dirWord = direction === "bull" ? "bullish" : "bearish";
  const d1 = per.D1?.status?.toLowerCase() || "n/a";
  const h4 = per.H4?.status?.toLowerCase() || "n/a";
  const h1 = per.H1?.status?.toLowerCase() || "n/a";
  const alignedCount = [d1, h4, h1].filter((s) => s === dirWord).length;

  // M15 execution-timeframe trend.
  let m15 = "mixed";
  if (m15Candles && m15Candles.length >= 50) m15 = emaStackTf(m15Candles.slice(-M15_WINDOW));
  else if (per.M15?.available) m15 = dirWord;
  const m15Aligned = m15 === dirWord;
  const htAligned = alignedCount === 3;

  if (!htAligned) reasons.push(`Higher TF not fully aligned (D1=${d1},H4=${h4},H1=${h1})`);
  if (!m15Aligned) reasons.push(`M15 trend not aligned (${m15})`);

  // M5 execution trigger (bounded to recent window).
  let m5Trigger = null;
  let entry = null, sl = null, tp1 = null, tp2 = null, tp3 = null;
  let triggerSource = "M5";

  const m5Ready = !!(m5Candles && m5Candles.length >= 30);
  if (m5Ready) {
    const win = m5Candles.slice(-M5_WINDOW);
    const fvgs = detectFVG(win);
    const sweeps = detectLiquiditySweeps(win);
    const wantSweep = direction === "bull" ? "sell-side" : "buy-side";
    const recentSweep = sweeps.slice(-8).reverse().find((s) => s.type === wantSweep);
    const recentFvg = [...fvgs].reverse().find((f) => f.type === dirWord && !f.mitigated);
    if (recentSweep && recentFvg) {
      m5Trigger = { sweep: recentSweep, fvg: recentFvg };
      const a = atr(win, 14);
      const atrVal = a[a.length - 1] || (win[win.length - 1].high - win[win.length - 1].low);
      const last = m5Candles[m5Candles.length - 1];
      entry = last.close;
      if (direction === "bull") {
        sl = Math.min(...m5Candles.slice(-6).map((c) => c.low)) - atrVal * 0.3;
        const risk = entry - sl;
        tp1 = entry + risk * 3; tp2 = entry + risk * 5; tp3 = entry + risk * 8;
      } else {
        sl = Math.max(...m5Candles.slice(-6).map((c) => c.high)) + atrVal * 0.3;
        const risk = sl - entry;
        tp1 = entry - risk * 3; tp2 = entry - risk * 5; tp3 = entry - risk * 8;
      }
    } else {
      if (!recentSweep) reasons.push("No recent M5 liquidity sweep (correct side)");
      if (!recentFvg) reasons.push("No unmitigated M5 FVG (aligned)");
    }
  } else {
    reasons.push("M5 data unavailable (needs M5 source/backfill)");
  }

  // v3.2 — Fallback trigger: if H1+M15 are confirmed but no strict M5 trigger fired,
  // use the M15 POI entry zone as the execution reference so the engine still
  // outputs a trigger (grade capped at B, never A+ without the M5 confirmation).
  if (!m5Trigger && htAligned && m15Aligned && entryZone) {
    triggerSource = "M15_FALLBACK";
    const mid = (entryZone.top + entryZone.bottom) / 2;
    entry = direction === "bull" ? entryZone.bottom : entryZone.top;
    const a = m15Candles ? atr(m15Candles, 14) : null;
    const atrVal = (a && a[a.length - 1]) || (entryZone.top - entryZone.bottom);
    if (direction === "bull") {
      sl = entryZone.bottom - atrVal * 0.3;
      const risk = entry - sl;
      tp1 = entry + risk * 3; tp2 = entry + risk * 5; tp3 = entry + risk * 8;
    } else {
      sl = entryZone.top + atrVal * 0.3;
      const risk = sl - entry;
      tp1 = entry - risk * 3; tp2 = entry - risk * 5; tp3 = entry - risk * 8;
    }
    m5Trigger = {
      sweep: { type: direction === "bull" ? "sell-side" : "buy-side", price: direction === "bull" ? entryZone.bottom : entryZone.top },
      fvg: { type: dirWord, top: entryZone.top, bottom: entryZone.bottom }
    };
    reasons.push("M5 strict trigger pending — using M15 POI zone as execution reference");
  }

  const confluence = { D1: d1, H4: h4, H1: h1, M15: m15, aligned: htAligned && m15Aligned };
  const allAligned = htAligned && m15Aligned;

  // v3.2 — Execution distance gate: only eligible when price is inside the POI zone.
  // When price is outside the zone (or >$38 from it), withhold execution.
  let zoneGateOk = true;
  let zoneGateReason = null;
  if (entryZone && livePrice != null) {
    const mid = (entryZone.top + entryZone.bottom) / 2;
    const distance = Math.abs(livePrice - mid);
    const inZone = priceInZone(livePrice, entryZone);
    if (!inZone) {
      zoneGateOk = false;
      zoneGateReason = distance > MAX_EXEC_DISTANCE_USD
        ? `Price $${distance.toFixed(1)} from zone (> $${MAX_EXEC_DISTANCE_USD}) — waiting for retest`
        : `Price outside POI zone ${entryZone.bottom}-${entryZone.top} — waiting for retest`;
      reasons.push(zoneGateReason);
    }
  }

  const eligible = allAligned && !!m5Trigger && !newsBlock && zoneGateOk;

  let grade = null;
  if (eligible) {
    if (triggerSource === "M15_FALLBACK") grade = "B";
    else grade = score >= 85 ? "A+" : score >= 70 ? "A" : "B";
  }
  const rr = eligible ? computeRR(entry, sl, tp1) : 0;

  return {
    eligible, grade, direction, confidence: score,
    entry: round2(entry), sl: round2(sl), tp1: round2(tp1), tp2: round2(tp2), tp3: round2(tp3),
    rr, triggerSource, confluence,
    zoneGate: { ok: zoneGateOk, reason: zoneGateReason },
    m5Trigger: m5Trigger
      ? { sweepType: m5Trigger.sweep.type, sweepPrice: round2(m5Trigger.sweep.price), fvgType: m5Trigger.fvg.type, fvgTop: round2(m5Trigger.fvg.top), fvgBottom: round2(m5Trigger.fvg.bottom) }
      : null,
    reasons, newsBlock: !!newsBlock, candleIntervalMs: M5_MS
  };
}

export function m5CountdownMs(now = Date.now()) {
  const boundary = Math.floor(now / M5_MS) * M5_MS + M5_MS;
  return Math.max(0, boundary - now);
}