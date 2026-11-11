// Historical XAUUSD H1 (hourly) OHLCV fetcher.
// Uses Yahoo Finance's free, keyless chart API (symbol XAUUSD=X) server-side
// to avoid browser CORS restrictions. Returns real hourly candles for the
// requested [period1, period2] Unix-second range, used to auto-backfill the
// gap between the last CSV candle and the current date.
// Returns: { candles: [{time,open,high,low,close,volume}], count, source, range }

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const nowSec = Math.floor(Date.now() / 1000);
    // Default: last 730 days (Yahoo allows up to ~2y at 60m granularity).
    const period1 = Math.max(0, Math.floor(Number(body.period1) || (nowSec - 730 * 24 * 3600)));
    let period2 = Math.floor(Number(body.period2) || nowSec);
    if (period2 <= period1) period2 = nowSec;

    // Gold futures (GC=F) have reliable intraday OHLCV on Yahoo. Spot XAUUSD=X
    // is also attempted as a fallback if futures 404.
    const symbol = String(body.symbol || "GC=F");
    // v3.0: support intraday intervals for sniper M5/M15 backfill.
    const allowed = ["5m", "15m", "30m", "60m"];
    const interval = allowed.includes(body.interval) ? body.interval : "60m";
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=${interval}&period1=${period1}&period2=${period2}&includePrePost=false`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const headers = {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; AURUM-AI/2.0)"
    };
    let res = await fetch(url, { headers, signal: controller.signal });
    // Fallback to spot gold symbol if futures 404.
    if (res.status === 404 && symbol === "GC=F") {
      const altUrl =
        "https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD%3DX" +
        `?interval=${interval}&period1=${period1}&period2=${period2}&includePrePost=false`;
      res = await fetch(altUrl, { headers, signal: controller.signal });
    }
    clearTimeout(timeout);

    if (!res.ok) {
      return Response.json(
        { error: `Upstream error (${res.status})` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return Response.json(
        { error: data?.chart?.error?.description || "No chart result from upstream" },
        { status: 502 }
      );
    }

    const ts = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const opens = q.open || [];
    const highs = q.high || [];
    const lows = q.low || [];
    const closes = q.close || [];
    const volumes = q.volume || [];

    const candles = [];
    for (let i = 0; i < ts.length; i++) {
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      const c = closes[i];
      // Skip incomplete bars (Yahoo returns null during gaps/closures).
      if (o == null || h == null || l == null || c == null) continue;
      candles.push({
        time: ts[i] * 1000, // ms
        open: Number(o),
        high: Number(h),
        low: Number(l),
        close: Number(c),
        volume: volumes[i] != null ? Number(volumes[i]) : 0
      });
    }

    if (!candles.length) {
      return Response.json(
        { error: "No candles returned for the requested range" },
        { status: 502 }
      );
    }

    return Response.json({
      candles,
      count: candles.length,
      source: "yahoo-finance",
      symbol: symbol === "GC=F" && res.url.includes("XAUUSD") ? "XAUUSD=X" : symbol,
      range: { period1, period2 }
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "History fetch error" },
      { status: 500 }
    );
  }
}