import React from "react";

// Data Integrity & Backtest Summary Panel — span 3 right.
export default function DataIntegrityPanel({ validation, stats, monteCarlo, classification, hasData }) {
  const items = [
    {
      label: "Total Candles Parsed",
      value: hasData ? validation?.totalCandles?.toLocaleString() : "—"
    },
    {
      label: "Missing Bar Alerts",
      value: hasData ? validation?.missingCandles : "—",
      alert: hasData && validation?.missingCandles > 0
    },
    {
      label: "OHLC Anomalies",
      value: hasData ? validation?.ohlcAnomalies : "—",
      alert: hasData && validation?.ohlcAnomalies > 0
    },
    {
      label: "Duplicate Bars",
      value: hasData ? validation?.duplicateCandles : "—",
      alert: hasData && validation?.duplicateCandles > 0
    },
    {
      label: "MC 95% Drawdown",
      value: hasData && monteCarlo ? `${(monteCarlo.p95Drawdown * 100).toFixed(1)}%` : "—",
      alert: hasData && monteCarlo && monteCarlo.p95Drawdown > 0.4
    },
    {
      label: "Profit Factor",
      value: hasData && stats ? (Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞") : "—",
      good: hasData && stats && stats.profitFactor >= 1.3
    }
  ];

  const classColor = (c) => {
    if (!c) return "text-aurum-text-secondary";
    if (c.includes("ROBUST")) return "text-bull";
    if (c.includes("FRAGILE")) return "text-bear";
    if (c.includes("PROMISING")) return "text-gold";
    return "text-aurum-text-secondary";
  };

  return (
    <div className="hairline rounded-lg bg-surface h-full flex flex-col">
      <div className="px-4 py-3 border-b hairline">
        <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Data Integrity & Backtest</h3>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="space-y-px flex-1">
          {items.map((it) => (
            <div key={it.label} className="flex items-center justify-between py-2 border-b hairline last:border-0">
              <span className="text-[0.75rem] text-aurum-text-secondary font-data">{it.label}</span>
              <span
                className={`text-[0.8125rem] font-data font-bold ${
                  it.alert ? "text-bear" : it.good ? "text-bull" : "text-aurum-text"
                }`}
              >
                {it.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t hairline">
          <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">System Classification</span>
          <div className={`mt-1.5 px-3 py-2 rounded-md bg-surface-elevated hairline text-center`}>
            <span className={`text-[0.75rem] font-data font-bold tracking-wide ${classColor(classification)}`}>
              {classification || "INSUFFICIENT DATA"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}