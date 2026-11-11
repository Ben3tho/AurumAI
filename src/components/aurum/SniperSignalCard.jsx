import React, { useState, useEffect } from "react";
import { Crosshair, Timer, CheckCircle2, XCircle, Zap, ShieldAlert } from "lucide-react";
import { m5CountdownMs } from "@/lib/aurum/sniperEngine";

// AURUM AI v3.1 — Sniper Entry AI card.
// Single source of truth: this card only shows an executable BUY/SELL/grade when
// the FinalSignalGate authorizes it (gate.finalSignal === BUY|SELL). When the gate
// is WAIT, it shows SETUP DETECTED / WAITING / BLOCKED — never READY or ENTER.
function fmt(v) { return v == null ? "—" : Number(v).toFixed(2); }
function fmtCountdown(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

export default function SniperSignalCard({ sniper, gate }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const authorized = !!gate && (gate.finalSignal === "BUY" || gate.finalSignal === "SELL");

  // --- BLOCKED: data degraded — engine paused ---
  if (gate?.blocked) {
    return (
      <div className="hairline rounded-lg bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Crosshair className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Sniper Entry AI</span></div>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-bear/10 text-bear text-[0.6875rem] font-data font-bold"><ShieldAlert className="w-3 h-3" />BLOCKED</span>
        </div>
        <div className="hairline rounded-md bg-bear/10 px-3 py-3">
          <div className="text-[0.625rem] uppercase tracking-[0.08em] text-bear font-data">Status</div>
          <div className="font-display font-bold text-xl mt-0.5 text-bear">DATA RE-SYNC REQUIRED</div>
          <div className="text-[0.625rem] text-aurum-text-secondary font-data mt-1">{gate.blockReason || "Data quality degraded — SMC suppressed"}</div>
        </div>
      </div>
    );
  }

  if (!sniper) {
    return (
      <div className="hairline rounded-lg bg-surface p-4">
        <div className="flex items-center gap-2 mb-2"><Crosshair className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Sniper Entry AI</span></div>
        <p className="text-[0.75rem] text-aurum-text-secondary font-data">Waiting for higher-timeframe data…</p>
      </div>
    );
  }

  const c = sniper.confluence || {};
  const countdown = m5CountdownMs(now);
  const checks = [
    { label: "D1", val: c.D1 },
    { label: "H4", val: c.H4 },
    { label: "H1", val: c.H1 },
    { label: "M15", val: c.M15 }
  ];
  const dirWord = sniper.direction === "bull" ? "bullish" : sniper.direction === "bear" ? "bearish" : "";

  // --- GATED: gate is WAIT → no executable state ---
  if (!authorized) {
    const setup = gate?.setup;
    const detected = setup?.detected;
    const setupDir = setup?.direction;
    const headline = detected ? `${setupDir} SETUP DETECTED` : "WAITING FOR CONFLUENCE";
    const headlineColor = setup?.status === "STALE" ? "text-bear" : setup?.status === "WAITING_RETEST" ? "text-gold" : "text-aurum-text-secondary";
    return (
      <div className="hairline rounded-lg bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Crosshair className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Sniper Entry AI</span></div>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-elevated text-aurum-text-secondary text-[0.6875rem] font-data font-bold"><ShieldAlert className="w-3 h-3" />{setup?.status === "STALE" ? "STALE" : "BLOCKED"}</span>
        </div>

        <div className="hairline rounded-md bg-surface-elevated px-3 py-3 mb-3">
          <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Status</div>
          <div className={`font-display font-bold text-xl mt-0.5 ${headlineColor}`}>{headline}</div>
          <div className="text-[0.625rem] text-aurum-text-secondary font-data mt-0.5">NOT CONFIRMED — Final Signal Gate = WAIT</div>
        </div>

        {/* Confluence checklist (informational only) */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {checks.map((ck) => {
            const ok = ck.val === dirWord;
            return (
              <div key={ck.label} className={`hairline rounded-md px-2 py-1.5 text-center ${ok ? "bg-bull/10" : "bg-surface-elevated"}`}>
                <div className="text-[0.625rem] font-data text-aurum-text-secondary">{ck.label}</div>
                <div className={`text-[0.625rem] font-data font-bold flex items-center justify-center gap-0.5 ${ok ? "text-bull" : "text-bear"}`}>
                  {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {(ck.val || "n/a").toUpperCase().slice(0, 4)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Gate wait reasons */}
        {gate?.waitReasons?.length > 0 && (
          <div className="hairline rounded-md bg-bear/5 px-3 py-2 mb-3">
            <div className="text-[0.625rem] uppercase tracking-[0.08em] text-bear font-data mb-1">Gate reasons</div>
            <ul className="space-y-0.5">
              {gate.waitReasons.slice(0, 4).map((r, i) => (<li key={i} className="text-[0.6875rem] font-data text-aurum-text-secondary">· {r}</li>))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-gold" />
            <span className="text-[0.6875rem] font-data text-aurum-text-secondary">M5 close in</span>
            <span className="text-[0.75rem] font-data font-bold text-gold">{fmtCountdown(countdown)}</span>
          </div>
          {sniper.newsBlock && <span className="text-[0.625rem] font-data text-bear">NEWS BLOCK</span>}
        </div>
      </div>
    );
  }

  // --- AUTHORIZED: gate cleared, show executable setup ---
  const gradeColor = sniper.grade === "A+" ? "text-gold bg-gold/10 gold-glow" : sniper.grade === "A" ? "text-bull bg-bull/10" : "text-aurum-text bg-surface-elevated";
  const dirColor = sniper.direction === "bull" ? "text-bull" : "text-bear";

  return (
    <div className={`hairline rounded-lg bg-surface p-4 ${sniper.grade === "A+" ? "gold-glow" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Crosshair className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Sniper Entry AI</span></div>
        <div className="flex items-center gap-2">
          {sniper.grade && <span className={`px-2 py-0.5 rounded text-[0.6875rem] font-data font-bold ${gradeColor}`}>{sniper.grade}</span>}
          {sniper.direction && <span className={`font-display font-bold text-sm ${dirColor}`}>{sniper.direction === "bull" ? "BUY" : "SELL"}</span>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {checks.map((ck) => {
          const ok = ck.val === dirWord;
          return (
            <div key={ck.label} className={`hairline rounded-md px-2 py-1.5 text-center ${ok ? "bg-bull/10" : "bg-surface-elevated"}`}>
              <div className="text-[0.625rem] font-data text-aurum-text-secondary">{ck.label}</div>
              <div className={`text-[0.625rem] font-data font-bold flex items-center justify-center gap-0.5 ${ok ? "text-bull" : "text-bear"}`}>
                {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {(ck.val || "n/a").toUpperCase().slice(0, 4)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-3 text-[0.6875rem] font-data">
        <Zap className={`w-3.5 h-3.5 ${sniper.m5Trigger ? "text-gold" : "text-aurum-text-secondary"}`} />
        <span className={sniper.m5Trigger ? "text-gold" : "text-aurum-text-secondary"}>
          {sniper.m5Trigger ? `M5: ${sniper.m5Trigger.sweepType} sweep + ${sniper.m5Trigger.fvgType} FVG` : "M5 trigger pending (sweep + FVG)"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Level label="Entry" value={fmt(sniper.entry)} accent />
        <Level label="Stop Loss" value={fmt(sniper.sl)} danger />
        <Level label="TP1" value={fmt(sniper.tp1)} bull />
        <Level label="TP2" value={fmt(sniper.tp2)} bull />
        <Level label="TP3" value={fmt(sniper.tp3)} bull />
        <Level label="RR → TP1" value={`1:${sniper.rr}`} accent />
      </div>
      {sniper.m5Trigger && (
        <div className="hairline rounded-md bg-surface-elevated px-3 py-2 mb-3">
          <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-0.5">Highlighted Zone</div>
          <div className="text-[0.75rem] font-data text-aurum-text">
            FVG {fmt(sniper.m5Trigger.fvgBottom)}–{fmt(sniper.m5Trigger.fvgTop)} · Sweep {fmt(sniper.m5Trigger.sweepPrice)}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-gold" />
          <span className="text-[0.6875rem] font-data text-aurum-text-secondary">M5 close in</span>
          <span className="text-[0.75rem] font-data font-bold text-gold">{fmtCountdown(countdown)}</span>
        </div>
        {sniper.newsBlock && <span className="text-[0.625rem] font-data text-bear">NEWS BLOCK</span>}
      </div>
    </div>
  );
}

function Level({ label, value, accent, danger, bull }) {
  const color = danger ? "text-bear" : bull ? "text-bull" : accent ? "text-gold" : "text-aurum-text";
  return (
    <div className="hairline rounded-md bg-surface-elevated px-3 py-2">
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{label}</div>
      <div className={`text-[0.8125rem] font-data font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}