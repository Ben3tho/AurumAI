import React from "react";
import { Activity, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, ShieldAlert } from "lucide-react";

// AURUM AI v3.1 — M15 + H1 Confluence card.
// Single source of truth: the displayed state is derived from the FinalSignalGate.
// When the gate is WAIT, this card shows WAIT / WAITING FOR RETEST / STALE /
// {DIR} SETUP DETECTED — never READY or ENTER NOW. Only when the gate authorizes
// a BUY/SELL can it show ENTER NOW / READY.
export default function M15H1ConfluenceCard({ confluence, livePrice, gate }) {
  if (!confluence) {
    return (
      <div className="hairline rounded-lg bg-surface p-4">
        <Header />
        <p className="text-[0.75rem] text-aurum-text-secondary font-data mt-3">Import M15 data to build H1 + M15 confluence.</p>
      </div>
    );
  }

  const { direction, aligned, h1Trend, h1BOS, h1CHOCH, h1LastEvent, m15FVG, m15OB, m15Sweep, entryZone, sl, tp1, tp2, tp3, rr, reasons } = confluence;
  const authorized = !!gate && (gate.finalSignal === "BUY" || gate.finalSignal === "SELL");

  // --- BLOCKED: data degraded — engine paused ---
  if (gate?.blocked) {
    return (
      <div className="hairline rounded-lg bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b hairline flex items-center justify-between">
          <Header />
          <span className="text-[0.625rem] text-bear font-data font-bold">BLOCKED</span>
        </div>
        <div className="px-4 py-4 bg-bear/10">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-bear" />
            <span className="font-display font-bold text-2xl text-bear">DATA RE-SYNC REQUIRED</span>
          </div>
          <p className="text-[0.625rem] text-aurum-text-secondary font-data mt-2">{gate.blockReason || "Data quality degraded — SMC suppressed, resync required."}</p>
        </div>
      </div>
    );
  }

  // Derive display state from the gate (single source of truth).
  let state = "WAIT";
  if (authorized && aligned && entryZone) {
    const p = livePrice;
    const inZone = p != null && p >= entryZone.bottom && p <= entryZone.top;
    state = inZone ? "ENTER NOW" : "READY";
  } else if (!authorized) {
    const s = gate?.setup?.status;
    if (s === "WAITING_RETEST") state = "WAITING FOR RETEST";
    else if (s === "STALE") state = "STALE";
    else if (gate?.setup?.detected) state = `${gate.setup.direction} SETUP DETECTED`;
    else state = "WAIT";
  }

  const stateStyle = {
    "WAIT": "text-aurum-text-secondary",
    "READY": "text-gold",
    "ENTER NOW": "text-bull",
    "WAITING FOR RETEST": "text-gold",
    "STALE": "text-bear",
    "BUY SETUP DETECTED": "text-gold",
    "SELL SETUP DETECTED": "text-gold"
  }[state] || "text-aurum-text-secondary";
  const stateGlow = state === "ENTER NOW" ? "bull-glow" : (state === "READY" || state === "WAITING FOR RETEST") ? "gold-glow" : "";

  const entry = livePrice != null ? livePrice : (entryZone ? (entryZone.top + entryZone.bottom) / 2 : null);
  const fmt = (v) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);

  return (
    <div className={`hairline rounded-lg bg-surface overflow-hidden ${stateGlow}`}>
      <div className="px-4 py-3 border-b hairline flex items-center justify-between">
        <Header />
        <span className="text-[0.625rem] text-aurum-text-secondary font-data">M15 · H1</span>
      </div>

      {/* State banner */}
      <div className={`px-4 py-4 ${state === "ENTER NOW" ? "bg-bull/10" : state === "READY" ? "bg-gold/10" : state === "STALE" ? "bg-bear/10" : "bg-surface-elevated"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {state === "ENTER NOW" ? <CheckCircle2 className="w-6 h-6 text-bull" /> : state === "STALE" ? <ShieldAlert className="w-6 h-6 text-bear" /> : <Clock className="w-6 h-6 text-gold" />}
            <span className={`font-display font-bold text-2xl sm:text-3xl ${stateStyle}`}>{state}</span>
          </div>
          {direction && (
            <div className="flex items-center gap-1.5">
              {direction === "BUY" ? <ArrowUpRight className="w-5 h-5 text-bull" /> : <ArrowDownRight className="w-5 h-5 text-bear" />}
              <span className={`font-display font-bold text-lg ${direction === "BUY" ? "text-bull" : "text-bear"}`}>{direction}</span>
            </div>
          )}
        </div>
        {!authorized && (
          <div className="text-[0.625rem] text-aurum-text-secondary font-data mt-2">NOT CONFIRMED — Final Signal Gate = WAIT</div>
        )}
      </div>

      {/* H1 trend + M15 setup */}
      <div className="grid grid-cols-2 gap-px bg-hairline">
        <div className="bg-surface px-3 py-2.5">
          <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">H1 Trend</div>
          <div className={`font-display font-bold text-base mt-0.5 ${h1Trend === "bullish" ? "text-bull" : h1Trend === "bearish" ? "text-bear" : "text-aurum-text-secondary"}`}>
            {h1Trend === "bullish" ? "BULLISH" : h1Trend === "bearish" ? "BEARISH" : "NEUTRAL"}
          </div>
          <div className="text-[0.625rem] text-aurum-text-secondary font-data mt-0.5">{h1BOS} BOS · {h1CHOCH} CHOCH</div>
        </div>
        <div className="bg-surface px-3 py-2.5">
          <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">M15 Setup</div>
          <div className="font-data font-bold text-[0.75rem] mt-0.5 text-aurum-text">
            {m15FVG ? "FVG" : m15OB ? "OB" : "—"}
            {m15Sweep ? " + Sweep" : ""}
          </div>
          <div className="text-[0.625rem] text-aurum-text-secondary font-data mt-0.5">
            {entryZone ? `Zone ${fmt(entryZone.bottom)}–${fmt(entryZone.top)}` : "no aligned zone"}
          </div>
        </div>
      </div>

      {/* Levels — only when authorized */}
      {authorized && aligned && entryZone ? (
        <div className="grid grid-cols-4 gap-px bg-hairline">
          <Cell label="Entry" value={fmt(entry)} />
          <Cell label="SL" value={fmt(sl)} color="text-bear" />
          <Cell label="TP1" value={fmt(tp1)} color="text-bull" />
          <Cell label="RR" value={`1:${rr}`} />
          <Cell label="TP2" value={fmt(tp2)} color="text-bull" />
          <Cell label="TP3" value={fmt(tp3)} color="text-bull" />
          <div className="bg-surface px-3 py-2 col-span-2">
            <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Live Price</div>
            <div className="font-data font-bold text-[0.8125rem] text-gold mt-0.5">{fmt(livePrice)}</div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 text-[0.75rem] text-aurum-text-secondary font-data">
          {authorized ? "Waiting for H1 + M15 alignment" : "Levels withheld — gate not authorized"}
        </div>
      )}

      {/* Reasons */}
      {reasons?.length > 0 && (
        <div className="px-4 py-3 border-t hairline">
          <ul className="space-y-1">
            {reasons.slice(0, 5).map((r, i) => (
              <li key={i} className="text-[0.6875rem] font-data text-aurum-text-secondary flex items-start gap-1.5">
                <Activity className="w-3 h-3 mt-0.5 text-gold flex-shrink-0" /> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <Activity className="w-4 h-4 text-gold" />
      <span className="font-display font-bold text-sm text-aurum-text">M15 + H1 Confluence</span>
    </div>
  );
}

function Cell({ label, value, color = "text-aurum-text" }) {
  return (
    <div className="bg-surface px-3 py-2">
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{label}</div>
      <div className={`text-[0.8125rem] font-data font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}