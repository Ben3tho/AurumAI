import React, { useMemo } from "react";
import { detectStructure, detectFVG, detectOrderBlocks, detectLiquiditySweeps } from "@/lib/aurum/smc";
import { getActiveKillZone } from "@/lib/aurum/killZones";
import { round2 } from "@/lib/aurum/format";

// AURUM AI v3.2 — Institutional chart with live M5 candle + sweep/FVG overlay.
// Primary resolution = M5 (live updating). H1 structure (BOS/CHOCH lines, FVG
// zones, Order Blocks, liquidity sweeps) overlays as horizontal price levels.
// Active M5 sweeps + unmitigated M5 FVGs are drawn at their candle index and
// highlighted as sniper zones (gold) when they match the sniper direction.
// The forming (last) M5 candle updates in real-time with the live price.

const VISIBLE = 80;

export default function InstitutionalChart({ candles, m5Candles, sniper, livePrice }) {
  const view = useMemo(() => {
    const useM5 = m5Candles && m5Candles.length >= 30;
    const primary = useM5 ? m5Candles : (candles && candles.length >= 30 ? candles : null);
    if (!primary) return null;

    // Live-forming candle: update the last M5 candle with the live price so the
    // chart breathes in real-time. The forming candle is flagged for highlight.
    let win = primary.slice(-VISIBLE);
    const base = primary.length - win.length;
    if (useM5 && livePrice != null) {
      const last = { ...win[win.length - 1] };
      last.close = livePrice;
      last.high = Math.max(last.high, livePrice);
      last.low = Math.min(last.low, livePrice);
      win = [...win.slice(0, -1), last];
    }
    const formingIndex = useM5 ? win.length - 1 : -1;

    // M5 structures (index-local) — unmitigated FVGs + sweeps on the primary series.
    const m5Fvgs = useM5 ? detectFVG(primary).filter((f) => f.index >= base - VISIBLE && !f.mitigated).slice(-8) : [];
    const m5Sweeps = useM5 ? detectLiquiditySweeps(primary).filter((s) => s.index >= base - VISIBLE).slice(-8) : [];

    // H1 structures (price-level overlays) — from the H1 `candles` prop.
    const h1Ready = candles && candles.length >= 30;
    const h1Fvgs = h1Ready ? detectFVG(candles).filter((f) => !f.mitigated).slice(-4) : [];
    const h1Obs = h1Ready ? detectOrderBlocks(candles).slice(-4) : [];
    const h1Sweeps = h1Ready ? detectLiquiditySweeps(candles).slice(-4) : [];
    const h1Events = h1Ready ? detectStructure(candles).events.slice(-4) : [];

    // Price range across everything for the y-axis.
    const highs = win.map((c) => c.high);
    const lows = win.map((c) => c.low);
    const allPrices = [
      ...highs, ...lows,
      ...m5Fvgs.map((f) => f.top), ...m5Fvgs.map((f) => f.bottom),
      ...h1Fvgs.map((f) => f.top), ...h1Fvgs.map((f) => f.bottom),
      ...h1Obs.map((o) => o.top), ...h1Obs.map((o) => o.bottom),
      ...m5Sweeps.map((s) => s.price), ...h1Sweeps.map((s) => s.price),
      ...h1Events.map((e) => e.price)
    ];
    if (livePrice != null) allPrices.push(livePrice);
    const hi = Math.max(...allPrices);
    const lo = Math.min(...allPrices);
    const pad = Math.max((hi - lo) * 0.06, 0.5);
    return { win, base, useM5, formingIndex, m5Fvgs, m5Sweeps, h1Fvgs, h1Obs, h1Sweeps, h1Events, hi: hi + pad, lo: lo - pad };
  }, [candles, m5Candles, livePrice]);

  if (!view) {
    return (
      <div className="hairline rounded-lg bg-surface p-4">
        <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2">Institutional Chart · SMC</div>
        <p className="text-[0.75rem] text-aurum-text-secondary font-data">Import data to draw BOS, CHOCH, FVG, Order Blocks & Liquidity Sweeps.</p>
      </div>
    );
  }

  const W = 800, H = 320, PAD = 6;
  const n = view.win.length;
  const x = (i) => PAD + (i / (n - 1)) * (W - 2 * PAD);
  const y = (p) => PAD + ((view.hi - p) / (view.hi - view.lo)) * (H - 2 * PAD);
  const cw = Math.max(2, (W - 2 * PAD) / n * 0.6);
  const dirColor = sniper?.direction === "bull" ? "bullish" : sniper?.direction === "bear" ? "bearish" : null;

  return (
    <div className="hairline rounded-lg bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Institutional Chart · Live M5 · H1 Structure</span>
        <span className="text-[0.625rem] font-data text-aurum-text-secondary">
          {view.useM5 ? `M5 LIVE · ${n} bars` : `H1 · ${n} bars`}
          {livePrice != null && view.useM5 && ` · $${round2(livePrice)}`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 480 }} preserveAspectRatio="none">
          {/* Kill zone bands */}
          {view.win.map((c, i) => {
            const zones = getActiveKillZone(new Date(c.time));
            if (!zones.length) return null;
            return <rect key={`kz${i}`} x={x(i) - cw / 2} y={0} width={cw + 1} height={H} fill={zones[0].color} opacity={0.06} />;
          })}

          {/* H1 FVG zones — horizontal bands spanning the chart (HTF structure) */}
          {view.h1Fvgs.map((f, i) => {
            const want = dirColor === f.type;
            return <rect key={`h1fvg${i}`} x={0} y={y(f.top)} width={W} height={Math.max(1, y(f.bottom) - y(f.top))} fill={f.type === "bullish" ? "#22c55e" : "#ef4444"} opacity={want ? 0.10 : 0.05} />;
          })}

          {/* H1 Order Blocks — horizontal outlined bands */}
          {view.h1Obs.map((o, i) => {
            const want = dirColor === o.type;
            return <rect key={`h1ob${i}`} x={0} y={y(o.top)} width={W} height={Math.max(1, y(o.bottom) - y(o.top))} fill="none" stroke={o.type === "bullish" ? "#22c55e" : "#ef4444"} strokeWidth={want ? 1.2 : 0.8} strokeDasharray="2 2" opacity={want ? 0.6 : 0.3} />;
          })}

          {/* H1 BOS / CHOCH lines — horizontal price levels */}
          {view.h1Events.map((e, i) => {
            const col = e.direction === "bullish" ? "#22c55e" : "#ef4444";
            return (
              <g key={`h1ev${i}`}>
                <line x1={0} x2={W} y1={y(e.price)} y2={y(e.price)} stroke={col} strokeWidth={1} strokeDasharray="4 3" opacity={0.45} />
                <text x={4} y={y(e.price) - 3} fill={col} fontSize={8} fontFamily="monospace" opacity={0.8}>H1 {e.type}</text>
              </g>
            );
          })}

          {/* M5 FVG zones — index-local (sniper zones), gold-highlighted if matching */}
          {view.m5Fvgs.map((f, i) => {
            const idx = f.index - view.base;
            if (idx < 0) return null;
            const want = dirColor === f.type;
            return <rect key={`m5fvg${i}`} x={x(idx)} y={y(f.top)} width={W - PAD - x(idx)} height={Math.max(1, y(f.bottom) - y(f.top))} fill={f.type === "bullish" ? "#22c55e" : "#ef4444"} opacity={want ? 0.30 : 0.14} stroke={want ? "#eab308" : "none"} strokeWidth={want ? 1.2 : 0} />;
          })}

          {/* M5 candles (last = live forming candle, gold-outlined) */}
          {view.win.map((c, i) => {
            const up = c.close >= c.open;
            const col = up ? "#22c55e" : "#ef4444";
            const bodyTop = y(Math.max(c.open, c.close));
            const bodyBot = y(Math.min(c.open, c.close));
            const isForming = i === view.formingIndex;
            return (
              <g key={`c${i}`}>
                <line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={col} strokeWidth={isForming ? 1.5 : 1} />
                <rect x={x(i) - cw / 2} y={bodyTop} width={cw} height={Math.max(1, bodyBot - bodyTop)} fill={col} opacity={isForming ? 1 : 0.9} stroke={isForming ? "#eab308" : "none"} strokeWidth={isForming ? 1.2 : 0} />
              </g>
            );
          })}

          {/* H1 liquidity sweep markers (price level, right edge) */}
          {view.h1Sweeps.map((s, i) => {
            const col = s.type === "buy-side" ? "#ef4444" : "#22c55e";
            return <circle key={`h1sw${i}`} cx={W - PAD} cy={y(s.price)} r={3} fill={col} opacity={0.55} />;
          })}

          {/* M5 liquidity sweep markers — highlighted if sniper trigger match */}
          {view.m5Sweeps.map((s, i) => {
            const idx = s.index - view.base;
            if (idx < 0) return null;
            const want = sniper?.m5Trigger && ((sniper.direction === "bull" && s.type === "sell-side") || (sniper.direction === "bear" && s.type === "buy-side"));
            const col = s.type === "buy-side" ? "#ef4444" : "#22c55e";
            return <circle key={`m5sw${i}`} cx={x(idx)} cy={y(s.price)} r={want ? 4.5 : 2.8} fill={col} stroke={want ? "#eab308" : "none"} strokeWidth={want ? 1.5 : 0} />;
          })}

          {/* Live price line (real-time, M5 only) */}
          {livePrice != null && view.useM5 && (
            <g>
              <line x1={0} x2={W} y1={y(livePrice)} y2={y(livePrice)} stroke="#eab308" strokeWidth={1} strokeDasharray="2 3" opacity={0.8} />
              <rect x={W - 52} y={y(livePrice) - 7} width={48} height={14} fill="#eab308" rx={2} />
              <text x={W - 28} y={y(livePrice) + 3} fill="#0B0D11" fontSize={9} fontFamily="monospace" fontWeight="bold" textAnchor="middle">{round2(livePrice)}</text>
            </g>
          )}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 mt-2 text-[0.625rem] font-data">
        <span className="text-bull">━ H1 BOS/CHOCH bull</span>
        <span className="text-bear">━ H1 BOS/CHOCH bear</span>
        <span className="text-bull">▮ M5 FVG bull</span>
        <span className="text-bear">▮ M5 FVG bear</span>
        <span className="text-gold">▮ highlighted sniper zone</span>
        <span className="text-gold">● live M5 sweep trigger</span>
        <span className="text-gold">─ live price</span>
      </div>
    </div>
  );
}