// AURUM AI v2.2 — Unified Signal Evaluation.
// Produces Live Bias, Market Bias, Signal, Confluence and WAIT reasons from the
// SAME evaluation cycle (fixes sync drift between Signal Engine and Confluence).
import { emaSeries } from "./indicators";

function quickStack(candles) {
  if (!candles || candles.length < 30) return null;
  const e20 = emaSeries(candles, 20);
  const e50 = emaSeries(candles, 50);
  const i = candles.length - 1;
  if (Number.isNaN(e20[i]) || Number.isNaN(e50[i])) return null;
  if (candles.length >= 200) {
    const e200 = emaSeries(candles, 200);
    if (!Number.isNaN(e200[i])) {
      return e20[i] > e50[i] && e50[i] > e200[i] ? "bullish"
        : e20[i] < e50[i] && e50[i] < e200[i] ? "bearish" : "mixed";
    }
  }
  return e20[i] > e50[i] ? "bullish" : e20[i] < e50[i] ? "bearish" : "mixed";
}

export function evaluateSignal({ timeframes, mtfConfidence, m15h1, newsBlock, newsStatus, livePrice }) {
  const D1 = timeframes?.D1, H4 = timeframes?.H4, H1 = timeframes?.H1, M15 = timeframes?.M15;
  const d1s = quickStack(D1), h4s = quickStack(H4), h1s = quickStack(H1);

  // Market Bias = D1/H4/H1 alignment (MIXED when higher TFs conflict).
  const stacks = [d1s, h4s, h1s].filter(Boolean);
  let marketBias = "NEUTRAL";
  if (stacks.length) {
    const bull = stacks.filter((s) => s === "bullish").length;
    const bear = stacks.filter((s) => s === "bearish").length;
    if (bull === stacks.length) marketBias = "BULLISH";
    else if (bear === stacks.length) marketBias = "BEARISH";
    else if (bull > 0 && bear > 0) marketBias = "MIXED";
    else if (bull > 0) marketBias = "BULLISH";
    else if (bear > 0) marketBias = "BEARISH";
  }

  // Live Bias from M15+H1 confluence direction, fallback to H1 trend.
  const m15h1Dir = m15h1?.direction;
  let liveBias = "NEUTRAL";
  if (m15h1Dir === "BUY") liveBias = "BULLISH";
  else if (m15h1Dir === "SELL") liveBias = "BEARISH";
  else if (h1s === "bullish") liveBias = "BULLISH";
  else if (h1s === "bearish") liveBias = "BEARISH";

  const confluence = mtfConfidence?.score ?? null;
  const THRESHOLD = 60;

  const htfsAligned = marketBias === "BULLISH" || marketBias === "BEARISH";
  const m15h1Aligned = !!m15h1Dir &&
    ((m15h1Dir === "BUY" && marketBias === "BULLISH") || (m15h1Dir === "SELL" && marketBias === "BEARISH"));
  const confluenceOk = confluence != null && confluence >= THRESHOLD;
  const execTfOk = !!M15 && !!m15h1?.aligned;
  const newsOk = !newsBlock;

  const rules = [
    { name: "Higher timeframe alignment (D1/H4/H1)", passed: htfsAligned, detail: marketBias === "MIXED" ? "Conflict" : marketBias },
    { name: "M15 + H1 setup aligned with market bias", passed: m15h1Aligned, detail: m15h1Dir ? `${m15h1Dir} setup` : "No setup" },
    { name: `Confluence >= ${THRESHOLD}`, passed: confluenceOk, detail: confluence != null ? `${confluence}/100` : "Calculating" },
    { name: "Execution timeframe (M15) present", passed: execTfOk, detail: M15 ? "M15 ready" : "Missing M15" },
    { name: "No high-impact news block", passed: newsOk, detail: newsStatus === "UNAVAILABLE" ? "News UNKNOWN" : newsBlock ? "Blocked" : "Clear" }
  ];

  let signal = "WAIT";
  const waitReasons = [];
  if (htfsAligned && m15h1Aligned && confluenceOk && execTfOk && newsOk) {
    signal = m15h1Dir === "BUY" ? "BUY" : "SELL";
  } else {
    if (!htfsAligned) waitReasons.push(marketBias === "MIXED" ? "Higher timeframe conflict" : "Higher timeframe neutral");
    if (!m15h1Aligned) waitReasons.push(m15h1Dir ? "M15/H1 setup conflicts with higher timeframe bias" : "Missing execution timeframe (M15 setup)");
    if (!confluenceOk) waitReasons.push(confluence == null ? "Confidence calculating" : "Confidence below threshold");
    if (!execTfOk) waitReasons.push("Missing execution timeframe (M15)");
    if (!newsOk) waitReasons.push("News block active");
  }

  return { liveBias, marketBias, signal, confluence, waitReasons, rules };
}