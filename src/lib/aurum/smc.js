// Smart Money Concepts (SMC/ICT) engine.
// Detects: BOS, CHOCH, Order Blocks, Fair Value Gaps, Liquidity Sweeps, Premium/Discount.
// All detection is causal — a pattern at index i only uses data up to i.

import { findSwings } from "./indicators";

// Break of Structure & Change of Character
export function detectStructure(candles, lookback = 2) {
  const { highs, lows } = findSwings(candles, lookback);
  const events = [];
  let trend = "neutral"; // bullish | bearish | neutral
  let lastSwingHigh = null;
  let lastSwingLow = null;
  let hiPtr = 0;
  let loPtr = 0;

  for (let i = 1; i < candles.length; i++) {
    // advance confirmed swings (a swing at index s is confirmed at s+lookback)
    while (hiPtr < highs.length && highs[hiPtr].index + lookback <= i) {
      lastSwingHigh = highs[hiPtr];
      hiPtr++;
    }
    while (loPtr < lows.length && lows[loPtr].index + lookback <= i) {
      lastSwingLow = lows[loPtr];
      loPtr++;
    }

    if (lastSwingHigh && candles[i].close > lastSwingHigh.price) {
      if (trend === "bearish") {
        events.push({ index: i, type: "CHOCH", direction: "bullish", price: lastSwingHigh.price, time: candles[i].time });
      } else if (trend === "bullish" || trend === "neutral") {
        events.push({ index: i, type: "BOS", direction: "bullish", price: lastSwingHigh.price, time: candles[i].time });
      }
      trend = "bullish";
      lastSwingHigh = null;
    } else if (lastSwingLow && candles[i].close < lastSwingLow.price) {
      if (trend === "bullish") {
        events.push({ index: i, type: "CHOCH", direction: "bearish", price: lastSwingLow.price, time: candles[i].time });
      } else if (trend === "bearish" || trend === "neutral") {
        events.push({ index: i, type: "BOS", direction: "bearish", price: lastSwingLow.price, time: candles[i].time });
      }
      trend = "bearish";
      lastSwingLow = null;
    }
  }
  return { events, finalTrend: trend };
}

// Fair Value Gap — 3-candle imbalance
export function detectFVG(candles) {
  const fvgs = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    // Bullish FVG: c1.high < c3.low
    if (c1.high < c3.low) {
      fvgs.push({
        index: i - 1,
        type: "bullish",
        top: c3.low,
        bottom: c1.high,
        time: candles[i - 1].time,
        mitigated: false
      });
    }
    // Bearish FVG: c1.low > c3.high
    if (c1.low > c3.high) {
      fvgs.push({
        index: i - 1,
        type: "bearish",
        top: c1.low,
        bottom: c3.high,
        time: candles[i - 1].time,
        mitigated: false
      });
    }
  }
  // Mark mitigation
  for (const f of fvgs) {
    for (let j = f.index + 2; j < candles.length; j++) {
      if (f.type === "bullish" && candles[j].low <= f.bottom) { f.mitigated = true; break; }
      if (f.type === "bearish" && candles[j].high >= f.top) { f.mitigated = true; break; }
    }
  }
  return fvgs;
}

// Order Block — last opposite candle before an impulsive move
export function detectOrderBlocks(candles, impulseATRMult = 1.5, atrArr = null) {
  const obs = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const move = Math.abs(candles[i + 1].close - candles[i + 1].open);
    const a = atrArr ? atrArr[i] : (candles[i].high - candles[i].low);
    if (!a || a <= 0) continue;
    if (move < impulseATRMult * a) continue;
    // Bullish OB: last bearish candle before up move
    if (candles[i + 1].close > candles[i + 1].open && candles[i].close < candles[i].open) {
      obs.push({
        index: i,
        type: "bullish",
        top: Math.max(candles[i].open, candles[i].close),
        bottom: Math.min(candles[i].open, candles[i].close),
        time: candles[i].time
      });
    }
    // Bearish OB: last bullish candle before down move
    if (candles[i + 1].close < candles[i + 1].open && candles[i].close > candles[i].open) {
      obs.push({
        index: i,
        type: "bearish",
        top: Math.max(candles[i].open, candles[i].close),
        bottom: Math.min(candles[i].open, candles[i].close),
        time: candles[i].time
      });
    }
  }
  return obs;
}

// Liquidity sweep — wick beyond prior swing then rejection
export function detectLiquiditySweeps(candles, lookback = 5) {
  const sweeps = [];
  for (let i = lookback + 1; i < candles.length; i++) {
    const window = candles.slice(i - lookback, i);
    const swingHigh = Math.max(...window.map((c) => c.high));
    const swingLow = Math.min(...window.map((c) => c.low));
    const c = candles[i];
    // Buy-side liquidity sweep (above swing high) then close back below
    if (c.high > swingHigh && c.close < swingHigh) {
      sweeps.push({ index: i, type: "buy-side", price: swingHigh, time: c.time });
    }
    // Sell-side liquidity sweep (below swing low) then close back above
    if (c.low < swingLow && c.close > swingLow) {
      sweeps.push({ index: i, type: "sell-side", price: swingLow, time: c.time });
    }
  }
  return sweeps;
}

// Premium / Discount zone based on recent range
export function premiumDiscount(candles, lookback = 50) {
  if (candles.length < lookback) return null;
  const window = candles.slice(-lookback);
  const high = Math.max(...window.map((c) => c.high));
  const low = Math.min(...window.map((c) => c.low));
  const mid = (high + low) / 2;
  const price = candles[candles.length - 1].close;
  return {
    high,
    low,
    mid,
    zone: price > mid ? "premium" : "discount",
    equity: (price - mid) / ((high - low) / 2 || 1)
  };
}