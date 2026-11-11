import React from "react";
import { Shield, ShieldAlert } from "lucide-react";

// AURUM AI v3.1 — Live Signal & Execution Card.
// Single source of truth: displays BUY/SELL only when the FinalSignalGate
// authorizes it. When the gate is WAIT, it shows WAIT / BLOCKED and withholds
// executable levels (shown as NOT CONFIRMED).
export default function LiveSignalCard({ gate, sniper, hasData, livePrice, accountSize = 10000, riskPct = 1 }) {
  if (!hasData || !gate) {
    return (
      <Card title="Live Signal & Execution">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Shield className="w-8 h-8 text-aurum-text-secondary mb-3" />
          <p className="text-sm text-aurum-text-secondary font-data">No active signal</p>
          <p className="text-[0.75rem] text-aurum-text-secondary mt-1">Import XAUUSD CSV to compute</p>
        </div>
      </Card>
    );
  }

  const authorized = gate.finalSignal === "BUY" || gate.finalSignal === "SELL";

  // --- BLOCKED: data degraded — engine paused, no execution ---
  if (gate.blocked) {
    return (
      <Card title="Live Signal & Execution">
        <div className="rounded-md px-4 py-3 mb-4 bg-bear/10 bear-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-bear" />
              <span className="font-display font-bold text-2xl text-bear">BLOCKED</span>
            </div>
            <div className="text-right">
              <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Status</span>
              <div className="font-display font-bold text-sm text-bear">DATA RE-SYNC</div>
            </div>
          </div>
          <div className="mt-2 text-[0.75rem] font-data text-bear">{gate.blockReason || "DATA RE-SYNC REQUIRED"}</div>
        </div>
        <div className="space-y-px">
          {[["Entry","NOT CONFIRMED"],["Stop Loss","NOT CONFIRMED"],["TP1 (3R)","NOT CONFIRMED"],["TP2 (5R)","NOT CONFIRMED"],["TP3 (8R)","NOT CONFIRMED"]].map(([l,v]) => (
            <div key={l} className="flex items-center justify-between py-2 border-b hairline last:border-0">
              <span className="text-[0.8125rem] text-aurum-text-secondary font-data">{l}</span>
              <span className="text-[0.8125rem] font-data text-aurum-text-secondary">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t hairline">
          <p className="text-[0.6875rem] text-aurum-text-secondary font-data">Trade calculations bypassed until data quality is OK.</p>
        </div>
      </Card>
    );
  }

  // --- GATED: WAIT → no executable signal ---
  if (!authorized) {
    const setup = gate.setup;
    const headline = setup?.detected ? "BLOCKED" : "WAIT";
    return (
      <Card title="Live Signal & Execution">
        <div className="rounded-md px-4 py-3 mb-4 bg-surface-elevated">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-gold" />
              <span className="font-display font-bold text-3xl text-gold">{headline}</span>
            </div>
            <div className="text-right">
              <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Gate</span>
              <div className="font-display font-bold text-xl text-aurum-text-secondary">WAIT</div>
            </div>
          </div>
          {setup?.detected && (
            <div className="mt-2 text-[0.75rem] font-data text-gold">
              {setup.direction} SETUP DETECTED — NOT CONFIRMED
            </div>
          )}
          {gate.waitReasons?.length > 0 && (
            <div className="mt-1 text-[0.6875rem] text-aurum-text-secondary font-data">
              {gate.waitReasons[0]}
            </div>
          )}
        </div>

        <div className="space-y-px">
          {[
            { label: "Entry", value: "NOT CONFIRMED" },
            { label: "Stop Loss", value: "NOT CONFIRMED" },
            { label: "TP1 (3R)", value: "NOT CONFIRMED" },
            { label: "TP2 (5R)", value: "NOT CONFIRMED" },
            { label: "TP3 (8R)", value: "NOT CONFIRMED" }
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2 border-b hairline last:border-0">
              <span className="text-[0.8125rem] text-aurum-text-secondary font-data">{r.label}</span>
              <span className="text-[0.8125rem] font-data text-aurum-text-secondary">{r.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t hairline">
          <p className="text-[0.6875rem] text-aurum-text-secondary font-data">Execution withheld until the 14-rule gate clears.</p>
        </div>
      </Card>
    );
  }

  // --- AUTHORIZED ---
  const tv = gate.tradeValidation;
  const isBull = gate.finalSignal === "BUY";
  const entry = tv?.entry;
  const sl = tv?.sl;
  const tp1 = tv?.tp1;
  const tp2 = sniper?.tp2;
  const tp3 = sniper?.tp3;
  const risk = entry != null && sl != null ? Math.abs(entry - sl) : 0;
  const riskAmount = accountSize * (riskPct / 100);
  const lotSize = risk > 0 ? riskAmount / (risk * 100) : 0;

  let liveStatus = null;
  if (livePrice != null && entry != null && sl != null && tp1 != null) {
    if (isBull) {
      if (livePrice >= tp1) liveStatus = "TP HIT";
      else if (livePrice <= sl) liveStatus = "SL HIT";
    } else {
      if (livePrice <= tp1) liveStatus = "TP HIT";
      else if (livePrice >= sl) liveStatus = "SL HIT";
    }
  }

  const rows = [
    { label: "Entry", value: entry != null ? `$${entry.toFixed(2)}` : "—", color: "text-aurum-text" },
    { label: "Stop Loss", value: sl != null ? `$${sl.toFixed(2)}` : "—", color: "text-bear", hit: liveStatus === "SL HIT" },
    { label: "TP1 (3R)", value: tp1 != null ? `$${tp1.toFixed(2)}` : "—", color: "text-bull", hit: liveStatus === "TP HIT" },
    { label: "TP2 (5R)", value: tp2 != null ? `$${tp2.toFixed(2)}` : "—", color: "text-bull" },
    { label: "TP3 (8R)", value: tp3 != null ? `$${tp3.toFixed(2)}` : "—", color: "text-bull" },
    { label: "Lot Size", value: lotSize.toFixed(3), color: "text-gold" },
    { label: "Risk Amount", value: `$${riskAmount.toFixed(2)}`, color: "text-aurum-text" }
  ];

  return (
    <Card title="Live Signal & Execution" accent={isBull ? "bull" : "bear"}>
      <div className={`rounded-md px-4 py-3 mb-4 ${isBull ? "bg-bull/10 bull-glow" : "bg-bear/10 bear-glow"}`}>
        <div className="flex items-center justify-between">
          <span className={`font-display font-bold text-3xl ${liveStatus === "TP HIT" ? "text-bull" : liveStatus === "SL HIT" ? "text-bear" : isBull ? "text-bull" : "text-bear"}`}>
            {liveStatus || gate.finalSignal}
          </span>
          <div className="text-right">
            <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Min R:R</span>
            <div className="font-display font-bold text-xl text-gold">1 : 3</div>
          </div>
        </div>
        {livePrice != null && (
          <div className="mt-2 text-[0.75rem] text-aurum-text-secondary font-data">
            Live price · ${livePrice.toFixed(2)}{liveStatus ? ` → ${liveStatus}` : ""}
          </div>
        )}
      </div>

      <div className="space-y-px">
        {rows.map((r) => (
          <div key={r.label} className={`flex items-center justify-between py-2 border-b hairline last:border-0 ${r.hit ? "bg-gold/5" : ""}`}>
            <span className="text-[0.8125rem] text-aurum-text-secondary font-data">{r.label}{r.hit ? " ✓" : ""}</span>
            <span className={`text-[0.8125rem] font-data font-medium ${r.color}`}>{r.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t hairline">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Risk:Reward Meter</span>
          <span className="text-[0.75rem] text-gold font-data font-medium">1:3 minimum</span>
        </div>
        <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
          <div className="h-full bg-gradient-to-r from-bear via-gold to-bull" style={{ width: "75%" }} />
        </div>
      </div>
    </Card>
  );
}

function Card({ title, children, accent }) {
  return (
    <div className={`hairline rounded-lg bg-surface ${accent === "bull" ? "bull-glow" : accent === "bear" ? "bear-glow" : ""}`}>
      <div className="px-4 py-3 border-b hairline">
        <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}