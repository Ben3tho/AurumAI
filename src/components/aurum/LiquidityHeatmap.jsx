import React from "react";
import { Flame } from "lucide-react";

// AURUM AI v3.0 — Liquidity Heatmap.
// Vertical price ladder: buy-side liquidity (above price) and sell-side
// (below), bar width = resting liquidity strength. Sweeps = mitigated.

export default function LiquidityHeatmap({ heatmap }) {
  if (!heatmap || !heatmap.currentPrice) {
    return (
      <div className="hairline rounded-lg bg-surface p-4">
        <div className="flex items-center gap-2 mb-2"><Flame className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Liquidity Heatmap</span></div>
        <p className="text-[0.75rem] text-aurum-text-secondary font-data">Import data to map resting liquidity.</p>
      </div>
    );
  }

  const { buySide, sellSide, sweeps, currentPrice } = heatmap;
  const allPrices = [...buySide.map((l) => l.price), ...sellSide.map((l) => l.price), currentPrice];
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const span = max - min || 1;
  const pos = (p) => ((max - p) / span) * 100; // top %
  const maxStrength = Math.max(1, ...buySide.map((l) => l.strength), ...sellSide.map((l) => l.strength));

  const fmt = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div className="hairline rounded-lg bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Flame className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Liquidity Heatmap</span></div>
        <span className="text-[0.625rem] text-aurum-text-secondary font-data">{sweeps.length} sweeps · {buySide.length + sellSide.length} pools</span>
      </div>

      <div className="relative h-64 bg-surface-elevated rounded-md overflow-hidden">
        {/* current price line */}
        <div className="absolute w-full h-px bg-gold" style={{ top: `${pos(currentPrice)}%` }}>
          <span className="absolute right-1 -translate-y-1/2 text-[0.625rem] font-data font-bold text-gold bg-[#0B0D11]/80 px-1 rounded">{fmt(currentPrice)}</span>
        </div>

        {/* buy-side (above) */}
        {buySide.map((l, i) => (
          <div key={`b${i}`} className="absolute h-5 flex items-center" style={{ top: `${pos(l.price)}%`, width: `${(l.strength / maxStrength) * 70}%` }}>
            <div className="h-1.5 w-full bg-bear/60 rounded-r" />
            <span className="ml-1 text-[0.6rem] font-data text-bear">{fmt(l.price)}</span>
          </div>
        ))}

        {/* sell-side (below) */}
        {sellSide.map((l, i) => (
          <div key={`s${i}`} className="absolute h-5 flex items-center justify-end" style={{ top: `${pos(l.price)}%`, right: 0, width: `${(l.strength / maxStrength) * 70}%` }}>
            <span className="mr-1 text-[0.6rem] font-data text-bull">{fmt(l.price)}</span>
            <div className="h-1.5 w-full bg-bull/60 rounded-l" />
          </div>
        ))}

        {/* sweep markers */}
        {sweeps.slice(-10).map((s, i) => (
          <div key={`sw${i}`} className="absolute w-1.5 h-1.5 rounded-full" style={{ top: `${pos(s.price)}%`, left: `${s.type === "buy-side" ? 2 : 4}%`, backgroundColor: s.type === "buy-side" ? "#ef4444" : "#22c55e", opacity: 0.7 }} title={`${s.type} sweep @ ${fmt(s.price)}`} />
        ))}
      </div>

      <div className="flex justify-between mt-2 text-[0.625rem] font-data">
        <span className="text-bear">▲ Buy-side (above)</span>
        <span className="text-bull">Sell-side (below) ▼</span>
      </div>
    </div>
  );
}