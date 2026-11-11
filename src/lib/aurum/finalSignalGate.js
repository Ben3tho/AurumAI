// AURUM AI v3.2 — Final Signal Gate.
// The SINGLE authoritative engine: validates timeframe inputs, checks per-TF
// data readiness, computes one Final Bias, one 7-factor Confluence score
// (clean 100-point total), revalidates the M15/H1 setup against the live price
// (staleness + execution distance), mathematically validates Entry/SL/TP + RR,
// and runs the 14-rule final signal gate.
//
// v3.2 changes:
//   - DEGRADED data quality → FINAL SIGNAL = "BLOCKED" (DATA RE-SYNC REQUIRED);
//     SMC structures (FVG/OB/Sweep) are NOT calculated while data is degraded.
//   - Strict RR hard gate: reject any setup with RR < 1.5R (inverse RR blocked).
//   - Execution distance: trade levels are only computed when price is INSIDE
//     the POI entry zone; outside the zone → WAITING FOR RETEST (no orders).
//   - Session fix: New York (16-21 UTC) now scores (LONDON_NY), not OFF.
//   - Confluence rescaled to 7 transparent factors summing to 100.
//   - Data-lag sync check added (rule 14).

import { emaSeries, atr } from "./indicators";
import { detectStructure, detectFVG, detectOrderBlocks, detectLiquiditySweeps } from "./smc";
import { TIMEFRAME_MS } from "./multiTimeframe";
import { round2 } from "./format";

const VALID_TF = new Set(["D1", "H4", "H1", "M15", "M5"]);
export function validateTimeframe(tf) {
  if (typeof tf !== "string" || !VALID_TF.has(tf)) {
    return { valid: false, error: `Invalid timeframe '${tf}' (expected D1|H4|H1|M15|M5)` };
  }
  return { valid: true };
}

// v3.2 — lowered D1/H4 thresholds so higher timeframes COMPLETE instead of
// staying stuck in BUILDING. EMA bias degrades gracefully (e20/e50) when fewer
// than 200 bars are available, so 60 D1 bars still produce a valid macro bias.
const REQUIRED_BARS = { D1: 60, H4: 80, H1: 120, M15: 200, M5: 100 };
const STRATEGY_TF = ["D1", "H4", "H1", "M15"]; // M5 is sniper-only

const MIN_RR = 1.5; // strict hard gate
const MAX_EXEC_DISTANCE_USD = 38; // audit: do not execute when price is $38+ from zone

function stackBias(candles) {
  if (!candles || candles.length < 50) return "NEUTRAL";
  const e20 = emaSeries(candles, 20);
  const e50 = emaSeries(candles, 50);
  const i = candles.length - 1;
  if (Number.isNaN(e20[i]) || Number.isNaN(e50[i])) return "NEUTRAL";
  if (candles.length >= 200) {
    const e200 = emaSeries(candles, 200);
    if (!Number.isNaN(e200[i])) {
      if (e20[i] > e50[i] && e50[i] > e200[i]) return "BULLISH";
      if (e20[i] < e50[i] && e50[i] < e200[i]) return "BEARISH";
      return "MIXED";
    }
  }
  return e20[i] > e50[i] ? "BULLISH" : e20[i] < e50[i] ? "BEARISH" : "MIXED";
}

function structureBias(candles) {
  if (!candles || candles.length < 10) return "NEUTRAL";
  const { finalTrend } = detectStructure(candles);
  return finalTrend === "bullish" ? "BULLISH" : finalTrend === "bearish" ? "BEARISH" : "NEUTRAL";
}

function tfReadiness(tf, candles) {
  const v = validateTimeframe(tf);
  const required = REQUIRED_BARS[tf];
  if (!v.valid) {
    return { timeframe: tf, requiredBars: required, availableBars: 0, missingBars: required, oldest: null, newest: null, status: "INVALID", error: v.error };
  }
  if (!candles || !candles.length) {
    return { timeframe: tf, requiredBars: required, availableBars: 0, missingBars: required, oldest: null, newest: null, status: "NOT_READY" };
  }
  const availableBars = candles.length;
  const missingBars = Math.max(0, required - availableBars);
  const oldest = new Date(candles[0].time).toISOString();
  const newest = new Date(candles[candles.length - 1].time).toISOString();
  const status = availableBars >= required ? "READY" : "BUILDING";
  return { timeframe: tf, requiredBars: required, availableBars, missingBars, oldest, newest, status };
}

// v3.2 FIX — New York (16-21 UTC) is now part of LONDON_NY and scores points.
// Previously h>=21 fell through to OFF, and the overlap window ended at 16, so
// the NY active session (16-21) was scored 0 ("Session: OFF (0/100)").
function currentSession() {
  const h = new Date().getUTCHours();
  if (h >= 7 && h < 21) return "LONDON_NY"; // London (7-12) + overlap (12-16) + NY (16-21)
  if (h >= 0 && h < 7) return "ASIAN";
  return "OFF";
}

export function computeFinalSignalGate({ timeframes, m15h1, sniper, validation, newsBlock, newsStatus, livePrice, sourceTimeframe, fileName }) {
  const D1 = timeframes?.D1, H4 = timeframes?.H4, H1 = timeframes?.H1, M15 = timeframes?.M15, M5 = timeframes?.M5;

  // --- Data readiness (per required TF) ---
  const readiness = {
    D1: tfReadiness("D1", D1),
    H4: tfReadiness("H4", H4),
    H1: tfReadiness("H1", H1),
    M15: tfReadiness("M15", M15),
    M5: tfReadiness("M5", M5)
  };
  const strategyReady = STRATEGY_TF.every((tf) => readiness[tf].status === "READY");

  // --- Data quality gating (critical missing bars in lookback window) ---
  const missingBars = validation?.criticalMissingBars ?? validation?.missingCandles ?? 0;
  const dataDegraded = missingBars > 0;
  const dataQuality = dataDegraded
    ? { status: "DEGRADED", missingBars, reason: `${missingBars} missing bar(s) in critical lookback window — SMC structures suppressed, resync required` }
    : { status: "OK", missingBars: 0, reason: "No critical gaps" };

  // --- Data-lag sync (historical last candle vs real-time) ---
  const sourceIntervalMs = TIMEFRAME_MS[sourceTimeframe] || TIMEFRAME_MS.H1;
  const lastCandleMs = M15?.length ? M15[M15.length - 1].time
    : H1?.length ? H1[H1.length - 1].time
    : D1?.length ? D1[D1.length - 1].time : null;
  const dataLagMs = lastCandleMs != null ? Date.now() - lastCandleMs : null;
  const lagThreshold = Math.max(sourceIntervalMs * 3, 15 * 60 * 1000);
  const lagOk = dataLagMs != null && dataLagMs < lagThreshold;

  // --- Per-TF biases + Final Bias ---
  const d1Macro = stackBias(D1);
  const h4Struct = structureBias(H4);
  const h1Setup = structureBias(H1);
  const m15Exec = stackBias(M15) !== "NEUTRAL" ? stackBias(M15) : structureBias(M15);
  const m5Sniper = M5 ? stackBias(M5) : "NOT_AVAILABLE";
  const liveMomentum = (livePrice != null && H1 && H1.length >= 20)
    ? (livePrice > emaSeries(H1, 20)[H1.length - 1] ? "BULLISH" : "BEARISH")
    : "NEUTRAL";

  const htBias = (d1Macro === h4Struct && (h4Struct === "BULLISH" || h4Struct === "BEARISH")) ? h4Struct : "MIXED";
  const execBias = (h1Setup === m15Exec && (h1Setup === "BULLISH" || h1Setup === "BEARISH")) ? h1Setup : "MIXED";
  let finalBias = "NEUTRAL";
  let finalBiasReason = "";
  if (htBias === "MIXED" || execBias === "MIXED" || htBias !== execBias) {
    finalBias = "MIXED";
    finalBiasReason = `Higher timeframe ${htBias.toLowerCase()}, execution timeframe ${execBias.toLowerCase()}`;
  } else {
    finalBias = htBias;
    finalBiasReason = `All timeframes aligned ${htBias.toLowerCase()}`;
  }

  // --- Single authoritative 7-factor Confluence score (transparent 100 total) ---
  // Trend 20 · BOS/CHOCH 15 · FVG 15 · OB 15 · Sweep 15 · Session 10 · News 10 = 100
  // Data Quality is a HARD GATE (not a score factor) — degraded data blocks.
  const dir = finalBias === "BULLISH" ? "bullish" : finalBias === "BEARISH" ? "bearish" : null;
  const session = currentSession();
  const factors = [];

  const trendPass = !!dir && d1Macro === finalBias && h4Struct === finalBias && h1Setup === finalBias;
  factors.push({ name: "Trend Alignment", weight: 20, score: trendPass ? 20 : 0, label: trendPass ? "D1/H4/H1 aligned" : "D1/H4/H1 not aligned" });

  // SMC-based factors are SUPPRESSED when data is degraded — gaps make FVG/OB/
  // sweep detection unreliable, so they must not contribute to the score.
  let bosScore = 0, bosLabel = dataDegraded ? "Suppressed (data degraded)" : "No H4 structure event";
  if (H4 && dir && !dataDegraded) {
    const ev = detectStructure(H4).events;
    const last = ev[ev.length - 1];
    if (last && last.direction === dir) { bosScore = 15; bosLabel = `${last.type} ${last.direction}`; }
  }
  factors.push({ name: "BOS/CHOCH", weight: 15, score: bosScore, label: bosLabel });

  let fvgScore = 0, fvgLabel = dataDegraded ? "Suppressed (data degraded)" : "No unmitigated H1 FVG";
  if (H1 && dir && !dataDegraded) {
    const f = [...detectFVG(H1)].reverse().find((x) => x.type === dir && !x.mitigated);
    if (f) { fvgScore = 15; fvgLabel = `${dir} FVG unmitigated`; }
  }
  factors.push({ name: "Fair Value Gap", weight: 15, score: fvgScore, label: fvgLabel });

  let obScore = 0, obLabel = dataDegraded ? "Suppressed (data degraded)" : "No matching H1 OB";
  if (H1 && dir && !dataDegraded) {
    const o = [...detectOrderBlocks(H1)].reverse().find((x) => x.type === dir);
    if (o) { obScore = 15; obLabel = `${dir} Order Block`; }
  }
  factors.push({ name: "Order Block", weight: 15, score: obScore, label: obLabel });

  let sweepScore = 0, sweepLabel = dataDegraded ? "Suppressed (data degraded)" : "No matching H1 sweep";
  if (H1 && dir && !dataDegraded) {
    const want = dir === "bullish" ? "sell-side" : "buy-side";
    const s = [...detectLiquiditySweeps(H1)].reverse().find((x) => x.type === want);
    if (s) { sweepScore = 15; sweepLabel = `${want} sweep`; }
  }
  factors.push({ name: "Liquidity Sweep", weight: 15, score: sweepScore, label: sweepLabel });

  const sessionScore = session === "LONDON_NY" ? 10 : session === "ASIAN" ? 5 : 0;
  factors.push({ name: "Session", weight: 10, score: sessionScore, label: session === "LONDON_NY" ? "London/NY active" : session === "ASIAN" ? "Asian" : "Off-session" });

  let newsScore = 0, newsLabel = "UNKNOWN";
  if (newsStatus === "LIVE") { newsScore = 10; newsLabel = "Clear"; }
  else if (newsStatus === "BLOCK") { newsScore = 0; newsLabel = "High-impact block"; }
  else { newsScore = 5; newsLabel = "News filter could not be verified"; }
  factors.push({ name: "News", weight: 10, score: newsScore, label: newsLabel });

  const confluenceScore = factors.reduce((s, f) => s + f.score, 0);
  const confluence = { score: confluenceScore, direction: dir, factors };

  // --- Setup freshness (revalidate M15/H1 setup zone vs live price) ---
  // v3.2: FRESH only when price is INSIDE the POI zone. Outside the zone (but not
  // invalidated) → WAITING_RETEST — execution is withheld until price retraces in.
  let setup = { direction: null, status: "NONE", displayState: "WAIT", detected: false, zone: null, distance: null, reason: "No setup detected" };
  if (m15h1?.entryZone && m15h1?.direction) {
    const z = { top: round2(m15h1.entryZone.top), bottom: round2(m15h1.entryZone.bottom), kind: m15h1.entryZone.kind };
    const mid = (z.top + z.bottom) / 2;
    const distance = livePrice != null ? Math.abs(livePrice - mid) : null;
    let h1Atr = 0;
    if (H1 && H1.length >= 14) { const a = atr(H1, 14); h1Atr = a[a.length - 1] || 0; }
    const inZone = livePrice != null && livePrice >= z.bottom && livePrice <= z.top;
    let invalidated = false;
    if (livePrice != null) {
      if (m15h1.direction === "BUY" && livePrice < z.bottom) invalidated = true;
      if (m15h1.direction === "SELL" && livePrice > z.top) invalidated = true;
    }
    let status, reason;
    if (invalidated) { status = "STALE"; reason = "Price has invalidated the setup zone — structurally obsolete"; }
    else if (inZone) { status = "FRESH"; reason = "Price inside POI entry zone — executable"; }
    else { status = "WAITING_RETEST"; reason = distance != null ? `Price $${distance.toFixed(1)} from zone ${z.bottom}-${z.top} — waiting for retest` : "Waiting for live price to reach zone"; }
    const displayState = status === "FRESH" ? "FRESH" : status === "WAITING_RETEST" ? "WAITING_FOR_RETEST" : status === "STALE" ? "STALE" : "WAIT";
    setup = {
      direction: m15h1.direction, status, displayState, detected: true,
      zone: { top: z.top, bottom: z.bottom, kind: z.kind, time: m15h1.m15FVG?.time || m15h1.m15OB?.time || null, sourceTf: "M15" },
      distance: round2(distance), h1Atr: round2(h1Atr), reason
    };
  }

  // --- Trade level validation (only computed when setup is FRESH = price in zone) ---
  // v3.2: strict RR ≥ 1.5R hard gate. Inverse/poor RR (reward < 1.5× risk) is INVALID.
  const direction = sniper?.eligible
    ? (sniper.direction === "bull" ? "BUY" : "SELL")
    : (m15h1?.direction || (dir === "bullish" ? "BUY" : dir === "bearish" ? "SELL" : null));
  const useSniper = sniper?.eligible && setup.status === "FRESH";
  const entry = useSniper ? sniper.entry : (m15h1?.aligned && setup.status === "FRESH" ? livePrice : null);
  const sl = useSniper ? sniper.sl : (setup.status === "FRESH" ? m15h1?.sl : null);
  const tp1 = useSniper ? sniper.tp1 : (setup.status === "FRESH" ? m15h1?.tp1 : null);

  let tradeValidation = { valid: false, direction, entry: round2(entry), sl: round2(sl), tp1: round2(tp1), rr: 0, risk: 0, reward: 0, reason: setup.status !== "FRESH" ? "Price outside POI zone — execution withheld" : "No setup" };
  if (direction && setup.status === "FRESH" && entry != null && sl != null && tp1 != null) {
    let risk = 0, reward = 0, reason = null;
    if (direction === "BUY") {
      if (!(sl < entry && entry < tp1)) reason = "BUY requires SL < Entry < TP (inverse RR)";
      else { risk = entry - sl; reward = tp1 - entry; }
    } else {
      if (!(tp1 < entry && entry < sl)) reason = "SELL requires TP < Entry < SL (inverse RR)";
      else { risk = sl - entry; reward = entry - tp1; }
    }
    const rr = risk > 0 ? reward / risk : 0;
    if (reason) tradeValidation = { valid: false, direction, entry: round2(entry), sl: round2(sl), tp1: round2(tp1), rr: round2(rr), risk: round2(risk), reward: round2(reward), reason };
    else if (risk <= 0) tradeValidation = { valid: false, direction, entry: round2(entry), sl: round2(sl), tp1: round2(tp1), rr: 0, risk: 0, reward: round2(reward), reason: "Risk <= 0 — INVALID" };
    else if (rr < MIN_RR) tradeValidation = { valid: false, direction, entry: round2(entry), sl: round2(sl), tp1: round2(tp1), rr: round2(rr), risk: round2(risk), reward: round2(reward), reason: `RR ${rr.toFixed(2)}R < ${MIN_RR}R minimum — REJECTED` };
    else tradeValidation = { valid: true, direction, entry: round2(entry), sl: round2(sl), tp1: round2(tp1), rr: round2(rr), risk: round2(risk), reward: round2(reward), reason: `Valid (${rr.toFixed(2)}R ≥ ${MIN_RR}R)` };
  }

  // --- M5 + News status ---
  const m5Status = (M5 && M5.length >= 30) ? "READY" : "NOT_AVAILABLE";
  let newsState = "UNKNOWN", newsText = "News filter could not be verified";
  if (newsStatus === "LIVE") { newsState = "CLEAR"; newsText = "No high-impact news"; }
  else if (newsStatus === "BLOCK") { newsState = "BLOCK"; newsText = "High-impact USD news within +/-30 min"; }

  // --- 14-rule final signal gate ---
  const rules = [];
  rules.push({ id: 1, name: "Historical data valid", passed: !!timeframes && !!sourceTimeframe && sourceTimeframe !== "UNKNOWN", detail: sourceTimeframe || "unknown" });
  rules.push({ id: 2, name: "Required timeframe data ready", passed: strategyReady, detail: STRATEGY_TF.map((t) => `${t}:${readiness[t].status}`).join(" ") });
  rules.push({ id: 3, name: "Current price synchronized", passed: livePrice != null && livePrice > 0, detail: livePrice != null ? `$${livePrice.toFixed(2)}` : "No live price" });
  rules.push({ id: 4, name: "No critical data gaps", passed: !dataDegraded, detail: dataDegraded ? `${missingBars} missing bar(s)` : "OK" });
  rules.push({ id: 5, name: "Setup fresh (price in POI zone)", passed: setup.status === "FRESH", detail: setup.status });
  rules.push({ id: 6, name: "Price within execution distance of zone", passed: setup.status === "FRESH", detail: setup.distance != null ? `$${setup.distance}` : "—" });
  rules.push({ id: 7, name: "Entry is valid", passed: tradeValidation.valid, detail: tradeValidation.entry != null ? `$${tradeValidation.entry}` : "—" });
  rules.push({ id: 8, name: "SL on correct side of entry", passed: tradeValidation.valid, detail: tradeValidation.sl != null ? `$${tradeValidation.sl}` : "—" });
  rules.push({ id: 9, name: "TP on correct side of entry", passed: tradeValidation.valid, detail: tradeValidation.tp1 != null ? `$${tradeValidation.tp1}` : "—" });
  rules.push({ id: 10, name: `RR ≥ ${MIN_RR}R (strict hard gate)`, passed: tradeValidation.valid && tradeValidation.rr >= MIN_RR, detail: tradeValidation.rr ? `${tradeValidation.rr}R` : "—" });
  rules.push({ id: 11, name: "Higher timeframe rules pass", passed: finalBias !== "MIXED" && finalBias !== "NEUTRAL", detail: finalBias });
  rules.push({ id: 12, name: "Confluence score valid (≥60)", passed: confluenceScore >= 60 && !!dir, detail: `${confluenceScore}/100` });
  rules.push({ id: 13, name: "News status correctly represented", passed: newsState !== "BLOCK", detail: newsState });
  rules.push({ id: 14, name: "Historical data current (lag < 3 bars)", passed: lagOk, detail: dataLagMs != null ? `${(dataLagMs / 60000).toFixed(0)}m lag` : "—" });

  const allPass = rules.every((r) => r.passed);
  const newsBlocked = newsState === "BLOCK";

  // v3.2 — DEGRADED data forces BLOCKED / DATA RE-SYNC REQUIRED, bypassing trade calc.
  let finalSignal, blocked = false, blockReason = null;
  if (dataDegraded) {
    finalSignal = "BLOCKED";
    blocked = true;
    blockReason = "DATA RE-SYNC REQUIRED";
  } else if (allPass) {
    finalSignal = direction;
  } else {
    finalSignal = "WAIT";
  }
  // v3.2 — Explicit high-impact news gate reason, surfaced at the top of the
  // wait-reason list so the board can show "HIGH IMPACT NEWS EVENT ACTIVE".
  let waitReasons = rules.filter((r) => !r.passed).map((r) => `${r.name} (${r.detail})`);
  if (newsBlocked) waitReasons = ["HIGH IMPACT NEWS EVENT ACTIVE (±30m window)", ...waitReasons];

  return {
    finalSignal, finalBias, finalBiasReason,
    blocked, blockReason,
    biases: { D1: d1Macro, H4: h4Struct, H1: h1Setup, M15: m15Exec, M5: m5Sniper, liveMomentum },
    confluence,
    readiness,
    dataQuality,
    dataLagMs,
    setup,
    tradeValidation,
    m5Status,
    news: { state: newsState, text: newsText, blocked: newsBlocked },
    rules,
    waitReasons,
    strategyReady,
    minRR: MIN_RR,
    dataset: { sourceTimeframe, fileName, bars: M15?.length || 0, first: readiness.M15.oldest, last: readiness.M15.newest }
  };
}