// AURUM AI v3.0 — Kill Zones in Tanzania (EAT = UTC+3, no DST).
// ICT-style kill zones defined in UTC, displayed in EAT.
//   Asian        00:00-03:00 UTC  -> 03:00-06:00 EAT
//   London       07:00-10:00 UTC  -> 10:00-13:00 EAT
//   London Close 10:00-12:00 UTC  -> 13:00-15:00 EAT
//   New York     12:00-15:00 UTC  -> 15:00-18:00 EAT

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

// Zones in minutes-since-midnight UTC.
export const KILL_ZONES = [
  { key: "asian", name: "Asian Kill Zone", utcStart: 0, utcEnd: 180, color: "#64748b" },
  { key: "london", name: "London Kill Zone", utcStart: 420, utcEnd: 600, color: "#eab308" },
  { key: "londonClose", name: "London Close", utcStart: 600, utcEnd: 720, color: "#f59e0b" },
  { key: "newyork", name: "New York Kill Zone", utcStart: 720, utcEnd: 900, color: "#22c55e" }
];

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function utcMinutes(date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

// Convert UTC minutes-of-day to an EAT "HH:MM" label.
export function eatLabelFromUtcMinutes(utcMin) {
  const eatMin = (utcMin + 180) % 1440;
  return `${pad(Math.floor(eatMin / 60))}:${pad(eatMin % 60)}`;
}

export function formatEAT(date) {
  const d = new Date((date instanceof Date ? date.getTime() : date) + EAT_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} EAT`;
}

export function formatEATshort(date) {
  const d = new Date((date instanceof Date ? date.getTime() : date) + EAT_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} EAT`;
}

// Zones with EAT labels for display.
export function getKillZones() {
  return KILL_ZONES.map((z) => ({
    ...z,
    eatStart: eatLabelFromUtcMinutes(z.utcStart),
    eatEnd: eatLabelFromUtcMinutes(z.utcEnd)
  }));
}

// Active kill zone(s) at the given Date (UTC-based).
export function getActiveKillZone(date) {
  const m = utcMinutes(date);
  return KILL_ZONES.filter((z) => m >= z.utcStart && m < z.utcEnd) || [];
}

export function isActiveNow(date) {
  return getActiveKillZone(date).length > 0;
}