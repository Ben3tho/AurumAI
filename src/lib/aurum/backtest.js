// Chronological bar-by-bar backtest engine.
// No look-ahead: a signal at index i is evaluated using candles i+1 onward.
// Includes spread, slippage, commission, position sizing on 1% risk rule.

export function runBacktest(candles, signals, config = {}) {
  const {
    spreadPoints = 0.3,        // gold points (e.g. 0.3 = $0.30)
    slippagePoints = 0.1,
    commissionPerLot = 7,     // round-turn $ per standard lot
    accountSize = 10000,
    riskPerTrade = 0.01,       // 1%
    pointValue = 1,            // $ per point per standard lot (XAUUSD = $1 per 0.01 move per lot? use $1 per point)
    maxConcurrent = 1,
    minRR = 3
  } = config;

  const trades = [];
  let equity = accountSize;
  let peakEquity = accountSize;
  let maxDrawdown = 0;
  const equityCurve = [{ index: 0, time: candles[0]?.time, equity }];

  // Track open trade to avoid overlapping (maxConcurrent = 1 default)
  let openTrade = null;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // Manage open trade
    if (openTrade) {
      const { direction, entry, sl, tp1, tp2, tp3, lotSize, time: entryTime, signalIndex } = openTrade;
      let exitPrice = null;
      let exitReason = null;

      if (direction === "bull") {
        // Check SL first (conservative: assume SL hit if low touches)
        if (c.low <= sl) { exitPrice = sl; exitReason = "SL"; }
        else if (c.high >= tp3) { exitPrice = tp3; exitReason = "TP3"; }
        else if (c.high >= tp2) { exitPrice = tp2; exitReason = "TP2"; }
        else if (c.high >= tp1) { exitPrice = tp1; exitReason = "TP1"; }
      } else {
        if (c.high >= sl) { exitPrice = sl; exitReason = "SL"; }
        else if (c.low <= tp3) { exitPrice = tp3; exitReason = "TP3"; }
        else if (c.low <= tp2) { exitPrice = tp2; exitReason = "TP2"; }
        else if (c.low <= tp1) { exitPrice = tp1; exitReason = "TP1"; }
      }

      if (exitPrice != null) {
        const grossPips =
          direction === "bull" ? (exitPrice - entry) : (entry - exitPrice);
        const costs = (spreadPoints + slippagePoints) * pointValue * lotSize + commissionPerLot * lotSize;
        const pnl = grossPips * pointValue * lotSize * 100 - costs; // pointValue scaling
        // Recompute cleanly: pnl in dollars
        const moveDollars = direction === "bull" ? exitPrice - entry : entry - exitPrice;
        const dollarPnl = moveDollars * lotSize * 100; // 100 oz per lot
        const totalCosts = (spreadPoints + slippagePoints) * lotSize * 100 + commissionPerLot * lotSize;
        const netPnl = dollarPnl - totalCosts;

        equity += netPnl;
        const riskAmount = accountSize * riskPerTrade;
        const rMultiple = netPnl / riskAmount;

        trades.push({
          signalIndex,
          entryTime,
          exitTime: c.time,
          direction,
          entry,
          exit: exitPrice,
          sl,
          tp1,
          tp2,
          tp3,
          exitReason,
          lotSize,
          riskAmount,
          pnl: netPnl,
          rMultiple,
          score: openTrade.score,
          session: openTrade.session
        });

        peakEquity = Math.max(peakEquity, equity);
        maxDrawdown = Math.max(maxDrawdown, (peakEquity - equity) / peakEquity);
        equityCurve.push({ index: i, time: c.time, equity, drawdown: (peakEquity - equity) / peakEquity });
        openTrade = null;
      }
    }

    // Open new trade on signal (only if no open trade and signal is at this bar)
    if (!openTrade) {
      const sig = signals.find((s) => s.index === i);
      if (sig && sig.rr >= minRR) {
        const riskPerUnit = Math.abs(sig.entry - sig.sl);
        if (riskPerUnit <= 0) continue;
        const riskAmount = equity * riskPerTrade;
        // lotSize = riskAmount / (riskPerUnit * 100 oz per lot)
        const lotSize = riskAmount / (riskPerUnit * 100);
        if (lotSize <= 0 || !Number.isFinite(lotSize)) continue;

        openTrade = {
          signalIndex: sig.index,
          direction: sig.direction === "bull" ? "bull" : "bear",
          entry: sig.entry,
          sl: sig.sl,
          tp1: sig.tp1,
          tp2: sig.tp2,
          tp3: sig.tp3,
          lotSize,
          time: sig.time,
          score: sig.score,
          session: sig.session
        };
      }
    }
  }

  // Close any remaining open trade at last close
  if (openTrade) {
    const c = candles[candles.length - 1];
    const exitPrice = c.close;
    const moveDollars = openTrade.direction === "bull" ? exitPrice - openTrade.entry : openTrade.entry - exitPrice;
    const dollarPnl = moveDollars * openTrade.lotSize * 100;
    const totalCosts = (spreadPoints + slippagePoints) * openTrade.lotSize * 100 + commissionPerLot * openTrade.lotSize;
    const netPnl = dollarPnl - totalCosts;
    equity += netPnl;
    const riskAmount = accountSize * riskPerTrade;
    trades.push({
      signalIndex: openTrade.signalIndex,
      entryTime: openTrade.time,
      exitTime: c.time,
      direction: openTrade.direction,
      entry: openTrade.entry,
      exit: exitPrice,
      sl: openTrade.sl,
      tp1: openTrade.tp1,
      tp2: openTrade.tp2,
      tp3: openTrade.tp3,
      exitReason: "EOD",
      lotSize: openTrade.lotSize,
      riskAmount,
      pnl: netPnl,
      rMultiple: netPnl / riskAmount,
      score: openTrade.score,
      session: openTrade.session
    });
    equityCurve.push({ index: candles.length - 1, time: c.time, equity, drawdown: 0 });
  }

  return { trades, equityCurve, finalEquity: equity, maxDrawdown, config };
}