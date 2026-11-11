import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Database, Scale, Crosshair, Target, Shield, Newspaper, RefreshCw, Radio } from "lucide-react";
import { checkCardConsistency } from "@/lib/aurum/cardConsistency";
import useNewsCountdown, { formatCountdown } from "@/hooks/useNewsCountdown";

// AURUM AI v3.2 — Signal Status Board.
// The single authoritative dashboard: DATA, BIAS, SETUP, SIGNAL, RISK, NEWS +
// the 7-factor Confluence breakdown and the 14-rule final gate.
// v3.2 adds: one-click "Re-sync Data" button (BLOCKED state) + live news-pause
// countdown banner with an injected "HIGH IMPACT NEWS EVENT ACTIVE" gate reason.
export default function SignalStatusBoard({ gate, hasData, livePrice, isLive, dataUpdatedThrough, backfilling, histError, fileName, onResync, resyncing, newsBlock, newsEvents, lastSyncedAt }) {
  const newsCountdown = useNewsCountdown(newsEvents, newsBlock);
  const syncedLabel = formatSynced(lastSyncedAt);

  if (!hasData || !gate) {
    return (
      <div className="hairline rounded-lg bg-surface p-4">
        <Header title="Signal Status Board" />
        <p className="text-[0.75rem] text-aurum-text-secondary font-data mt-3">Import XAUUSD data to run the final signal gate.</p>
      </div>
    );
  }

  const { finalSignal, finalBias, finalBiasReason, biases, confluence, readiness, dataQuality, setup, tradeValidation, m5Status, news, rules, waitReasons, dataset, blocked, blockReason, dataLagMs } = gate;
  const sigColor = finalSignal === "BUY" ? "text-bull" : finalSignal === "SELL" ? "text-bear" : blocked ? "text-bear" : "text-gold";
  const consistency = checkCardConsistency(gate);

  return (
    <div className="hairline rounded-lg bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b hairline flex items-center justify-between">
        <Header title="Signal Status Board" />
        <span className={`font-display font-bold text-sm ${sigColor}`}>{finalSignal}</span>
      </div>

      {/* v3.2 — News pause countdown: prominent banner when a high-impact USD event
          is inside the ±30-minute window. Locks execution until it clears. */}
      {newsCountdown && (
        <div className="px-4 py-3 bg-gold/10 border-b hairline">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-gold flex-shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm text-gold">
                TRADING PAUSED: {newsCountdown.phase === "PRE" ? "High-Impact News" : "News Volatility Clearing"} in {formatCountdown(newsCountdown.remaining)}
              </div>
              <p className="text-[0.625rem] text-aurum-text-secondary font-data truncate">
                {newsCountdown.event.title} · {newsCountdown.event.eat} · GATE LOCKED — HIGH IMPACT NEWS EVENT ACTIVE
              </p>
            </div>
          </div>
        </div>
      )}

      {blocked && (
        <div className="px-4 py-3 bg-bear/10 border-b hairline">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-bear flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm text-bear">BLOCKED — {blockReason || "DATA RE-SYNC REQUIRED"}</div>
              <p className="text-[0.625rem] text-aurum-text-secondary font-data">Signal engine paused: {dataQuality?.reason}. Trade calculations bypassed until data is clean.</p>
            </div>
            {/* v3.2 — One-click re-sync: re-runs the deep + incremental backfill to
                patch missing bars and flip D1/H4 to READY without a page refresh. */}
            <button
              type="button"
              onClick={onResync}
              disabled={resyncing || !onResync}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hairline bg-bear/15 text-bear text-[0.6875rem] font-data font-bold hover:bg-bear/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resyncing ? "animate-spin" : ""}`} />
              {resyncing ? "Re-syncing Historical Data…" : "Re-sync Data"}
            </button>
            {syncedLabel && (
              <span className="flex-shrink-0 text-[0.625rem] font-data text-aurum-text-secondary whitespace-nowrap">
                Last synced: <span className="text-gold">{syncedLabel}</span>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* DATA STATUS */}
        <Section icon={Database} title="DATA STATUS" tone={dataQuality.status === "DEGRADED" ? "warn" : "ok"}>
          <Row label="Live price" ok={isLive} value={livePrice != null ? `$${livePrice.toFixed(2)}` : "—"} />
          <Row label="Historical sync" ok={!!dataUpdatedThrough} value={backfilling ? "SYNCING…" : (dataUpdatedThrough ? dataUpdatedThrough.toLocaleString() : histError || "IDLE")} />
          <Row label="Dataset" ok value={fileName || "XAUUSD.csv"} />
          <Row label="Source / Timeframe" ok value={dataset?.sourceTimeframe || "—"} />
          <Row label="First → Last timestamp" ok value={dataset?.first ? `${short(dataset.first)} → ${short(dataset.last)}` : "—"} />
          <Row label="Bars (M15)" ok value={`${dataset?.bars || 0}`} />
          <Row label="Missing bars" ok={dataQuality.missingBars === 0} value={dataQuality.missingBars ? `${dataQuality.missingBars} missing` : "0"} alert={dataQuality.missingBars > 0} />
          <Row label="Data lag (live vs hist)" ok={dataLagMs != null && dataLagMs < 15 * 60 * 1000} value={dataLagMs != null ? `${(dataLagMs / 60000).toFixed(0)}m` : "—"} alert={dataLagMs != null && dataLagMs >= 15 * 60 * 1000} />
          <div className="mt-1 grid grid-cols-5 gap-1">
            {["D1","H4","H1","M15","M5"].map((tf) => (
              <TFChip key={tf} tf={tf} r={readiness[tf]} />
            ))}
          </div>
          {dataQuality.status === "DEGRADED" && (
            <Note tone="warn">DATA QUALITY = DEGRADED — {dataQuality.reason}</Note>
          )}
        </Section>

        {/* MARKET BIAS */}
        <Section icon={Scale} title="MARKET BIAS" tone={finalBias === "MIXED" ? "warn" : "ok"}>
          <BiasRow tf="D1" v={biases.D1} label="Macro" />
          <BiasRow tf="H4" v={biases.H4} label="Structural" />
          <BiasRow tf="H1" v={biases.H1} label="Setup" />
          <BiasRow tf="M15" v={biases.M15} label="Execution" />
          <BiasRow tf="M5" v={biases.M5} label="Sniper" />
          <BiasRow tf="Live" v={biases.liveMomentum} label="Momentum" />
          <div className="mt-2 hairline rounded-md bg-surface-elevated px-3 py-2">
            <span className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">FINAL = </span>
            <span className={`font-display font-bold text-sm ${finalBias === "BULLISH" ? "text-bull" : finalBias === "BEARISH" ? "text-bear" : "text-gold"}`}>{finalBias}</span>
            <p className="text-[0.625rem] text-aurum-text-secondary font-data mt-0.5">{finalBiasReason}</p>
          </div>
        </Section>

        {/* SETUP STATUS */}
        <Section icon={Crosshair} title="SETUP STATUS" tone={setup.status === "STALE" ? "warn" : setup.status === "FRESH" ? "ok" : "idle"}>
          <Row label="M15/H1 setup" ok={setup.status === "FRESH"} value={setup.direction ? `${setup.direction} setup` : "None"} />
          <Row label="STATUS" ok={setup.status === "FRESH"} value={setup.status} alert={setup.status === "STALE"} />
          <Row label="Zone" ok value={setup.zone ? `${setup.zone.bottom.toFixed(1)}–${setup.zone.top.toFixed(1)}` : "—"} />
          <Row label="Distance from price" ok={setup.status === "FRESH"} value={setup.distance != null ? `$${setup.distance.toFixed(1)}` : "—"} alert={setup.status === "STALE"} />
          {setup.status !== "FRESH" && <Note tone={setup.status === "STALE" ? "warn" : "idle"}>Reason = {setup.reason}</Note>}
        </Section>

        {/* RISK STATUS */}
        <Section icon={Shield} title="RISK STATUS" tone={tradeValidation.valid ? "ok" : "warn"}>
          <Row label="Direction" ok={tradeValidation.valid} value={tradeValidation.direction || "—"} />
          <Row label="Entry" ok={tradeValidation.valid} value={tradeValidation.entry != null ? `$${tradeValidation.entry.toFixed(2)}` : "—"} />
          <Row label="SL" ok={tradeValidation.valid} value={tradeValidation.sl != null ? `$${tradeValidation.sl.toFixed(2)}` : "—"} />
          <Row label="TP1" ok={tradeValidation.valid} value={tradeValidation.tp1 != null ? `$${tradeValidation.tp1.toFixed(2)}` : "—"} />
          <Row label="RR (computed)" ok={tradeValidation.valid && tradeValidation.rr > 0} value={tradeValidation.rr ? `${tradeValidation.rr}R` : "—"} alert={!tradeValidation.valid} />
          {!tradeValidation.valid && tradeValidation.reason !== "No setup" && <Note tone="warn">{tradeValidation.reason}</Note>}
        </Section>

        {/* NEWS STATUS */}
        <Section icon={Newspaper} title="NEWS STATUS" tone={news.state === "BLOCK" ? "warn" : news.state === "UNKNOWN" ? "idle" : "ok"}>
          <Row label="Status" ok={news.state === "CLEAR"} value={news.state === "UNKNOWN" ? "UNKNOWN" : news.state} alert={news.state === "BLOCK"} />
          <p className="text-[0.625rem] text-aurum-text-secondary font-data">{news.text}</p>
          <Row label="M5 sniper" ok={m5Status === "READY"} value={m5Status} alert={m5Status === "NOT_AVAILABLE"} />
          {m5Status === "NOT_AVAILABLE" && <Note tone="idle">M5 = NOT AVAILABLE — no sniper entry generated.</Note>}
        </Section>

        {/* CONFLUENCE (single authoritative 8-factor score) */}
        <Section icon={Target} title="CONFLUENCE SCORE" tone={confluence.score >= 60 ? "ok" : "warn"}>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-display font-bold text-3xl text-gold">{confluence.score}</span>
            <span className="text-[0.6875rem] text-aurum-text-secondary font-data">/ 100 · {confluence.direction || "no direction"}</span>
          </div>
          <div className="space-y-1.5">
            {confluence.factors.map((f) => (
              <div key={f.name}>
                <div className="flex items-center justify-between text-[0.6875rem] font-data">
                  <span className="text-aurum-text-secondary">{f.name} <span className="text-aurum-text-secondary/60">/ {f.weight}</span></span>
                  <span className="text-gold font-bold">{f.score}</span>
                </div>
                <div className="h-1 rounded-full bg-surface-elevated overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${(f.score / f.weight) * 100}%` }} />
                </div>
                <div className="text-[0.625rem] text-aurum-text-secondary font-data">{f.label}</div>
              </div>
            ))}
          </div>
          <Note tone="ok">Total = {confluence.factors.reduce((s, f) => s + f.score, 0)} (sum of components)</Note>
        </Section>

        {/* SIGNAL STATUS — 14-rule gate */}
        <Section icon={CheckCircle2} title="SIGNAL STATUS — 14-RULE GATE" tone={blocked ? "warn" : finalSignal === "WAIT" ? "warn" : "ok"}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">FINAL SIGNAL =</span>
            <span className={`font-display font-bold text-lg ${sigColor}`}>{finalSignal}</span>
          </div>
          <ul className="space-y-0.5">
            {rules.map((r) => (
              <li key={r.id} className="text-[0.6875rem] font-data flex items-start gap-1.5">
                {r.passed ? <CheckCircle2 className="w-3 h-3 text-bull flex-shrink-0 mt-0.5" /> : <XCircle className="w-3 h-3 text-bear flex-shrink-0 mt-0.5" />}
                <span className={r.passed ? "text-aurum-text" : "text-bear"}>{r.id}. {r.name}</span>
                <span className="ml-auto text-[0.625rem] text-aurum-text-secondary">{r.detail}</span>
              </li>
            ))}
          </ul>
          {finalSignal === "WAIT" && waitReasons.length > 0 && (
            <div className="mt-2 hairline rounded-md bg-bear/5 px-3 py-2">
              <div className="text-[0.625rem] uppercase tracking-[0.08em] text-bear font-data mb-1">REASON</div>
              <p className="text-[0.6875rem] font-data text-aurum-text-secondary">{waitReasons.join(" + ")}</p>
            </div>
          )}
        </Section>

        {/* CARD CONSISTENCY CHECK */}
        <Section icon={Shield} title="CARD CONSISTENCY CHECK" tone={consistency.pass ? "ok" : "warn"}>
          <Row label="Sniper card" ok={consistency.pass} value={consistency.states.sniper} alert={!consistency.pass} />
          <Row label="M15/H1 card" ok={consistency.pass} value={consistency.states.m15h1} alert={!consistency.pass} />
          <Row label="Live signal card" ok={consistency.pass} value={consistency.states.live} alert={!consistency.pass} />
          <Note tone={consistency.pass ? "ok" : "warn"}>
            {consistency.pass
              ? "CONSISTENCY = PASS — no card displays an executable state while the gate is WAIT."
              : `CONSISTENCY = FAIL — ${consistency.violations.map((v) => `${v.card}:${v.state}`).join(", ")}`}
          </Note>
        </Section>
      </div>
    </div>
  );
}

function Header({ title }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{title}</h3>
    </div>
  );
}

function Section({ icon: Icon, title, tone, children }) {
  const toneColor = tone === "warn" ? "text-bear" : tone === "idle" ? "text-gold" : "text-bull";
  return (
    <div className="hairline rounded-md bg-surface-elevated p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${toneColor}`} />
        <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data font-bold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, ok, value, alert }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[0.6875rem] font-data">
      <span className="text-aurum-text-secondary">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${alert ? "bg-bear" : ok ? "bg-bull" : "bg-gold"}`} />
        <span className={alert ? "text-bear" : "text-aurum-text"}>{value}</span>
      </span>
    </div>
  );
}

function BiasRow({ tf, v, label }) {
  const color = v === "BULLISH" ? "text-bull" : v === "BEARISH" ? "text-bear" : v === "MIXED" ? "text-gold" : "text-aurum-text-secondary";
  return (
    <div className="flex items-center justify-between py-0.5 text-[0.6875rem] font-data">
      <span className="text-aurum-text-secondary">{tf} <span className="text-aurum-text-secondary/60">{label}</span></span>
      <span className={`font-bold ${color}`}>{v}</span>
    </div>
  );
}

function TFChip({ tf, r }) {
  const color = r.status === "READY" ? "text-bull border-bull/40" : r.status === "BUILDING" ? "text-gold border-gold/40" : "text-bear border-bear/40";
  return (
    <div className={`hairline rounded px-1.5 py-1 text-center ${color}`}>
      <div className="text-[0.625rem] font-data font-bold">{tf}</div>
      <div className="text-[0.5rem] font-data">{r.status}</div>
    </div>
  );
}

function Note({ tone, children }) {
  const color = tone === "warn" ? "text-bear" : tone === "idle" ? "text-gold" : "text-bull";
  return <p className={`text-[0.625rem] font-data mt-1.5 ${color}`}>{children}</p>;
}

function short(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatSynced(ts) {
  if (!ts) return null;
  try {
    const t = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Dar_es_Salaam",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(new Date(ts));
    return `${t} EAT`;
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}