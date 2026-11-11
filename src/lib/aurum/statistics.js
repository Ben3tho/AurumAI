// Statistics + Monte Carlo analysis — computed from real trade results.

export function computeStatistics(trades, equityCurve, accountSize = 10000) {
  if (!trades.length) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      profitFactor: 0,
      netProfit: 0,
      expectancy: 0,
      avgR: 0,
      maxDrawdown: 0,
      longestLosingStreak: 0,
      longestWinningStreak: 0,
      grossProfit: 0,
      grossLoss: 0,
      avgWin: 0,
      avgLoss: 0
    };
  }

  let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0;
  let winStreak = 0, lossStreak = 0, maxWinStreak = 0, maxLossStreak = 0;
  let rSum = 0;
  let peak = accountSize;
  let maxDD = 0;

  for (const t of trades) {
    if (t.pnl > 0) {
      wins++;
      grossProfit += t.pnl;
      winStreak++;
      lossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, winStreak);
    } else {
      losses++;
      grossLoss += Math.abs(t.pnl);
      lossStreak++;
      winStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    }
    rSum += t.rMultiple || 0;
  }

  // Drawdown from equity curve
  if (equityCurve) {
    peak = accountSize;
    for (const p of equityCurve) {
      peak = Math.max(peak, p.equity);
      const dd = (peak - p.equity) / peak;
      maxDD = Math.max(maxDD, dd);
    }
  }

  const netProfit = grossProfit - grossLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const winRate = (wins / trades.length) * 100;
  const expectancy = netProfit / trades.length;
  const avgR = rSum / trades.length;

  return {
    totalTrades: trades.length,
    wins,
    losses,
    winRate,
    profitFactor,
    netProfit,
    expectancy,
    avgR,
    maxDrawdown: maxDD,
    longestLosingStreak: maxLossStreak,
    longestWinningStreak: maxWinStreak,
    grossProfit,
    grossLoss,
    avgWin: wins ? grossProfit / wins : 0,
    avgLoss: losses ? grossLoss / losses : 0
  };
}

// Breakdown by category
export function breakdownBy(trades, keyFn) {
  const groups = {};
  for (const t of trades) {
    const k = keyFn(t);
    if (!groups[k]) groups[k] = [];
    groups[k].push(t);
  }
  const out = {};
  for (const [k, ts] of Object.entries(groups)) {
    out[k] = computeStatistics(ts, null, 10000);
  }
  return out;
}

export function sessionBreakdown(trades) {
  return breakdownBy(trades, (t) => {
    const s = t.session || "UNKNOWN";
    if (s === "ASIAN") return "ASIAN";
    if (s === "LONDON" || s === "LONDON/NY OVERLAP") return "LONDON";
    if (s === "NEW YORK") return "NEW YORK";
    return "OFF-SESSION";
  });
}

export function directionBreakdown(trades) {
  return breakdownBy(trades, (t) => (t.direction === "bull" ? "BUY" : "SELL"));
}

export function scoreBreakdown(trades) {
  const out = {};
  for (const t of trades) {
    const k = t.score >= 90 ? "90-100" : t.score >= 80 ? "80-89" : "70-79";
    if (!out[k]) out[k] = [];
    out[k].push(t);
  }
  for (const k of Object.keys(out)) out[k] = computeStatistics(out[k], null, 10000);
  return out;
}

// Monte Carlo — reshuffle trade order 1000 times, compute drawdown distribution.
export function monteCarlo(trades, iterations = 1000, accountSize = 10000) {
  if (trades.length < 2) {
    return {
      iterations: 0,
      medianDrawdown: 0,
      p95Drawdown: 0,
      worstDrawdown: 0,
      prob20: 0,
      prob30: 0,
      prob50: 0,
      samples: []
    };
  }

  const pnls = trades.map((t) => t.pnl);
  const drawdowns = [];

  for (let it = 0; it < iterations; it++) {
    // Fisher-Yates shuffle
    const arr = pnls.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    let equity = accountSize;
    let peak = accountSize;
    let maxDD = 0;
    for (const p of arr) {
      equity += p;
      peak = Math.max(peak, equity);
      if (peak > 0) maxDD = Math.max(maxDD, (peak - equity) / peak);
    }
    drawdowns.push(maxDD);
  }

  drawdowns.sort((a, b) => a - b);
  const pct = (p) => drawdowns[Math.min(drawdowns.length - 1, Math.floor(p * drawdowns.length))];
  const probOf = (thresh) => (drawdowns.filter((d) => d >= thresh).length / drawdowns.length) * 100;

  return {
    iterations,
    medianDrawdown: pct(0.5),
    p95Drawdown: pct(0.95),
    worstDrawdown: drawdowns[drawdowns.length - 1],
    prob20: probOf(0.2),
    prob30: probOf(0.3),
    prob50: probOf(0.5),
    samples: drawdowns
  };
}

// Walk-forward split: 60/20/20 chronological
export function walkForwardSplit(trades) {
  const n = trades.length;
  const trainEnd = Math.floor(n * 0.6);
  const valEnd = Math.floor(n * 0.8);
  return {
    train: trades.slice(0, trainEnd),
    validation: trades.slice(trainEnd, valEnd),
    outOfSample: trades.slice(valEnd)
  };
}

// Final classification based on evidence
export function classify(stats, mc, totalCandles) {
  if (totalCandles < 2000 || stats.totalTrades < 20) {
    return "INSUFFICIENT DATA";
  }
  const robust =
    stats.totalTrades >= 30 &&
    stats.winRate >= 45 &&
    stats.profitFactor >= 1.3 &&
    stats.maxDrawdown <= 0.3 &&
    mc.p95Drawdown <= 0.4 &&
    stats.avgR > 0;
  const fragile =
    stats.profitFactor < 1.1 ||
    stats.maxDrawdown > 0.4 ||
    mc.p95Drawdown > 0.5 ||
    stats.totalTrades < 20;

  if (robust && !fragile) return "ROBUST UNDER TEST CONDITIONS";
  if (fragile) return "FRAGILE / PARAMETER SENSITIVE";
  if (stats.profitFactor >= 1.0) return "PROMISING BUT UNVERIFIED";
  return "FRAGILE / PARAMETER SENSITIVE";
}