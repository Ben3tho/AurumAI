// AURUM AI v3.2 — Shared price formatting helpers.
// XAUUSD is quoted to 2 decimal places. All engine outputs MUST round here so
// cards never render raw floats like 4178.39990234375.

export function round2(v) {
  if (v == null || typeof v !== "number" || Number.isNaN(v)) return null;
  return Math.round(v * 100) / 100;
}

export function fmtUSD(v) {
  const r = round2(v);
  return r == null ? "—" : `$${r}`;
}

// Distance from a price to a zone midpoint (absolute USD).
export function zoneDistance(price, zone) {
  if (price == null || !zone) return null;
  const mid = (zone.top + zone.bottom) / 2;
  return Math.abs(price - mid);
}

export function priceInZone(price, zone) {
  if (price == null || !zone) return false;
  return price >= zone.bottom && price <= zone.top;
}