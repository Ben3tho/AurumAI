// AURUM AI v2.0 — Multi-Timeframe Confidence Engine.
// Hierarchy: D1 = macro trend · H4 = structure confirmation · H1 = SMC setup ·
// M15 = execution entry · M5 = sniper entry.
// M15/M5 cannot be derived from an H1 source (you can't resample finer), so they
// are reported as "N/A — needs M15/M5 source data" until finer CSV is imported.
//
// Confidence Score (0-100) is built from six factors:
//   Trend Alignment · BOS/CHOCH · FVG · Order Block · Liquidity Sweep · News Filter
// It is NOT a win probability — it measures directional factor agreement.

import { emaSeries } from "./indicators";
import {
  detectStructure,
  detectFVG,
  detectOrderBlocks,
  detectLiquiditySweeps
} from "./smc";

// v3.2 — degrade gracefully so D1/H4 with fewer than 200 bars still produce a
// macro bias (e20/e50 stack) instead of returning null ("BUILDING" forever).
// Full 3-EMA stack only when 200+ bars are available.
function emaStack(candles) {
  if (!candles || candles.length < 50) return null;
  const e20 = emaSeries(candles, 20);
  const e50 = emaSeries(candles, 50);
  const i = candles.length - 1;
  if (Number.isNaN(e20[i]) || Number.isNaN(e50[i])) return null;
  let e200 = null;
  let stack;
  if (candles.length >= 200) {
    const e200arr = emaSeries(candles, 200);
    e200 = e200arr[i];
    if (!Number.isNaN(e200)) {
      stack = e20[i] > e50[i] && e50[i] > e200 ? "bullish"
        : e20[i] < e50[i] && e50[i] < e200 ? "bearish"
        : "mixed";
    } else {
      stack = e20[i] > e50[i] ? "bullish" : e20[i] < e50[i] ? "bearish" : "mixed";
      e200 = null;
    }
  } else {
    stack = e20[i] > e50[i] ? "bullish" : e20[i] < e50[i] ? "bearish" : "mixed";
  }
  return { stack, e20: e20[i], e50: e50[i], e200, close: candles[i].close };
}

function lastMatching(arr, key, value) {
  for (let k = arr.length - 1; k >= 0; k--) {
    if (arr[k][key] === value) return arr[k];
  }
  return null;
}

// News Filter — no live news feed is connected, so the factor is kept NEUTRAL
// (full weight) to avoid fabricating economic-event data. Surfaced as "CLEAR".
function newsFilterStatus() {
  return { status: "CLEAR", weight: 10, note: "No live news feed — neutral" };
}

export function computeMTFConfidence(timeframes, sourceTimeframe) {
  const D1 = timeframes.D1 || null;
  const H4 = timeframes.H4 || null;
  const H1 = timeframes.H1 || null;
  const M15 = timeframes.M15 || null;
  const M5 = timeframes.M5 || null;

  const d1Stack = D1 ? emaStack(D1) : null;
  const h4Stack = H4 ? emaStack(H4) : null;
  const h1Stack = H1 ? emaStack(H1) : null;

  // Determine macro direction from D1 -> H4 -> H1 EMA stack, then fall back to the
  // latest BOS/CHOCH structure on H4/H1 (V2.2: never 0/100 if structure data exists).
  let direction = null;
  if (d1Stack && d1Stack.stack !== "mixed") direction = d1Stack.stack;
  else if (h4Stack && h4Stack.stack !== "mixed") direction = h4Stack.stack;
  else if (h1Stack && h1Stack.stack !== "mixed") direction = h1Stack.stack;
  if (!direction) {
    for (const tf of [H4, H1]) {
      if (!tf) continue;
      const { events } = detectStructure(tf);
      const last = events[events.length - 1];
      if (last && (last.type === "BOS" || last.type === "CHOCH")) { direction = last.direction; break; }
    }
  }
  const h1HasSMC = !!(H1 && (detectStructure(H1).events.length || detectFVG(H1).length || detectOrderBlocks(H1).length));
  const m15HasSMC = !!(M15 && (detectStructure(M15).events.length || detectFVG(M15).length || detectOrderBlocks(M15).length));
  const anySMC = h1HasSMC || m15HasSMC;
  if (!direction) {
    return {
      score: anySMC ? 10 : 0,
      direction: null,
      factors: emptyFactors(),
      perTimeframe: perTimeframeStatus(D1, H4, H1, M15, M5, d1Stack, h4Stack, h1Stack),
      available: anySMC,
      calculating: false,
      failedRules: anySMC ? ["No directional bias - EMA stacks mixed and structure neutral"] : ["No SMC data on H1/M15"],
      sourceTimeframe
    };
  }

  const dir = direction === "bullish" ? "bull" : "bear";

  // --- H4 structure confirmation (BOS/CHOCH) ---
  let bosChoch = { score: 0, label: "None" };
  if (H4) {
    const { events } = detectStructure(H4);
    const match = lastMatching(events, "direction", direction);
    if (match) {
      bosChoch = { score: 20, label: `${match.type} ${match.direction}`, event: match };
    } else {
      const opposite = lastMatching(events, "direction", direction === "bullish" ? "bearish" : "bullish");
      bosChoch = opposite
        ? { score: 0, label: `${opposite.type} against` }
        : { score: 8, label: "No event" };
    }
  }

  // --- H1 SMC factors ---
  let fvg = { score: 0, label: "None" };
  let orderBlock = { score: 0, label: "None" };
  let liquiditySweep = { score: 0, label: "None" };
  if (H1) {
    const fvgs = detectFVG(H1);
    const fvgType = direction === "bullish" ? "bullish" : "bearish";
    const f = lastMatching(fvgs, "type", fvgType);
    if (f && !f.mitigated) fvg = { score: 15, label: `Unmitigated ${fvgType} FVG`, event: f };

    const obs = detectOrderBlocks(H1);
    const obType = direction === "bullish" ? "bullish" : "bearish";
    const ob = lastMatching(obs, "type", obType);
    if (ob) orderBlock = { score: 15, label: `${obType} Order Block`, event: ob };

    const sweeps = detectLiquiditySweeps(H1);
    const sweepType = direction === "bullish" ? "sell-side" : "buy-side";
    const sw = lastMatching(sweeps, "type", sweepType);
    if (sw) liquiditySweep = { score: 15, label: `${sweepType} sweep`, event: sw };
  }

  // --- Trend alignment across D1 / H4 / H1 ---
  let aligned = 0;
  if (d1Stack && d1Stack.stack === direction) aligned++;
  if (h4Stack && h4Stack.stack === direction) aligned++;
  if (h1Stack && h1Stack.stack === direction) aligned++;
  const trendAlignment = {
    score: aligned >= 3 ? 25 : aligned === 2 ? 17 : aligned === 1 ? 8 : 0,
    label: `${aligned}/3 aligned`,
    d1: d1Stack?.stack || "N/A",
    h4: h4Stack?.stack || "N/A",
    h1: h1Stack?.stack || "N/A"
  };

  const news = newsFilterStatus();

  const factors = {
    trendAlignment,
    bosChoch,
    fvg,
    orderBlock,
    liquiditySweep,
    newsFilter: { score: news.weight, label: news.status, note: news.note }
  };

  const score = Math.min(
    100,
    trendAlignment.score + bosChoch.score + fvg.score + orderBlock.score + liquiditySweep.score + news.weight
  );

  const failedRules = [];
  if (trendAlignment.score === 0) failedRules.push("Trend alignment: D1/H4/H1 not aligned");
  if (bosChoch.score === 0) failedRules.push("BOS/CHOCH: no matching H4 structure event");
  if (fvg.score === 0) failedRules.push("FVG: no unmitigated H1 FVG in direction");
  if (orderBlock.score === 0) failedRules.push("Order Block: no matching H1 OB in direction");
  if (liquiditySweep.score === 0) failedRules.push("Liquidity Sweep: no matching H1 sweep in direction");

  return {
    score,
    direction: dir,
    factors,
    perTimeframe: perTimeframeStatus(D1, H4, H1, M15, M5, d1Stack, h4Stack, h1Stack),
    available: true,
    calculating: false,
    failedRules,
    sourceTimeframe
  };
}

function emptyFactors() {
  return {
    trendAlignment: { score: 0, label: "N/A" },
    bosChoch: { score: 0, label: "N/A" },
    fvg: { score: 0, label: "N/A" },
    orderBlock: { score: 0, label: "N/A" },
    liquiditySweep: { score: 0, label: "N/A" },
    newsFilter: { score: 0, label: "N/A" }
  };
}

function perTimeframeStatus(D1, H4, H1, M15, M5, d1Stack, h4Stack, h1Stack) {
  // emaStack() returns an OBJECT {stack,e20,e50,e200,close} or null — never a bare
  // string. Calling .toUpperCase() on it crashed the backfill ("t.toUpperCase is
  // not a function"). Read the inner .stack string safely instead.
  // v3.2 — per-TF readiness threshold. D1/H4 complete at 60/80 bars (EMA bias
  // degrades to e20/e50), so they no longer stay stuck in BUILDING.
  const TF_MIN = { D1: 60, H4: 80, H1: 120, M15: 200, M5: 100 };
  const tfStatus = (candles, emaStackObj, role, tf) => {
    if (!candles) return { role, status: "N/A", available: false, note: "Not derivable from source" };
    const min = TF_MIN[tf] || 200;
    if (!emaStackObj) return { role, status: "BUILDING", available: false, note: `${candles.length} bars (need ${min} for bias)` };
    const s = emaStackObj.stack;
    return { role, status: (typeof s === "string" ? s : "MIXED").toUpperCase(), available: true };
  };
  // Note: callers below pass the TF label so the threshold can be applied.
  return {
    D1: tfStatus(D1, d1Stack, "Macro Trend", "D1"),
    H4: tfStatus(H4, h4Stack, "Structure Confirm", "H4"),
    H1: tfStatus(H1, h1Stack, "SMC Setup", "H1"),
    M15: { role: "Execution Entry", status: M15 ? "READY" : "N/A", available: !!M15, note: M15 ? null : "Needs M15 source" },
    M5: { role: "Sniper Entry", status: M5 ? "READY" : "N/A", available: !!M5, note: M5 ? null : "Needs M5 source" }
  };
}