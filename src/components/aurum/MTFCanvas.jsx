import React from "react";

// Multi-Timeframe Structure Canvas.
// Renders the available (aggregated) timeframes dynamically — finer TFs than the
// source are not derivable and are noted as unavailable.
export default function MTFCanvas({ mtfBias, mtfOrder = [], sourceTimeframe, smcCounts, hasData }) {
  const biasColor = (b) => {
    if (b === "BULLISH") return "text-bull bg-bull/10";
    if (b === "BEARISH") return "text-bear bg-bear/10";
    if (b === "MIXED") return "text-aurum-text-secondary bg-surface-elevated";
    return "text-aurum-text-secondary bg-surface-elevated";
  };

  const smcMarkers = [
    { label: "BOS", count: smcCounts?.bos || 0 },
    { label: "CHOCH", count: smcCounts?.choch || 0 },
    { label: "Order Blocks", count: smcCounts?.obs || 0 },
    { label: "Fair Value Gaps", count: smcCounts?.fvgs || 0 },
    { label: "Liquidity Sweeps", count: smcCounts?.sweeps || 0 }
  ];

  const finerUnavailable = sourceTimeframe && ["D1", "W1", "MN", "UNKNOWN"].includes(sourceTimeframe);

  return (
    <div className="hairline rounded-lg bg-surface">
      <div className="px-4 py-3 border-b hairline flex items-center justify-between">
        <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Multi-Timeframe Structure</h3>
        <span className="text-[0.625rem] text-aurum-text-secondary font-data">SOURCE · {sourceTimeframe || "—"}</span>
      </div>
      <div className="p-4">
        {/* MTF alignment matrix — dynamic, only available TFs */}
        <div className="flex gap-2 mb-5">
          {mtfOrder.length === 0 && (
            <div className="text-[0.75rem] text-aurum-text-secondary font-data py-3">No timeframes available.</div>
          )}
          {mtfOrder.map((tf) => {
            const b = mtfBias?.[tf] || "N/A";
            return (
              <div key={tf} className="flex-1 hairline rounded-md bg-surface-elevated px-2 py-3 text-center">
                <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-1">{tf}</div>
                <div className={`inline-block px-2 py-0.5 rounded text-[0.6875rem] font-data font-medium ${biasColor(b)}`}>{b}</div>
              </div>
            );
          })}
        </div>

        {finerUnavailable && hasData && (
          <div className="mb-5 text-[0.6875rem] text-aurum-text-secondary font-data text-center">
            Intradaday timeframes (H4 / H1 / M15 / M5) unavailable — requires finer source data.
          </div>
        )}

        {/* Alignment indicator */}
        <div className="flex items-center gap-2 mb-5 px-2">
          <div className="flex-1 h-px bg-hairline" />
          <span className="text-[0.6875rem] text-aurum-text-secondary font-data">
            {hasData ? "TOP-DOWN BIAS ALIGNMENT" : "—"}
          </span>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        {/* SMC markers */}
        <div>
          <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2">Smart Money Concepts</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {smcMarkers.map((m) => (
              <div key={m.label} className="hairline rounded-md bg-surface-elevated px-3 py-2.5 flex items-center justify-between">
                <span className="text-[0.75rem] text-aurum-text-secondary font-data">{m.label}</span>
                <span className="text-[0.8125rem] font-data font-bold text-gold">{hasData ? m.count : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}