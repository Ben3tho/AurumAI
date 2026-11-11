// AURUM AI v3.0 — AI Risk Manager.
// XAUUSD contract: 1 standard lot = 100 troy oz => $1 price move = $100/lot.
// All inputs are in price units (USD per oz).

export const GOLD_CONTRACT_SIZE = 100; // oz per lot

export function computeRiskUSD(accountSize, riskPercent) {
  return (Number(accountSize) || 0) * (Number(riskPercent) || 0) / 100;
}

// Lot size to risk exactly `riskPercent` of account over a `slDistance` price stop.
export function computeLotSize(accountSize, riskPercent, slDistancePrice, contractSize = GOLD_CONTRACT_SIZE) {
  const riskUSD = computeRiskUSD(accountSize, riskPercent);
  const perLotRisk = (Math.abs(slDistancePrice) || 0) * contractSize;
  if (!perLotRisk) return 0;
  return Math.max(0, Math.round((riskUSD / perLotRisk) * 100) / 100);
}

// Risk-reward ratio for a target price vs an entry/stop pair.
export function computeRR(entry, sl, tp) {
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (!risk) return 0;
  return Math.round((reward / risk) * 100) / 100;
}

// Full position plan for a sniper signal.
export function buildRiskPlan({ accountSize, riskPercent, direction, entry, sl, tp1, tp2, tp3 }) {
  const slDistance = Math.abs(entry - sl);
  const lot = computeLotSize(accountSize, riskPercent, slDistance);
  const riskUSD = computeRiskUSD(accountSize, riskPercent);
  return {
    lot,
    riskUSD,
    slDistance: Math.round(slDistance * 100) / 100,
    rr1: computeRR(entry, sl, tp1),
    rr2: computeRR(entry, sl, tp2),
    rr3: computeRR(entry, sl, tp3)
  };
}