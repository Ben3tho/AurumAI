import React from "react";
import { Wifi, Database, Newspaper, Activity, BarChart3, Gauge } from "lucide-react";

// V2.2/V2.4 — System Health + Data Sync Status panel.
export default function SyncStatus({ isLive, liveUpdated, liveError, histSyncing, histUpdated, histError, newsStatus, newsError, signalSynced, backtestStatus, indicatorSynced }) {
  const rows = [
    {
      icon: Wifi, label: "Live Price Sync",
      state: isLive ? "LIVE" : liveError ? "ERROR" : "CONNECTING",
      detail: liveUpdated ? liveUpdated.toLocaleTimeString() : liveError || "Connecting…",
      ok: isLive
    },
    {
      icon: Database, label: "Historical Data Sync",
      state: histError ? "ERROR" : histSyncing ? "SYNCING" : histUpdated ? "SYNCED" : "IDLE",
      detail: histUpdated ? histUpdated.toLocaleString() : histError || (histSyncing ? "Backfilling…" : "Awaiting import"),
      ok: !histError && !!histUpdated
    },
    {
      icon: Newspaper, label: "News API Sync",
      state: newsStatus === "LIVE" ? "LIVE" : newsStatus === "BLOCK" ? "BLOCK" : newsStatus === "UNAVAILABLE" ? "UNAVAILABLE" : newsStatus === "LOADING" ? "LOADING" : "UNKNOWN",
      detail: newsStatus === "UNAVAILABLE" ? "NEWS FEED UNAVAILABLE" : newsError || (newsStatus === "BLOCK" ? "High-impact event window" : "OK"),
      ok: newsStatus === "LIVE" || newsStatus === "BLOCK"
    },
    {
      icon: Activity, label: "Signal Engine Sync",
      state: signalSynced ? "SYNCED" : "IDLE",
      detail: signalSynced ? "Evaluation cycle active" : "Awaiting pipeline",
      ok: signalSynced
    },
    {
      icon: BarChart3, label: "Backtest Engine Sync",
      state: backtestStatus || "READY",
      detail: backtestStatus === "COMPLETED" ? "Backtest complete" : backtestStatus === "FAILED" ? "Backtest failed" : "Awaiting data",
      ok: backtestStatus === "COMPLETED"
    },
    {
      icon: Gauge, label: "Indicator Sync",
      state: indicatorSynced ? "SYNCED" : "IDLE",
      detail: indicatorSynced ? "Timeframes built" : "Awaiting pipeline",
      ok: indicatorSynced
    }
  ];

  return (
    <div className="hairline rounded-lg bg-surface overflow-hidden h-full">
      <div className="px-4 py-3 border-b hairline">
        <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">System Health · Data Sync Status</h3>
      </div>
      <div className="divide-y divide-hairline">
        {rows.map((r, i) => {
          const Icon = r.icon;
          const dot = r.ok ? "bg-bull" : (r.state === "SYNCING" || r.state === "LOADING" || r.state === "CONNECTING") ? "bg-gold animate-pulse" : "bg-bear";
          const stateColor = r.ok ? "text-bull" : (r.state === "UNAVAILABLE" || r.state === "ERROR") ? "text-bear" : "text-gold";
          return (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3">
              <Icon className="w-4 h-4 text-gold flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[0.75rem] font-data text-aurum-text">{r.label}</div>
                <div className="text-[0.625rem] font-data text-aurum-text-secondary truncate">{r.detail}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className={`text-[0.625rem] font-data font-bold ${stateColor}`}>{r.state}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}