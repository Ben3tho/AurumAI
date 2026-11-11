import React from "react";

// Detailed statistics breakdown: BUY/SELL, sessions, score ranges, walk-forward, Monte Carlo.
export default function BreakdownReport({ byDirection, bySession, byScore, walkForward, monteCarlo, stats, hasData }) {
  if (!hasData) {
    return (
      <div className="hairline rounded-lg bg-surface p-8 text-center">
        <p className="text-sm text-aurum-text-secondary font-data">Detailed breakdown available after data import & backtest</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Direction breakdown */}
      <Section title="Direction Breakdown">
        <BreakdownTable
          data={{
            BUY: byDirection?.BUY ? formatStats(byDirection.BUY) : null,
            SELL: byDirection?.SELL ? formatStats(byDirection.SELL) : null
          }}
        />
      </Section>

      {/* Session breakdown */}
      <Section title="Session Breakdown">
        <BreakdownTable
          data={{
            ASIAN: bySession?.ASIAN ? formatStats(bySession.ASIAN) : null,
            LONDON: bySession?.LONDON ? formatStats(bySession.LONDON) : null,
            "NEW YORK": bySession?.["NEW YORK"] ? formatStats(bySession["NEW YORK"]) : null
          }}
        />
      </Section>

      {/* Score breakdown */}
      <Section title="Confidence Score Performance">
        <BreakdownTable
          data={{
            "70-79": byScore?.["70-79"] ? formatStats(byScore["70-79"]) : null,
            "80-89": byScore?.["80-89"] ? formatStats(byScore["80-89"]) : null,
            "90-100": byScore?.["90-100"] ? formatStats(byScore["90-100"]) : null
          }}
        />
        <p className="mt-2 text-[0.6875rem] text-aurum-text-secondary font-data">
          Note: Confidence Score is a Confluence Score (factor agreement), not a win probability.
        </p>
      </Section>

      {/* Walk-forward */}
      <Section title="Walk-Forward Analysis (60/20/20)">
        <div className="grid grid-cols-3 gap-px">
          <WFBlock label="Train (60%)" stats={walkForward?.train} count={walkForward?.counts?.train} />
          <WFBlock label="Validation (20%)" stats={walkForward?.validation} count={walkForward?.counts?.validation} />
          <WFBlock label="Out-of-Sample (20%)" stats={walkForward?.outOfSample} count={walkForward?.counts?.outOfSample} />
        </div>
        <p className="mt-2 text-[0.6875rem] text-aurum-text-secondary font-data">
          OOS not used for optimization.
        </p>
      </Section>

      {/* Monte Carlo */}
      <Section title="Monte Carlo Simulation (1,000 iterations)">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-px">
          <MCStat label="Median DD" value={`${((monteCarlo?.medianDrawdown || 0) * 100).toFixed(1)}%`} />
          <MCStat label="95% DD" value={`${((monteCarlo?.p95Drawdown || 0) * 100).toFixed(1)}%`} alert />
          <MCStat label="Worst DD" value={`${((monteCarlo?.worstDrawdown || 0) * 100).toFixed(1)}%`} alert />
          <MCStat label="P(DD≥20%)" value={`${(monteCarlo?.prob20 || 0).toFixed(0)}%`} />
          <MCStat label="P(DD≥30%)" value={`${(monteCarlo?.prob30 || 0).toFixed(0)}%`} />
        </div>
      </Section>
    </div>
  );
}

function formatStats(s) {
  return {
    Trades: s.totalTrades,
    "Win%": `${s.winRate.toFixed(1)}`,
    PF: Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞",
    "Net P&L": `$${s.netProfit.toFixed(0)}`,
    "Avg R": s.avgR.toFixed(2)
  };
}

function Section({ title, children }) {
  return (
    <div className="hairline rounded-lg bg-surface">
      <div className="px-4 py-3 border-b hairline">
        <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function BreakdownTable({ data }) {
  const keys = Object.values(data).find(Boolean) ? Object.keys(Object.values(data).find(Boolean)) : [];
  const rows = Object.entries(data).filter(([, v]) => v);

  if (!rows.length) {
    return <p className="text-[0.75rem] text-aurum-text-secondary font-data">No trades in this category.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.8125rem] font-data">
        <thead>
          <tr className="text-aurum-text-secondary text-[0.6875rem] uppercase tracking-[0.08em]">
            <th className="px-3 py-2 text-left font-medium">Metric</th>
            {rows.map(([k]) => (
              <th key={k} className="px-3 py-2 text-right font-medium">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key} className="border-t hairline">
              <td className="px-3 py-1.5 text-aurum-text-secondary">{key}</td>
              {rows.map(([k, v]) => (
                <td key={k} className={`px-3 py-1.5 text-right font-medium ${key === "Net P&L" ? (Number(v[key].replace("$", "")) >= 0 ? "text-bull" : "text-bear") : "text-aurum-text"}`}>
                  {v[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WFBlock({ label, stats, count }) {
  if (!stats || !count) {
    return <div className="bg-surface-elevated px-3 py-3 text-center text-[0.75rem] text-aurum-text-secondary font-data">{label}: no trades</div>;
  }
  return (
    <div className="bg-surface-elevated px-3 py-3">
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{label}</div>
      <div className="text-[0.8125rem] font-data font-bold text-aurum-text mt-1">{count} trades</div>
      <div className="text-[0.75rem] font-data text-aurum-text-secondary mt-1">
        PF: {Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"} · WR: {stats.winRate.toFixed(0)}%
      </div>
      <div className={`text-[0.75rem] font-data mt-0.5 ${stats.netProfit >= 0 ? "text-bull" : "text-bear"}`}>
        {stats.netProfit >= 0 ? "+" : ""}${stats.netProfit.toFixed(0)}
      </div>
    </div>
  );
}

function MCStat({ label, value, alert }) {
  return (
    <div className="bg-surface-elevated px-3 py-2.5">
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{label}</div>
      <div className={`text-[0.8125rem] font-data font-bold mt-0.5 ${alert ? "text-bear" : "text-aurum-text"}`}>{value}</div>
    </div>
  );
}