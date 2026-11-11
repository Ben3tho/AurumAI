// Multi-timeframe aggregation. Adapts to the source candle resolution.
// Finer timeframes than the source CANNOT be derived (null) — only coarser ones are resampled.
// No look-ahead: aggregation only uses candles at or before the boundary.

const TIMEFRAME_MS = {
  M5: 5 * 60 * 1000,
  M15: 15 * 60 * 1000,
  M30: 30 * 60 * 1000,
  H1: 60 * 60 * 1000,
  H4: 4 * 60 * 60 * 1000,
  D1: 24 * 60 * 60 * 1000,
  W1: 7 * 24 * 60 * 60 * 1000,
  MN: 30 * 24 * 60 * 60 * 1000 // approximate — used only for detection ordering
};

// Canonical display order, coarsest first
const TF_ORDER = ["MN", "W1", "D1", "H4", "H1", "M30", "M15", "M5"];

function floorToBucket(time, tf) {
  if (tf === "MN") {
    const d = new Date(time);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
  if (tf === "W1") {
    const d = new Date(time);
    const day = d.getUTCDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7; // days since Monday
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday);
  }
  const tfMs = TIMEFRAME_MS[tf];
  if (tfMs >= TIMEFRAME_MS.D1) {
    const d = new Date(time);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return Math.floor(time / tfMs) * tfMs;
}

export function resample(candles, tf) {
  if (!candles.length) return [];
  if (!TIMEFRAME_MS[tf]) throw new Error("Unknown timeframe: " + tf);
  const out = [];
  let bucket = null;
  for (const c of candles) {
    const b = floorToBucket(c.time, tf);
    if (!bucket || bucket.time !== b) {
      if (bucket) out.push(bucket);
      bucket = { time: b, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
    } else {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume += c.volume;
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

// Detect the source timeframe from the median candle interval.
export function detectSourceTimeframe(candles) {
  if (candles.length < 4) return "UNKNOWN";
  const intervals = [];
  for (let i = 1; i < Math.min(candles.length, 100); i++) {
    const d = candles[i].time - candles[i - 1].time;
    if (d > 0) intervals.push(d);
  }
  if (!intervals.length) return "UNKNOWN";
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  let best = "UNKNOWN";
  let bestDiff = Infinity;
  for (const tf of ["M5", "M15", "M30", "H1", "H4", "D1", "W1"]) {
    const diff = Math.abs(median - TIMEFRAME_MS[tf]);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = tf;
    }
  }
  return best;
}

// Build all timeframes from source candles. Finer TFs than source are null.
export function buildAllTimeframes(candles) {
  const source = detectSourceTimeframe(candles);
  const tfs = { M5: null, M15: null, M30: null, H1: null, H4: null, D1: null, W1: null, MN: null };

  if (source === "UNKNOWN") {
    tfs.D1 = candles; // fallback: treat as daily-ish
    return { timeframes: tfs, sourceTimeframe: source };
  }

  tfs[source] = candles;
  const sourceIdx = TF_ORDER.indexOf(source);

  // Aggregate UPWARD (coarser TFs only — finer cannot be derived)
  for (const tf of TF_ORDER) {
    if (TF_ORDER.indexOf(tf) < sourceIdx) {
      tfs[tf] = resample(candles, tf);
    }
  }

  return { timeframes: tfs, sourceTimeframe: source };
}

export { TIMEFRAME_MS, TF_ORDER };