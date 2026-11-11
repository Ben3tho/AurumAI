// AURUM AI — M15 + H1 Confluence Engine.
// 1. H1 trend from BOS/CHOCH market structure (detectStructure).
// 2. M15 setup from FVG, Order Blocks and Liquidity Sweeps.
// 3. BUY/SELL only when H1 trend agrees with the M15 setup direction.
// 4. State: WAIT (no aligned setup) · READY (aligned, price outside zone) · ENTER NOW (price inside the entry zone).
// 5. SL beyond the swept M15 swing; TP1/TP2/TP3 at 3R/5R/8R from M15 ATR.
// v3.2: all price outputs rounded to 2 dp via shared round2 helper.
// Heavy detection runs on candle updates only; the live price is applied by the caller
// for the real-time ENTER NOW check, so this function stays cheap per tick.

import { detectStructure, detectFVG, detectOrderBlocks, detectLiquiditySweeps } from "./smc";
import { atr } from "./indicators";
import { round2 } from "./format";

export function computeM15H1Confluence(h1Candles, m15Candles) {
  if (!h1Candles?.length || !m15Candles?.length) {
    return empty("No H1/M15 data");
  }

  // --- H1 trend via BOS / CHOCH ---
  const { events: h1Events, finalTrend } = detectStructure(h1Candles);
  const h1BOS = h1Events.filter((e) => e.type === "BOS").length;
  const h1CHOCH = h1Events.filter((e) => e.type === "CHOCH").length;
  const h1LastEvent = h1Events[h1Events.length - 1] || null;
  const h1Trend = finalTrend; // "bullish" | "bearish" | "neutral"

  // --- M15 setup ---
  const fvgs = detectFVG(m15Candles);
  const obs = detectOrderBlocks(m15Candles);
  const sweeps = detectLiquiditySweeps(m15Candles);

  const direction = h1Trend === "bullish" ? "BUY" : h1Trend === "bearish" ? "SELL" : null;
  const wantFvgType = h1Trend;
  const wantObType = h1Trend;
  const wantSweepType = h1Trend === "bullish" ? "sell-side" : h1Trend === "bearish" ? "buy-side" : null;

  let m15FVG = null, m15OB = null, m15Sweep = null;
  if (wantFvgType) {
    m15FVG = [...fvgs].reverse().find((f) => f.type === wantFvgType && !f.mitigated);
    m15OB = [...obs].reverse().find((o) => o.type === wantObType);
    m15Sweep = [...sweeps].reverse().find((s) => s.type === wantSweepType);
  }

  const aligned = !!direction && (!!m15FVG || !!m15OB);
  const entryZone = m15FVG
    ? { top: round2(m15FVG.top), bottom: round2(m15FVG.bottom), kind: "FVG", time: m15FVG.time || null }
    : m15OB
      ? { top: round2(m15OB.top), bottom: round2(m15OB.bottom), kind: "OB", time: m15OB.time || null }
      : null;

  // --- Levels from M15 structure ---
  let sl = null, tp1 = null, tp2 = null, tp3 = null, rr = 0;
  if (aligned && entryZone) {
    const a = atr(m15Candles, 14);
    const atrVal = a[a.length - 1] || (m15Candles[m15Candles.length - 1].high - m15Candles[m15Candles.length - 1].low);
    const refPrice = entryZone.bottom; // v3.2: entry referenced from the zone edge, not the last close
    if (direction === "BUY") {
      const swingLow = m15Sweep ? m15Sweep.price : Math.min(...m15Candles.slice(-20).map((c) => c.low));
      sl = swingLow - atrVal * 0.2;
      const risk = refPrice - sl;
      tp1 = refPrice + risk * 3;
      tp2 = refPrice + risk * 5;
      tp3 = refPrice + risk * 8;
      rr = risk > 0 ? 3 : 0;
    } else {
      const swingHigh = m15Sweep ? m15Sweep.price : Math.max(...m15Candles.slice(-20).map((c) => c.high));
      sl = swingHigh + atrVal * 0.2;
      const risk = sl - refPrice;
      tp1 = refPrice - risk * 3;
      tp2 = refPrice - risk * 5;
      tp3 = refPrice - risk * 8;
      rr = risk > 0 ? 3 : 0;
    }
  }

  const reasons = [];
  if (h1Trend === "neutral") reasons.push("H1 structure neutral — no directional bias");
  else reasons.push(`H1 ${h1Trend.toUpperCase()} (${h1BOS} BOS / ${h1CHOCH} CHOCH)`);
  if (h1LastEvent) reasons.push(`Last H1: ${h1LastEvent.type} ${h1LastEvent.direction}`);
  if (m15FVG) reasons.push(`M15 ${m15FVG.type} FVG unmitigated ${entryZone.bottom}-${entryZone.top}`);
  if (m15OB) reasons.push(`M15 ${m15OB.type} Order Block ${entryZone.bottom}-${entryZone.top}`);
  if (m15Sweep) reasons.push(`M15 ${m15Sweep.type} sweep @ $${round2(m15Sweep.price)}`);
  if (!aligned && direction) reasons.push(`No aligned M15 ${direction} setup (need FVG/OB)`);

  return {
    direction, aligned, h1Trend, h1BOS, h1CHOCH, h1LastEvent,
    m15FVG, m15OB, m15Sweep, entryZone,
    sl: round2(sl), tp1: round2(tp1), tp2: round2(tp2), tp3: round2(tp3), rr, reasons
  };
}

function empty(reason) {
  return {
    direction: null, aligned: false, h1Trend: "neutral", h1BOS: 0, h1CHOCH: 0, h1LastEvent: null,
    m15FVG: null, m15OB: null, m15Sweep: null, entryZone: null,
    sl: null, tp1: null, tp2: null, tp3: null, rr: 0, reasons: [reason]
  };
}