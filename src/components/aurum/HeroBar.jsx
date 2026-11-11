import React from "react";
import { RefreshCw } from "lucide-react";

// Top full-width hero bar — monumental XAUUSD status with LIVE spot price.
export default function HeroBar({ lastCandle, latestSignal, session, hasData, classification, livePrice, lastUpdated, isLive, dataUpdatedThrough, backfilling, onRefresh, evaluation }) {
  const price = livePrice != null ? livePrice : lastCandle ? lastCandle.close : null;
  const ev = evaluation || {};
  // V2.2 — Live Bias, Market Bias, Signal and Confluence from the same evaluation cycle.
  const signal = ev.signal || (latestSignal ? latestSignal.signal : "WAIT");
  const score = ev.confluence != null ? ev.confluence : (latestSignal ? latestSignal.score : 0);
  const bias = ev.marketBias || (latestSignal ? (latestSignal.direction === "bull" ? "BULLISH" : "BEARISH") : "NEUTRAL");

  const signalColor =
    signal === "BUY" ? "text-bull" : signal === "SELL" ? "text-bear" : "text-aurum-text-secondary";

  return (
    <div className="hairline rounded-lg bg-surface overflow-hidden">
      <div className="flex flex-col lg:flex-row items-stretch">
        {/* Price block — LIVE */}
        <div className="flex-1 px-6 py-5 border-b lg:border-b-0 lg:border-r hairline flex flex-col justify-center">
          <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">XAUUSD · SPOT GOLD</span>
          <div className="font-display font-bold text-aurum-text mt-1" style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)" }}>
            {price != null ? (
              <span>${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            ) : (
              <span className="text-aurum-text-secondary">— —</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-bull/10 text-bull text-[0.6875rem] font-data font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-bull" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-bull" />
                </span>
                LIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-bear/10 text-bear text-[0.6875rem] font-data font-bold">OFFLINE</span>
            )}
            <span className="text-[0.75rem] text-aurum-text-secondary font-data">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Connecting…"}
            </span>
          </div>
          {/* Data Updated Through — v2.0 auto-update status */}
          {hasData && (
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); onRefresh && onRefresh(); }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hairline bg-surface-elevated text-[0.625rem] font-data text-aurum-text-secondary hover:text-gold"
                title="Sync latest candles"
              >
                <RefreshCw className={`w-3 h-3 ${backfilling ? "animate-spin text-gold" : ""}`} />
                {backfilling ? "Syncing…" : "Sync"}
              </button>
              <span className="text-[0.625rem] text-aurum-text-secondary font-data">
                Data Updated Through:{" "}
                <span className="text-gold">
                  {dataUpdatedThrough ? dataUpdatedThrough.toLocaleString() : "—"}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Market Bias (same evaluation cycle as Signal + Confluence) */}
        <div className="px-6 py-5 border-b lg:border-b-0 lg:border-r hairline flex flex-col justify-center min-w-[160px]">
          <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Market Bias</span>
          <span className={`font-display font-bold text-2xl mt-1 ${bias === "BULLISH" ? "text-bull" : bias === "BEARISH" ? "text-bear" : "text-aurum-text-secondary"}`}>
            {hasData ? bias : "—"}
          </span>
          {hasData && signal === "WAIT" && ev.waitReasons?.length > 0 && (
            <span className="text-[0.625rem] text-bear font-data mt-0.5">{ev.waitReasons[0]}</span>
          )}
        </div>

        {/* Signal */}
        <div className="px-6 py-5 border-b lg:border-b-0 lg:border-r hairline flex flex-col justify-center min-w-[140px]">
          <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Signal</span>
          <span className={`font-display font-bold text-2xl mt-1 ${signalColor}`}>{hasData ? signal : "WAIT"}</span>
        </div>

        {/* Confluence */}
        <div className="px-6 py-5 border-b lg:border-b-0 lg:border-r hairline flex flex-col justify-center min-w-[140px]">
          <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Confluence</span>
          <span className="font-display font-bold text-2xl mt-1 text-gold">
            {hasData ? (score != null ? `${score}/100` : "…") : "—"}
          </span>
        </div>

        {/* Session */}
        <div className="px-6 py-5 flex flex-col justify-center min-w-[180px]">
          <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Session</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-gold" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gold" />
            </span>
            <span className="font-display font-bold text-base text-aurum-text">{session || "— —"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}