import React, { useState, useEffect } from "react";
import { Crosshair } from "lucide-react";
import { getKillZones, getActiveKillZone, formatEAT } from "@/lib/aurum/killZones";

// AURUM AI v3.0 — Kill Zone timeline (EAT). Shows the 24h EAT day with London
// and New York kill zones highlighted and a live "now" marker.
function eatToHours(label) {
  const [h, m] = label.split(":").map(Number);
  return h + m / 60;
}

export default function KillZoneBar() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const zones = getKillZones();
  const active = getActiveKillZone(now);
  const nowEatHours = (() => {
    const d = new Date(now.getTime() + 3 * 3600000);
    return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  })();
  const nowPct = (nowEatHours / 24) * 100;

  return (
    <div className="hairline rounded-lg bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-gold" />
          <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Kill Zones · EAT</span>
        </div>
        <span className="font-data font-bold text-gold text-sm">{formatEAT(now)}</span>
      </div>

      <div className="relative h-9 rounded-md bg-surface-elevated overflow-hidden">
        {zones.map((z) => {
          const left = (eatToHours(z.eatStart) / 24) * 100;
          const width = ((eatToHours(z.eatEnd) - eatToHours(z.eatStart)) / 24) * 100;
          const on = active.some((a) => a.key === z.key);
          return (
            <div
              key={z.key}
              className="absolute top-0 h-full flex items-center justify-center"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: z.color,
                opacity: on ? 0.55 : 0.22
              }}
              title={`${z.name} · ${z.eatStart}–${z.eatEnd} EAT`}
            >
              <span className="text-[0.5rem] font-data font-bold text-[#0B0D11] truncate px-1">{z.name.split(" ")[0]}</span>
            </div>
          );
        })}
        {/* now marker */}
        <div className="absolute top-0 h-full w-px bg-aurum-text" style={{ left: `${nowPct}%` }}>
          <div className="absolute -top-0 -translate-x-1/2 w-2 h-2 rounded-full bg-aurum-text" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {zones.map((z) => {
          const on = active.some((a) => a.key === z.key);
          return (
            <div key={z.key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: z.color, opacity: on ? 1 : 0.4 }} />
              <span className={`text-[0.625rem] font-data ${on ? "text-aurum-text" : "text-aurum-text-secondary"}`}>
                {z.name} {z.eatStart}–{z.eatEnd}
              </span>
            </div>
          );
        })}
      </div>

      {active.length > 0 && (
        <div className="mt-3 px-3 py-2 rounded-md bg-gold/10 border hairline flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-gold" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
          </span>
          <span className="text-[0.75rem] font-data font-bold text-gold">ACTIVE: {active.map((a) => a.name).join(" · ")}</span>
        </div>
      )}
    </div>
  );
}