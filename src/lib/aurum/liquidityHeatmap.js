// AURUM AI v3.0 — Liquidity Heatmap.
// Maps resting buy-side (above price) and sell-side (below price) liquidity
// from recent swing highs/lows, weighted by recency and tap proximity.
// Sweep events are flagged as "mitigated" liquidity (already taken).

import { findSwings } from "./indicators";

export function computeLiquidityHeatmap(candles, lookback = 600) {
  if (!candles || candles.length < 30) {
    return { buySide: [], sellSide: [], sweeps: [], currentPrice: null };
  }
  const window = candles.slice(-lookback);
  const base = candles.length - window.length; // index offset into full series
  const { highs, lows } = findSwings(window, 3);
  const currentPrice = window[window.length - 1].close;

  // Recency weight: newer pivots matter more (1 at the end, decaying toward 0).
  const n = window.length;
  const recency = (idx) => 1 - (n - 1 - idx) / n;

  // Tap count: how many candles touched within a tolerance band around the level.
  const tol = (Math.max(...window.map((c) => c.high)) - Math.min(...window.map((c) => c.low))) * 0.0015;

  const buildLevels = (pivots, side) => {
    const levels = [];
    for (const p of pivots) {
      let taps = 0;
      for (const c of window) {
        if (side === "buy" && Math.abs(c.high - p.price) <= tol) taps++;
        if (side === "sell" && Math.abs(c.low - p.price) <= tol) taps++;
      }
      levels.push({
        price: p.price,
        strength: Math.round((recency(p.index) * (1 + taps * 0.25)) * 100) / 100,
        taps,
        distance: Math.abs(p.price - currentPrice)
      });
    }
    return levels;
  };

  let buySide = buildLevels(highs, "buy").filter((l) => l.price > currentPrice);
  let sellSide = buildLevels(lows, "sell").filter((l) => l.price < currentPrice);

  // Keep strongest, closest levels.
  buySide.sort((a, b) => b.strength - a.strength);
  sellSide.sort((a, b) => b.strength - a.strength);
  buySide = buySide.slice(0, 8);
  sellSide = sellSide.slice(0, 8);

  // Recent sweeps (mitigated liquidity) from the full candle set.
  const sweeps = [];
  // Lightweight sweep detection inline (avoid importing detectLiquiditySweeps cost).
  const lk = 5;
  const start = Math.max(lk + 1, candles.length - lookback);
  for (let i = start; i < candles.length; i++) {
    const w = candles.slice(i - lk, i);
    const sh = Math.max(...w.map((c) => c.high));
    const sl = Math.min(...w.map((c) => c.low));
    const c = candles[i];
    if (c.high > sh && c.close < sh) sweeps.push({ type: "buy-side", price: sh, time: c.time });
    if (c.low < sl && c.close > sl) sweeps.push({ type: "sell-side", price: sl, time: c.time });
  }

  return { buySide, sellSide, sweeps, currentPrice };
}