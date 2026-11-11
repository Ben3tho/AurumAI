import React, { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";

// Bottom span 12: Equity curve, drawdown curve, trade log preview.
export default function BacktestRegion({ equityCurve, trades, stats, hasData, backtestStatus, datasetInfo, zeroTradeReason, signalCount, fileName }) {
  const [expanded, setExpanded] = useState(false);

  const equityData = (equityCurve || []).map((p, i) => ({
    i,
    equity: Number(p.equity.toFixed(2)),
    drawdown: Number(((p.drawdown || 0) * 100).toFixed(2))
  }));

  const peakEquity = equityData.length ? Math.max(...equityData.map((d) => d.equity)) : 0;
  const minEquity = equityData.length ? Math.min(...equityData.map((d) => d.equity)) : 0;

  return (
    <div className="hairline rounded-lg bg-surface">
      <div className="px-4 py-3 border-b hairline flex items-center justify-between">
        <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">
          Chronological Backtest · Equity & Drawdown
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[0.75rem] text-aurum-text-secondary hover:text-aurum-text font-data"
        >
          {expanded ? "Collapse" : "Expand"} Trade Log
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="p-4">
        {/* V2.3 — Backtest status + dataset info */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-px mb-4">
          <Stat label="Dataset" value={hasData ? (fileName || "XAUUSD.csv") : "—"} />
          <Stat label="Timeframe" value={hasData && datasetInfo ? datasetInfo.sourceTimeframe : "—"} />
          <Stat label="Backtest Status" value={hasData ? (backtestStatus || "COMPLETED") : "READY"} color={backtestStatus === "FAILED" ? "text-bear" : "text-bull"} />
          <Stat label="Bars" value={hasData && datasetInfo ? datasetInfo.candlesLoaded : "—"} />
          <Stat label="Start" value={hasData && datasetInfo ? new Date(datasetInfo.startDate).toLocaleDateString() : "—"} />
          <Stat label="Last" value={hasData && datasetInfo ? new Date(datasetInfo.endDate).toLocaleString() : "—"} />
        </div>
        {hasData && datasetInfo && (
          <div className="text-[0.625rem] text-aurum-text-secondary font-data mb-3">
            Backtest ran on <span className="text-gold">{fileName || "XAUUSD.csv"}</span> ({datasetInfo.sourceTimeframe}, {new Date(datasetInfo.startDate).toLocaleDateString()} → {new Date(datasetInfo.endDate).toLocaleDateString()}, {datasetInfo.candlesLoaded} bars)
          </div>
        )}

        {/* Stat strip */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-px mb-4">
          <Stat label="Net Profit" value={hasData && stats ? `$${stats.netProfit.toFixed(0)}` : "—"} color={stats?.netProfit >= 0 ? "text-bull" : "text-bear"} />
          <Stat label="Win Rate" value={hasData && stats ? `${stats.winRate.toFixed(1)}%` : "—"} />
          <Stat label="Profit Factor" value={hasData && stats ? (Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞") : "—"} />
          <Stat label="Expectancy" value={hasData && stats ? `$${stats.expectancy.toFixed(2)}` : "—"} />
          <Stat label="Avg R" value={hasData && stats ? `${stats.avgR.toFixed(2)}R` : "—"} color={stats?.avgR >= 0 ? "text-bull" : "text-bear"} />
          <Stat label="Max DD" value={hasData && stats ? `${(stats.maxDrawdown * 100).toFixed(1)}%` : "—"} color="text-bear" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Equity curve */}
          <div className="hairline rounded-md bg-surface-elevated p-3">
            <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2">Equity Curve</div>
            <div style={{ height: 180 }}>
              {hasData && equityData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="hsl(var(--hairline))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="i" tick={false} stroke="hsl(var(--text-secondary))" />
                    <YAxis domain={[minEquity * 0.98, peakEquity * 1.02]} tick={{ fontSize: 10, fill: "hsl(var(--text-secondary))", fontFamily: "JetBrains Mono" }} stroke="hsl(var(--hairline))" width={50} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--hairline))", borderRadius: 6, fontFamily: "JetBrains Mono", fontSize: 12 }}
                      labelStyle={{ color: "hsl(var(--text-secondary))" }}
                      formatter={(v) => [`$${v}`, "Equity"]}
                    />
                    <Line type="monotone" dataKey="equity" stroke="hsl(var(--gold))" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>
          </div>

          {/* Drawdown curve */}
          <div className="hairline rounded-md bg-surface-elevated p-3">
            <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2">Drawdown Depth</div>
            <div style={{ height: 180 }}>
              {hasData && equityData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="hsl(var(--hairline))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="i" tick={false} stroke="hsl(var(--text-secondary))" />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--text-secondary))", fontFamily: "JetBrains Mono" }} stroke="hsl(var(--hairline))" width={40} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--hairline))", borderRadius: 6, fontFamily: "JetBrains Mono", fontSize: 12 }}
                      formatter={(v) => [`${v}%`, "Drawdown"]}
                    />
                    <Area type="monotone" dataKey="drawdown" stroke="hsl(var(--bear))" strokeWidth={1} fill="hsl(var(--bear) / 0.15)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>
          </div>
        </div>

        {/* Trade log preview */}
        {expanded && (
          <div className="mt-4">
            <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2">
              Trade Log {hasData ? `(${trades?.length || 0} trades)` : ""}
            </div>
            <div className="overflow-x-auto hairline rounded-md">
              <table className="w-full text-[0.8125rem] font-data">
                <thead className="bg-surface-elevated">
                  <tr className="text-aurum-text-secondary text-[0.6875rem] uppercase tracking-[0.08em]">
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Dir</th>
                    <th className="px-3 py-2 text-right font-medium">Entry</th>
                    <th className="px-3 py-2 text-right font-medium">Exit</th>
                    <th className="px-3 py-2 text-left font-medium">Reason</th>
                    <th className="px-3 py-2 text-right font-medium">P&L</th>
                    <th className="px-3 py-2 text-right font-medium">R</th>
                    <th className="px-3 py-2 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {hasData && trades && trades.length ? (
                    trades.slice(-50).reverse().map((t, i) => (
                      <tr key={i} className="border-t hairline">
                        <td className="px-3 py-1.5 text-aurum-text-secondary">{trades.length - i}</td>
                        <td className={`px-3 py-1.5 font-medium ${t.direction === "bull" ? "text-bull" : "text-bear"}`}>
                          {t.direction === "bull" ? "BUY" : "SELL"}
                        </td>
                        <td className="px-3 py-1.5 text-right text-aurum-text">{t.entry.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right text-aurum-text">{t.exit.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-aurum-text-secondary">{t.exitReason}</td>
                        <td className={`px-3 py-1.5 text-right font-medium ${t.pnl >= 0 ? "text-bull" : "text-bear"}`}>
                          {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                        </td>
                        <td className={`px-3 py-1.5 text-right ${t.rMultiple >= 0 ? "text-bull" : "text-bear"}`}>
                          {t.rMultiple.toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gold">{t.score}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-aurum-text-secondary">
                        {hasData && zeroTradeReason ? zeroTradeReason : "No trades — import data to run backtest"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color = "text-aurum-text" }) {
  return (
    <div className="bg-surface-elevated px-3 py-2.5">
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{label}</div>
      <div className={`text-[0.8125rem] font-data font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-aurum-text-secondary text-[0.75rem] font-data">
      Awaiting data import
    </div>
  );
}