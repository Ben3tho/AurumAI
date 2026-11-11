import React, { useState, useEffect } from "react";
import { Calendar, AlertTriangle, Clock } from "lucide-react";

// AURUM AI v3.0 — Live USD economic calendar panel.
export default function EconomicCalendarPanel({ today, nextHigh, newsBlock, newsStatus, loading, error }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const nextCountdown = nextHigh ? Math.max(0, nextHigh.timeMs - now) : 0;
  const cd = (ms) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="hairline rounded-lg bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Economic Calendar · USD</span></div>
        {newsBlock && <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-bear/10 text-bear text-[0.625rem] font-data font-bold"><AlertTriangle className="w-3 h-3" />NEWS BLOCK</span>}
      </div>

      {newsBlock && (
        <div className="hairline rounded-md bg-bear/10 px-3 py-2 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-bear" />
          <span className="text-[0.75rem] font-data text-bear">High-impact USD release within ±30 min — sniper entries paused.</span>
        </div>
      )}

      {nextHigh && (
        <div className="hairline rounded-md bg-surface-elevated px-3 py-2.5 mb-3">
          <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-gold" /><span className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Next high-impact</span></div>
          <div className="flex items-center justify-between">
            <span className="text-[0.8125rem] font-data font-bold text-aurum-text">{nextHigh.title}</span>
            <span className="text-[0.75rem] font-data text-gold">in {cd(nextCountdown)}</span>
          </div>
          <div className="text-[0.625rem] font-data text-aurum-text-secondary mt-0.5">{nextHigh.eat}</div>
        </div>
      )}

      {newsStatus === "UNAVAILABLE" ? (
        <div className="hairline rounded-md bg-gold/5 px-3 py-2.5 mb-1">
          <div className="text-[0.75rem] font-data font-bold text-gold">NEWS = UNKNOWN</div>
          <p className="text-[0.6875rem] text-aurum-text-secondary font-data mt-0.5">News filter could not be verified. API unavailable — signals run on technicals only.</p>
        </div>
      ) : loading ? (
        <p className="text-[0.75rem] text-aurum-text-secondary font-data">Loading calendar…</p>
      ) : error ? (
        <p className="text-[0.75rem] text-bear font-data">{error}</p>
      ) : today.length === 0 ? (
        <p className="text-[0.75rem] text-aurum-text-secondary font-data">No USD high/medium events today.</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {today.map((e, i) => (
            <div key={i} className="flex items-center justify-between hairline rounded-md bg-surface-elevated px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full ${e.impact === "High" ? "bg-bear" : "bg-gold"}`} />
                <span className="text-[0.75rem] font-data text-aurum-text truncate">{e.title}</span>
              </div>
              <div className="text-right ml-2 flex-shrink-0">
                <div className="text-[0.625rem] font-data text-aurum-text-secondary">{e.eat.slice(11)}</div>
                {e.forecast && <div className="text-[0.625rem] font-data text-aurum-text-secondary">F: {e.forecast}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}