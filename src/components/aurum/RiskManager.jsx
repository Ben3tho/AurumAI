import React, { useState } from "react";
import { Shield, Calculator } from "lucide-react";
import { buildRiskPlan } from "@/lib/aurum/riskManager";

// AURUM AI v3.0 — AI Risk Manager. Computes lot size for a target account risk %
// and the full RR ladder for the active sniper signal.
export default function RiskManager({ direction, entry, sl, tp1, tp2, tp3 }) {
  const [account, setAccount] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);

  const plan = (entry != null && sl != null)
    ? buildRiskPlan({ accountSize: account, riskPercent: riskPct, direction, entry, sl, tp1, tp2, tp3 })
    : null;

  const fmt2 = (v) => (v == null ? "—" : Number(v).toFixed(2));

  return (
    <div className="hairline rounded-lg bg-surface p-4">
      <div className="flex items-center gap-2 mb-3"><Shield className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">AI Risk Manager</span></div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-[0.625rem] font-data text-aurum-text-secondary">Account ($)</span>
          <input type="number" value={account} onChange={(e) => setAccount(Number(e.target.value))} className="w-full mt-0.5 px-2 py-1.5 rounded-md hairline bg-surface-elevated text-aurum-text font-data text-sm focus:outline-none focus:ring-1 ring-gold" />
        </label>
        <label className="block">
          <span className="text-[0.625rem] font-data text-aurum-text-secondary">Risk per trade (%)</span>
          <input type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} className="w-full mt-0.5 px-2 py-1.5 rounded-md hairline bg-surface-elevated text-aurum-text font-data text-sm focus:outline-none focus:ring-1 ring-gold" />
        </label>
      </div>

      {!plan ? (
        <p className="text-[0.75rem] text-aurum-text-secondary font-data flex items-center gap-1.5"><Calculator className="w-3.5 h-3.5" /> No active signal — waiting for sniper setup.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Lot Size" value={plan.lot} accent />
          <Metric label="Risk $" value={`$${plan.riskUSD.toFixed(2)}`} />
          <Metric label="SL Distance" value={`$${plan.slDistance}`} />
          <Metric label="RR → TP1" value={`1:${plan.rr1}`} accent />
          <Metric label="RR → TP2" value={`1:${plan.rr2}`} />
          <Metric label="RR → TP3" value={`1:${plan.rr3}`} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className="hairline rounded-md bg-surface-elevated px-3 py-2">
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{label}</div>
      <div className={`text-[0.875rem] font-data font-bold mt-0.5 ${accent ? "text-gold" : "text-aurum-text"}`}>{value}</div>
    </div>
  );
}