import React, { useMemo, useState } from "react";
import { Crosshair, Shield, ShieldAlert, Zap } from "lucide-react";
import { buildRiskPlan } from "@/lib/aurum/riskManager";
import { round2 } from "@/lib/aurum/format";

// AURUM AI v3.2 — Mobile Execution Cockpit.
// One thumb-reachable card combining: sniper signal state (BUY/SELL/WAIT/
// BLOCKED), a compact live M5 chart snippet, and AI risk controls (lot/SL/
// TP/Risk$). Designed for the mobile viewport — all critical metrics visible
// without scrolling. The signal state follows the Final Signal Gate (single
// source of truth); risk metrics only render when the gate authorizes.

const RISK_PRESETS = [0.5, 1, 2];

export default function ExecutionCockpit({ gate, sniper, m5Candles, livePrice }) {
  const [account, setAccount] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);

  const authorized = !!gate && (gate.finalSignal === "BUY" || gate.finalSignal === "SELL");
  const blocked = !!gate?.blocked;
  const dir = sniper?.direction === "bull" ? "BUY" : sniper?.direction === "bear" ? "SELL" : null;

  const tv = gate?.tradeValidation;
  const entry = authorized ? tv?.entry : sniper?.entry;
  const sl = authorized ? tv?.sl : sniper?.sl;
  const tp1 = authorized ? tv?.tp1 : sniper?.tp1;
  const tp2 = sniper?.tp2;
  const tp3 = sniper?.tp3;

  const plan = (entry != null && sl != null)
    ? buildRiskPlan({ accountSize: account, riskPercent: riskPct, direction: dir, entry, sl, tp1, tp2, tp3 })
    : null;

  // Compact M5 chart snippet (last 30 candles + live price line).
  const snippet = useMemo(() => {
    if (!m5Candles || m5Candles.length < 10) return null;
    let win = m5Candles.slice(-30);
    if (livePrice != null) {
      const last = { ...win[win.length - 1] };
      last.close = livePrice;
      last.high = Math.max(last.high, livePrice);
      last.low = Math.min(last.low, livePrice);
      win = [...win.slice(0, -1), last];
    }
    const hi = Math.max(...win.map((c) => c.high));
    const lo = Math.min(...win.map((c) => c.low));
    const pad = Math.max((hi - lo) * 0.08, 0.5);
    return { win, hi: hi + pad, lo: lo - pad };
  }, [m5Candles, livePrice]);

  const fmt = (v) => (v == null ? "—" : Number(v).toFixed(2));

  let badge;
  if (blocked) badge = { text: "BLOCKED", color: "text-bear", bg: "bg-bear/10", Icon: ShieldAlert };
  else if (authorized) badge = { text: gate.finalSignal, color: gate.finalSignal === "BUY" ? "text-bull" : "text-bear", bg: gate.finalSignal === "BUY" ? "bg-bull/10" : "bg-bear/10", Icon: Zap };
  else badge = { text: "WAIT", color: "text-gold", bg: "bg-surface-elevated", Icon: Shield };
  const { Icon: BadgeIcon } = badge;

  // Mini chart geometry.
  const W = 260, H = 80, PAD = 4;
  const n = snippet?.win.length || 0;
  const x = (i) => PAD + (i / Math.max(1, n - 1)) * (W - 2 * PAD);
  const yc = (p) => PAD + ((snippet.hi - p) / (snippet.hi - snippet.lo)) * (H - 2 * PAD);
  const cw = n ? Math.max(1.5, (W - 2 * PAD) / n * 0.6) : 0;

  return (
    <div className={`hairline rounded-lg bg-surface p-3 ${authorized ? (gate.finalSignal === "BUY" ? "bull-glow" : "bear-glow") : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5"><Crosshair className="w-3.5 h-3.5 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Execution Cockpit</span></div>
        {sniper?.grade && authorized && <span className="px-1.5 py-0.5 rounded text-[0.625rem] font-data font-bold bg-gold/10 text-gold">{sniper.grade}</span>}
      </div>

      {/* Signal + Confluence */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex-1 flex items-center gap-2 rounded-md px-3 py-2 ${badge.bg}`}>
          <BadgeIcon className={`w-5 h-5 ${badge.color}`} />
          <span className={`font-display font-bold text-2xl ${badge.color}`}>{badge.text}</span>
        </div>
        <div className="hairline rounded-md bg-surface-elevated px-2.5 py-2 text-center min-w-[64px]">
          <div className="text-[0.5625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Confluence</div>
          <div className="font-display font-bold text-lg text-gold">{gate?.confluence?.score ?? "—"}</div>
        </div>
      </div>

      {/* Live M5 chart snippet */}
      {snippet ? (
        <div className="hairline rounded-md bg-surface-elevated p-1.5 mb-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 80 }}>
            {snippet.win.map((c, i) => {
              const up = c.close >= c.open;
              const col = up ? "#22c55e" : "#ef4444";
              const bt = yc(Math.max(c.open, c.close));
              const bb = yc(Math.min(c.open, c.close));
              const forming = i === n - 1;
              return (
                <g key={i}>
                  <line x1={x(i)} x2={x(i)} y1={yc(c.high)} y2={yc(c.low)} stroke={col} strokeWidth={1} />
                  <rect x={x(i) - cw / 2} y={bt} width={cw} height={Math.max(1, bb - bt)} fill={col} opacity={forming ? 1 : 0.85} stroke={forming ? "#eab308" : "none"} strokeWidth={forming ? 1 : 0} />
                </g>
              );
            })}
            {livePrice != null && <line x1={0} x2={W} y1={yc(livePrice)} y2={yc(livePrice)} stroke="#eab308" strokeWidth={1} strokeDasharray="2 2" opacity={0.8} />}
          </svg>
          <div className="flex items-center justify-between px-1 mt-0.5">
            <span className="text-[0.5625rem] font-data text-aurum-text-secondary">M5 LIVE · {n}</span>
            {livePrice != null && <span className="text-[0.5625rem] font-data text-gold">${round2(livePrice)}</span>}
          </div>
        </div>
      ) : (
        <div className="hairline rounded-md bg-surface-elevated p-3 mb-2 text-center"><span className="text-[0.625rem] font-data text-aurum-text-secondary">M5 data loading…</span></div>
      )}

      {/* Risk controls — quick-action toggle chips */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <label className="block">
          <span className="text-[0.5625rem] font-data text-aurum-text-secondary">Account ($)</span>
          <input type="number" value={account} onChange={(e) => setAccount(Number(e.target.value))} className="w-full mt-0.5 px-2 py-1.5 rounded-md hairline bg-surface-elevated text-aurum-text font-data text-xs focus:outline-none focus:ring-1 ring-gold" />
        </label>
        <div>
          <span className="text-[0.5625rem] font-data text-aurum-text-secondary">Risk %</span>
          <div className="flex gap-1 mt-0.5">
            {RISK_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setRiskPct(p)} className={`flex-1 py-1.5 rounded-md text-[0.625rem] font-data font-bold transition-colors ${riskPct === p ? "bg-gold text-[#0B0D11]" : "hairline bg-surface-elevated text-aurum-text-secondary"}`}>{p}%</button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-4 gap-1">
        <Cell label="Lot" value={plan ? plan.lot.toFixed(2) : "—"} accent />
        <Cell label="Risk $" value={plan ? `$${plan.riskUSD.toFixed(0)}` : "—"} />
        <Cell label="Entry" value={fmt(entry)} />
        <Cell label="SL" value={fmt(sl)} danger />
        <Cell label="TP1" value={fmt(tp1)} bull />
        <Cell label="TP2" value={fmt(tp2)} bull />
        <Cell label="TP3" value={fmt(tp3)} bull />
        <Cell label="RR→1" value={plan ? `1:${plan.rr1}` : "—"} accent />
      </div>

      {!plan && (
        <p className="text-[0.625rem] font-data text-aurum-text-secondary mt-2 text-center">
          {blocked ? "Data degraded — re-sync required." : "No authorized signal — gate is WAIT."}
        </p>
      )}
    </div>
  );
}

function Cell({ label, value, accent, danger, bull }) {
  const color = danger ? "text-bear" : bull ? "text-bull" : accent ? "text-gold" : "text-aurum-text";
  return (
    <div className="hairline rounded-md bg-surface-elevated px-1.5 py-1.5 text-center">
      <div className="text-[0.5rem] uppercase tracking-[0.06em] text-aurum-text-secondary font-data">{label}</div>
      <div className={`text-[0.6875rem] font-data font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}