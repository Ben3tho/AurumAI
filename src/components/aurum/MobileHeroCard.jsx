import React from "react";
import ConfluenceGauge from "./ConfluenceGauge";

// Mobile primary hero card — live spot price + signal + execution levels.
export default function MobileHeroCard({ latestSignal, lastCandle, hasData, livePrice, lastUpdated, isLive, dataUpdatedThrough, backfilling }) {
  const isBull = latestSignal?.direction === "bull";
  const signal = latestSignal?.signal || "WAIT";
  const score = latestSignal?.score || 0;
  const price = livePrice != null ? livePrice : lastCandle?.close;

  // Live TP/SL hit detection — updates automatically as the live price moves.
  let liveStatus = null;
  if (hasData && latestSignal && livePrice != null) {
    if (isBull) {
      if (livePrice >= latestSignal.tp1) liveStatus = { text: "TP HIT", color: "text-bull" };
      else if (livePrice <= latestSignal.sl) liveStatus = { text: "SL HIT", color: "text-bear" };
    } else {
      if (livePrice <= latestSignal.tp1) liveStatus = { text: "TP HIT", color: "text-bull" };
      else if (livePrice >= latestSignal.sl) liveStatus = { text: "SL HIT", color: "text-bear" };
    }
  }
  const displaySignal = liveStatus ? liveStatus.text : hasData ? signal : "WAIT";

  return (
    <div className={`hairline rounded-lg overflow-hidden ${signal === "BUY" ? "bull-glow" : signal === "SELL" ? "bear-glow" : ""}`}>
      {/* Price ticker */}
      <div className="flex items-center justify-between px-4 py-3 border-b hairline bg-surface">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">XAUUSD</span>
            {isLive ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bull/10 text-bull text-[0.625rem] font-data font-bold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-bull" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-bull" />
                </span>
                LIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bear/10 text-bear text-[0.625rem] font-data font-bold">OFFLINE</span>
            )}
          </div>
          <div className="font-display font-bold text-2xl text-aurum-text">
            {price != null ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
          </div>
          <span className="text-[0.625rem] text-aurum-text-secondary font-data">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Connecting…"}
          </span>
          {hasData && (
            <span className="block text-[0.625rem] text-aurum-text-secondary font-data mt-0.5">
              Data Updated Through:{" "}
              <span className="text-gold">{dataUpdatedThrough ? dataUpdatedThrough.toLocaleString() : "—"}</span>
              {backfilling && <span className="ml-1 text-gold">· syncing…</span>}
            </span>
          )}
        </div>
        <ConfluenceGauge score={hasData ? score : 0} size={88} />
      </div>

      {/* Signal */}
      <div className={`px-4 py-4 ${signal === "BUY" ? "bg-bull/10" : signal === "SELL" ? "bg-bear/10" : "bg-surface"}`}>
        <div className="flex items-center justify-between">
          <span className={`font-display font-bold text-4xl ${liveStatus ? liveStatus.color : signal === "BUY" ? "text-bull" : signal === "SELL" ? "text-bear" : "text-aurum-text-secondary"}`}>
            {displaySignal}
          </span>
          <div className="text-right">
            <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Bias</div>
            <div className={`font-display font-bold text-lg ${isBull ? "text-bull" : "text-bear"}`}>
              {hasData ? (isBull ? "BULLISH" : "BEARISH") : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Execution summary */}
      {hasData && latestSignal ? (
        <div className="grid grid-cols-3 gap-px bg-hairline">
          <Cell label="Entry" value={`$${latestSignal.entry.toFixed(2)}`} />
          <Cell label="SL" value={`$${latestSignal.sl.toFixed(2)}`} color="text-bear" hit={liveStatus?.text === "SL HIT"} />
          <Cell label="TP1" value={`$${latestSignal.tp1.toFixed(2)}`} color="text-bull" hit={liveStatus?.text === "TP HIT"} />
        </div>
      ) : (
        <div className="px-4 py-4 text-center text-[0.75rem] text-aurum-text-secondary font-data">
          Import XAUUSD CSV to compute signal
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, color = "text-aurum-text", hit }) {
  return (
    <div className={`bg-surface px-3 py-2.5 ${hit ? "ring-1 ring-inset ring-gold" : ""}`}>
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{label}</div>
      <div className={`text-[0.8125rem] font-data font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}