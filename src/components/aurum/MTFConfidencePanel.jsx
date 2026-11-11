import React from "react";

// AURUM AI v2.0 — Multi-Timeframe Confidence panel.
// Shows the 0-100 Confidence Score, the D1→M5 hierarchy status, and the
// six factor contributions (Trend Alignment, BOS/CHOCH, FVG, Order Block,
// Liquidity Sweep, News Filter).
export default function MTFConfidencePanel({ confidence, hasData, calculating }) {
  // V2.4 — show CALCULATING… while the pipeline builds D1/H4/H1/M15/M5.
  if (calculating) {
    return (
      <div className="hairline rounded-lg bg-surface p-4">
        <Header />
        <div className="py-8 text-center text-[0.8125rem] text-gold font-data animate-pulse">
          CALCULATING… building D1 · H4 · H1 · M15 · M5
        </div>
      </div>
    );
  }
  if (!hasData || !confidence || !confidence.available) {
    return (
      <div className="hairline rounded-lg bg-surface p-4">
        <Header />
        <div className="py-8 text-center text-[0.8125rem] text-aurum-text-secondary font-data">
          Import XAUUSD data to compute v2.0 confidence
        </div>
      </div>
    );
  }

  const { score, direction, factors, perTimeframe } = confidence;
  const isBull = direction === "bull";
  const factorRows = [
    { name: "Trend Alignment", weight: 25, ...factors.trendAlignment },
    { name: "BOS / CHOCH", weight: 20, ...factors.bosChoch },
    { name: "Fair Value Gap", weight: 15, ...factors.fvg },
    { name: "Order Block", weight: 15, ...factors.orderBlock },
    { name: "Liquidity Sweep", weight: 15, ...factors.liquiditySweep },
    { name: "News Filter", weight: 10, ...factors.newsFilter }
  ];
  const tfOrder = ["D1", "H4", "H1", "M15", "M5"];

  return (
    <div className="hairline rounded-lg bg-surface overflow-hidden">
      <Header />
      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Score + direction */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center text-center">
          <div className={`text-6xl font-display font-bold ${isBull ? "text-bull" : "text-bear"}`}>
            {score}
          </div>
          <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mt-1">
            Confidence / 100
          </div>
          <div className={`mt-2 px-3 py-1 rounded-md font-display font-bold text-sm ${isBull ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear"}`}>
            {isBull ? "BULLISH" : "BEARISH"}
          </div>
        </div>

        {/* Hierarchy */}
        <div className="lg:col-span-4">
          <SubLabel>Multi-Timeframe Hierarchy</SubLabel>
          <div className="space-y-1.5">
            {tfOrder.map((tf) => {
              const t = perTimeframe[tf];
              const color = t.status === "BULLISH" ? "text-bull" : t.status === "BEARISH" ? "text-bear" : "text-aurum-text-secondary";
              return (
                <div key={tf} className="flex items-center justify-between hairline rounded-md bg-surface-elevated px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.75rem] font-data font-bold text-gold w-8">{tf}</span>
                    <div>
                      <div className="text-[0.75rem] font-data text-aurum-text">{t.role}</div>
                      {t.note && <div className="text-[0.625rem] text-aurum-text-secondary font-data">{t.note}</div>}
                    </div>
                  </div>
                  <span className={`text-[0.75rem] font-data font-bold ${color}`}>{t.status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Factor bars */}
        <div className="lg:col-span-5">
          <SubLabel>Factor Breakdown</SubLabel>
          <div className="space-y-2">
            {factorRows.map((f) => (
              <div key={f.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[0.75rem] font-data text-aurum-text-secondary">
                    {f.name}
                    <span className="ml-1 text-[0.625rem] text-aurum-text-secondary/70">/ {f.weight}</span>
                  </span>
                  <span className="text-[0.75rem] font-data font-bold text-gold">{f.score}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                  <div
                    className="h-full bg-gold"
                    style={{ width: `${(f.score / f.weight) * 100}%` }}
                  />
                </div>
                <div className="text-[0.625rem] text-aurum-text-secondary font-data mt-0.5">{f.name === "News Filter" ? (f.note || "CLEAR") : f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* V2.4 — failed-rule checklist */}
      {confidence.failedRules && confidence.failedRules.length > 0 && (
        <div className="px-4 py-3 border-t hairline">
          <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2">Failed Rules</div>
          <ul className="space-y-1">
            {confidence.failedRules.map((r, i) => (
              <li key={i} className="text-[0.6875rem] font-data text-bear flex items-start gap-1.5">· {r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="px-4 py-3 border-b hairline flex items-center justify-between">
      <h3 className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">
        v2.0 · Multi-Timeframe Confidence
      </h3>
      <span className="text-[0.625rem] text-gold font-data font-bold">D1·H4·H1·M15·M5</span>
    </div>
  );
}

function SubLabel({ children }) {
  return <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2">{children}</div>;
}