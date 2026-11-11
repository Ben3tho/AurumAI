// AI Confluence Signal Engine.
// Combines EMA trend, RSI, ATR, SMC structure, Order Blocks, FVG, Liquidity sweeps,
// Premium/Discount, and session filter into a 0-100 Confluence Score.
// IMPORTANT: Confluence Score is NOT a win probability — it measures factor agreement.

import { emaSeries, rsi, atr } from "./indicators";
import { detectStructure, detectFVG, detectOrderBlocks, detectLiquiditySweeps, premiumDiscount } from "./smc";

// Session windows in UTC hours. Asian: 0-7, London: 7-16, New York: 12-21.
function getSession(date) {
  const h = date.getUTCHours();
  if (h >= 0 && h < 7) return "ASIAN";
  if (h >= 7 && h < 12) return "LONDON";
  if (h >= 12 && h < 16) return "LONDON/NY OVERLAP";
  if (h >= 16 && h < 21) return "NEW YORK";
  return "OFF-SESSION";
}

// skipSession: for D1+ source a single bar spans all sessions, so the gate is bypassed.
export function sessionFilter(candle, allowAsian = false, skipSession = false) {
  const s = getSession(new Date(candle.time));
  if (skipSession) return { session: s, allowed: true };
  const ok = s === "LONDON" || s === "LONDON/NY OVERLAP" || s === "NEW YORK" || (allowAsian && s === "ASIAN");
  return { session: s, allowed: ok };
}

// Build a per-candle context array with all factors, causally.
export function buildContext(candles, options = {}) {
  const ema20 = emaSeries(candles, 20);
  const ema50 = emaSeries(candles, 50);
  const ema200 = emaSeries(candles, 200);
  const rsi14 = rsi(candles, 14);
  const atr14 = atr(candles, 14);
  const { events: structureEvents, finalTrend } = detectStructure(candles);
  const fvgs = detectFVG(candles);
  const obs = detectOrderBlocks(candles, 1.5, atr14);
  const sweeps = detectLiquiditySweeps(candles);

  const structureByIndex = {};
  for (const e of structureEvents) structureByIndex[e.index] = e;
  const fvgByIndex = {};
  for (const f of fvgs) fvgByIndex[f.index] = f;
  const obByIndex = {};
  for (const o of obs) obByIndex[o.index] = o;
  const sweepByIndex = {};
  for (const s of sweeps) sweepByIndex[s.index] = s;

  const context = candles.map((c, i) => {
    const trend =
      ema20[i] > ema50[i] && ema50[i] > ema200[i]
        ? "bullish"
        : ema20[i] < ema50[i] && ema50[i] < ema200[i]
        ? "bearish"
        : "mixed";
    const struct = structureByIndex[i] || null;
    const fvg = fvgByIndex[i] || null;
    const ob = obByIndex[i] || null;
    const sweep = sweepByIndex[i] || null;
    const sess = sessionFilter(c, options.allowAsian || false, options.skipSession || false);
    const pd = premiumDiscount(candles.slice(0, i + 1), 50);

    return {
      index: i,
      time: c.time,
      close: c.close,
      high: c.high,
      low: c.low,
      ema20: ema20[i],
      ema50: ema50[i],
      ema200: ema200[i],
      trend,
      rsi: rsi14[i],
      atr: atr14[i],
      structure: struct,
      fvg,
      orderBlock: ob,
      liquiditySweep: sweep,
      session: sess.session,
      sessionAllowed: sess.allowed,
      premiumDiscount: pd
    };
  });

  return { context, finalTrend };
}

// Score a single candle context. Returns { signal, score, factors, direction }
// minScore is timeframe-aware: 70 for intraday, 60 for D1+ (daily bars spread SMC
// events across fewer bars, so equal selectivity sits at a lower cutoff).
export function scoreCandle(ctx, minScore = 70) {
  if (!ctx || Number.isNaN(ctx.ema200) || Number.isNaN(ctx.atr) || !ctx.atr) {
    return { signal: "WAIT", score: 0, factors: [], direction: null };
  }

  const factors = [];
  let direction = null;

  const bullishConfluence =
    ctx.trend === "bullish" &&
    ctx.structure && ctx.structure.direction === "bullish" &&
    ctx.premiumDiscount && ctx.premiumDiscount.zone === "discount";

  const bearishConfluence =
    ctx.trend === "bearish" &&
    ctx.structure && ctx.structure.direction === "bearish" &&
    ctx.premiumDiscount && ctx.premiumDiscount.zone === "premium";

  if (bullishConfluence) direction = "bull";
  else if (bearishConfluence) direction = "bear";
  else {
    if (ctx.trend === "bullish" && ctx.structure && ctx.structure.direction === "bullish") direction = "bull";
    else if (ctx.trend === "bearish" && ctx.structure && ctx.structure.direction === "bearish") direction = "bear";
  }

  if (!direction) return { signal: "WAIT", score: 0, factors: [], direction: null };

  const dir = direction;

  // 1. EMA stack alignment (20)
  if (dir === "bull" && ctx.trend === "bullish") factors.push({ name: "EMA 20/50/200 bullish stack", weight: 20 });
  if (dir === "bear" && ctx.trend === "bearish") factors.push({ name: "EMA 20/50/200 bearish stack", weight: 20 });

  // 2. Structure BOS/CHOCH (20)
  if (ctx.structure) {
    const matches = (dir === "bull" && ctx.structure.direction === "bullish") || (dir === "bear" && ctx.structure.direction === "bearish");
    if (matches) factors.push({ name: `${ctx.structure.type} ${ctx.structure.direction}`, weight: 20 });
  }

  // 3. RSI not extreme, momentum aligned (10)
  if (!Number.isNaN(ctx.rsi)) {
    if (dir === "bull" && ctx.rsi > 40 && ctx.rsi < 75) factors.push({ name: "RSI bullish zone", weight: 10 });
    if (dir === "bear" && ctx.rsi < 60 && ctx.rsi > 25) factors.push({ name: "RSI bearish zone", weight: 10 });
  }

  // 4. Order Block presence (15)
  if (ctx.orderBlock) {
    const matches = (dir === "bull" && ctx.orderBlock.type === "bullish") || (dir === "bear" && ctx.orderBlock.type === "bearish");
    if (matches) factors.push({ name: `${dir === "bull" ? "Bullish" : "Bearish"} Order Block`, weight: 15 });
  }

  // 5. Fair Value Gap (10)
  if (ctx.fvg && !ctx.fvg.mitigated) {
    const matches = (dir === "bull" && ctx.fvg.type === "bullish") || (dir === "bear" && ctx.fvg.type === "bearish");
    if (matches) factors.push({ name: `Unmitigated ${dir === "bull" ? "bullish" : "bearish"} FVG`, weight: 10 });
  }

  // 6. Liquidity sweep (15)
  if (ctx.liquiditySweep) {
    const matches = (dir === "bull" && ctx.liquiditySweep.type === "sell-side") || (dir === "bear" && ctx.liquiditySweep.type === "buy-side");
    if (matches) factors.push({ name: `${ctx.liquiditySweep.type} liquidity sweep`, weight: 15 });
  }

  // 7. Premium/Discount (10)
  if (ctx.premiumDiscount) {
    const matches = (dir === "bull" && ctx.premiumDiscount.zone === "discount") || (dir === "bear" && ctx.premiumDiscount.zone === "premium");
    if (matches) factors.push({ name: `Trade in ${ctx.premiumDiscount.zone} zone`, weight: 10 });
  }

  const score = Math.min(100, factors.reduce((a, f) => a + f.weight, 0));

  // Session gate — WAIT if off-session (bypassed when skipSession was set in buildContext)
  let signal = "WAIT";
  if (score >= minScore && ctx.sessionAllowed) {
    signal = dir === "bull" ? "BUY" : "SELL";
  } else if (score >= 50 && ctx.sessionAllowed) {
    signal = "WAIT";
  }

  return { signal, score, factors, direction: dir };
}

// Generate all signals across the dataset (causal — only past data used per bar).
export function generateSignals(candles, options = {}) {
  const minScore = options.minScore || 70;
  const { context } = buildContext(candles, options);
  const signals = [];
  for (let i = 0; i < context.length; i++) {
    const result = scoreCandle(context[i], minScore);
    if (result.signal !== "WAIT" && result.score >= minScore) {
      const c = candles[i];
      const atrVal = context[i].atr;
      const sl = result.direction === "bull" ? c.low - atrVal * 0.5 : c.high + atrVal * 0.5;
      const entry = c.close;
      const risk = Math.abs(entry - sl);
      const tp1 = result.direction === "bull" ? entry + risk * 3 : entry - risk * 3;
      const tp2 = result.direction === "bull" ? entry + risk * 5 : entry - risk * 5;
      const tp3 = result.direction === "bull" ? entry + risk * 8 : entry - risk * 8;
      signals.push({
        index: i,
        time: c.time,
        direction: result.direction,
        signal: result.signal,
        score: result.score,
        factors: result.factors,
        entry,
        sl,
        tp1,
        tp2,
        tp3,
        rr: 3,
        session: context[i].session,
        atr: atrVal
      });
    }
  }
  return signals;
}