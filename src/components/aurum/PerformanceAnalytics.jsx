import React from "react";
import { Trophy, Calendar } from "lucide-react";

// AURUM AI v3.0 — Weekly & monthly performance analytics from the journal.
function isoWeek(dateStr) {
  const d = new Date(dateStr);
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${week}`;
}
function isoMonth(dateStr) {
  const d = new Date(dateStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketStats(trades) {
  const closed = trades.filter((t) => t.result === "win" || t.result === "loss");
  const wins = closed.filter((t) => t.result === "win").length;
  const pnl = closed.reduce((a, t) => a + (t.pnl_usd || 0), 0);
  const avgRR = closed.length ? closed.reduce((a, t) => a + (t.risk_reward || 0), 0) / closed.length : 0;
  return { count: trades.length, closed: closed.length, wins, winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0, pnl, avgRR };
}

export default function PerformanceAnalytics({ trades }) {
  const thisWeekKey = isoWeek(new Date().toISOString());
  const thisMonthKey = isoMonth(new Date().toISOString());

  const byWeek = {};
  const byMonth = {};
  for (const t of trades) {
    if (!t.entry_time) continue;
    const w = isoWeek(t.entry_time);
    const m = isoMonth(t.entry_time);
    (byWeek[w] = byWeek[w] || []).push(t);
    (byMonth[m] = byMonth[m] || []).push(t);
  }

  const week = bucketStats(byWeek[thisWeekKey] || []);
  const month = bucketStats(byMonth[thisMonthKey] || []);
  const weekKeys = Object.keys(byWeek).sort().reverse().slice(0, 8);

  return (
    <div className="hairline rounded-lg bg-surface p-4">
      <div className="flex items-center gap-2 mb-3"><Trophy className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Performance Analytics</span></div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Bucket title="This Week" stats={week} />
        <Bucket title="This Month" stats={month} />
      </div>

      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2 flex items-center gap-1.5"><Calendar className="w-3 h-3" />Last 8 weeks</div>
      <div className="flex items-end gap-1 h-20 bg-surface-elevated rounded-md p-2">
        {weekKeys.map((k) => {
          const s = bucketStats(byWeek[k]);
          const max = Math.max(1, ...weekKeys.map((kk) => Math.abs(bucketStats(byWeek[kk]).pnl)));
          const h = Math.max(4, (Math.abs(s.pnl) / max) * 100);
          const up = s.pnl >= 0;
          return (
            <div key={k} className="flex-1 flex flex-col items-center justify-end h-full" title={`${k}: ${s.closed} trades, ${s.winRate}% win, $${s.pnl}`}>
              <div className="w-full rounded-t" style={{ height: `${h}%`, backgroundColor: up ? "hsl(var(--bull))" : "hsl(var(--bear))", opacity: 0.7 }} />
              <span className="text-[0.5rem] font-data text-aurum-text-secondary mt-1">{k.slice(-2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Bucket({ title, stats }) {
  const up = stats.pnl >= 0;
  return (
    <div className="hairline rounded-md bg-surface-elevated px-3 py-2.5">
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{title}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className={`text-base font-display font-bold ${up ? "text-bull" : "text-bear"}`}>{up ? "+" : ""}${stats.pnl}</span>
        <span className="text-[0.625rem] font-data text-aurum-text-secondary">{stats.closed} closed</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[0.625rem] font-data text-aurum-text-secondary">Win {stats.winRate}%</span>
        <span className="text-[0.625rem] font-data text-aurum-text-secondary">Avg RR {stats.avgRR.toFixed(1)}</span>
      </div>
    </div>
  );
}