import React from "react";
import { CheckCircle2, XCircle, ListChecks } from "lucide-react";

// V2.2 — Signal Explanation: every rule passed or failed, with WAIT reasons.
export default function SignalExplanation({ evaluation, hasData }) {
  if (!hasData || !evaluation) {
    return (
      <div className="hairline rounded-lg bg-surface p-4 h-full">
        <Header />
        <p className="text-[0.75rem] text-aurum-text-secondary font-data mt-3">Import XAUUSD data to evaluate signal rules.</p>
      </div>
    );
  }

  const { signal, marketBias, liveBias, confluence, waitReasons, rules } = evaluation;

  return (
    <div className="hairline rounded-lg bg-surface overflow-hidden h-full">
      <div className="px-4 py-3 border-b hairline flex items-center justify-between">
        <Header />
        <span className={`text-[0.625rem] font-data font-bold ${signal === "BUY" ? "text-bull" : signal === "SELL" ? "text-bear" : "text-gold"}`}>{signal}</span>
      </div>

      <div className="px-4 py-3 grid grid-cols-3 gap-2">
        <Mini label="Market Bias" value={marketBias} />
        <Mini label="Live Bias" value={liveBias} />
        <Mini label="Confluence" value={confluence != null ? `${confluence}/100` : "…"} />
      </div>

      <div className="px-4 pb-3">
        <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2">Signal Rules</div>
        <ul className="space-y-1">
          {rules.map((r, i) => (
            <li key={i} className="text-[0.75rem] font-data flex items-start gap-2">
              {r.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-bull flex-shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-bear flex-shrink-0 mt-0.5" />}
              <span className={r.passed ? "text-aurum-text" : "text-aurum-text-secondary"}>{r.name}</span>
              <span className="ml-auto text-[0.625rem] text-aurum-text-secondary">{r.detail}</span>
            </li>
          ))}
        </ul>

        {signal === "WAIT" && waitReasons?.length > 0 && (
          <div className="mt-2 hairline rounded-md bg-surface-elevated px-3 py-2">
            <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-1">WAIT Reasons</div>
            <ul className="space-y-0.5">
              {waitReasons.map((r, i) => (<li key={i} className="text-[0.6875rem] font-data text-bear">· {r}</li>))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <ListChecks className="w-4 h-4 text-gold" />
      <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Signal Explanation</h3>
    </div>
  );
}

function Mini({ label, value }) {
  const color = value === "BULLISH" ? "text-bull" : value === "BEARISH" ? "text-bear" : value === "MIXED" ? "text-gold" : "text-aurum-text";
  return (
    <div className="hairline rounded-md bg-surface-elevated px-2 py-1.5">
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{label}</div>
      <div className={`text-[0.75rem] font-data font-bold mt-0.5 ${color}`}>{value || "—"}</div>
    </div>
  );
}