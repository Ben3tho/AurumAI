import { useState, useRef, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { parseCSV } from "@/lib/aurum/csvParser";
import { runFullPipeline } from "@/lib/aurum/orchestrator";
import { detectSourceTimeframe, TIMEFRAME_MS } from "@/lib/aurum/multiTimeframe";

// Map a detected source timeframe to a Yahoo Finance interval + its duration in ms.
// Coarser sources (H4/D1+) backfill with hourly bars (aggregated up by the engine).
// Yahoo Finance interval strings (the backend only accepts 5m/15m/30m/60m).
const YAHOO_INTERVAL = { M5: "5m", M15: "15m", M30: "30m", H1: "60m", H4: "60m", D1: "60m", W1: "60m", MN: "60m", UNKNOWN: "60m" };
import { detectStructure, detectFVG, detectOrderBlocks, detectLiquiditySweeps } from "@/lib/aurum/smc";

// AURUM AI v2.0 — Auto-updating historical data pipeline.
// 1. Loads the seeded H1 CSV.
// 2. Backfills any missing hourly candles between the last CSV candle and now
//    via the GetXauusdHistory backend function (real Yahoo Finance OHLCV).
// 3. Appends new candles without duplicates (dedup by timestamp).
// 4. Re-runs the full SMC / signal / backtest pipeline after every update.
// Periodically re-fetches incremental candles so the dataset stays current.
// Returns { pipeline, loading, backfilling, error, fileName, dataUpdatedThrough, reload }.

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // re-fetch incremental candles every 5 min
// v3.2 — deep backfill window (days) by source resolution. Yahoo 5m/15m only go
// back ~60d, but 60m goes back ~730d. Fetching this deep history and prepending it
// gives D1 (60 bars) and H4 (80 bars) enough data to COMPLETE instead of staying
// stuck in BUILDING. Dedup by timestamp keeps the merged set resolution-consistent.
const DEEP_BACKFILL_DAYS = { M5: 60, M15: 60, M30: 60, H1: 730, H4: 730, D1: 730, W1: 730, MN: 730, UNKNOWN: 730 };

export default function useAutoUpdatingPipeline(defaultCsvUrl) {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [dataUpdatedThrough, setDataUpdatedThrough] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const candlesRef = useRef([]); // merged, deduped, sorted candle array
  const srcIntervalRef = useRef(3600000); // detected source candle duration (ms)
  const yahooIntervalRef = useRef("1h"); // Yahoo Finance interval for backfill
  const fileInputRef = useRef(null);
  const mountedRef = useRef(true);

  // Build the pipeline result from the current merged candle set + SMC counts.
  const buildPipeline = useCallback((candles, name) => {
    if (!candles.length) {
      setError("No valid candles parsed from file. Check CSV format (time, open, high, low, close, volume).");
      setLoading(false);
      setBackfilling(false);
      return null;
    }
    const result = runFullPipeline(candles, {
      backtest: { accountSize: 10000, riskPerTrade: 0.01, spreadPoints: 0.3, slippagePoints: 0.1, commissionPerLot: 7 }
    });
    const structEvents = detectStructure(candles).events;
    const smcCounts = {
      bos: structEvents.filter((e) => e.type === "BOS").length,
      choch: structEvents.filter((e) => e.type === "CHOCH").length,
      obs: detectOrderBlocks(candles).length,
      fvgs: detectFVG(candles).length,
      sweeps: detectLiquiditySweeps(candles).length
    };
    const out = { ...result, smcCounts, fileName: name, candleCount: candles.length };
    setPipeline(out);
    setDataUpdatedThrough(new Date(candles[candles.length - 1].time));
    return out;
  }, []);

  // Merge new candles into the existing set, deduping by timestamp.
  const mergeCandles = useCallback((existing, incoming) => {
    const intervalMs = srcIntervalRef.current;
    const map = new Map();
    for (const c of existing) map.set(c.time, c);
    for (const c of incoming) {
      // Only keep timestamps aligned to the source interval to stay resolution-consistent.
      if (c.time % intervalMs === 0) map.set(c.time, c);
    }
    const merged = Array.from(map.values()).sort((a, b) => a.time - b.time);
    return merged;
  }, []);

  // v3.2 — Deep backfill: fetch a long historical window BACKWARD from the first
  // CSV candle so higher timeframes (D1/H4) have enough bars to complete. Runs
  // once after the initial load, before the incremental backfill.
  const deepBackfill = useCallback(async (sourceName) => {
    const candles = candlesRef.current;
    if (!candles.length) return;
    const tf = detectSourceTimeframe(candles);
    const days = DEEP_BACKFILL_DAYS[tf] || 730;
    const firstTime = candles[0].time;
    const startSec = Math.floor((firstTime - days * 24 * 3600 * 1000) / 1000);
    const endSec = Math.floor(firstTime / 1000);
    if (endSec <= startSec) return;
    setBackfilling(true);
    try {
      const res = await base44.functions.invoke("GetXauusdHistory", { period1: startSec, period2: endSec, interval: yahooIntervalRef.current });
      const data = res.data;
      if (!mountedRef.current) return;
      if (data?.candles?.length) {
        const merged = mergeCandles(candlesRef.current, data.candles);
        candlesRef.current = merged;
        buildPipeline(merged, sourceName);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      // Non-fatal: deep backfill failure shouldn't block the main pipeline.
      console.warn("Deep backfill failed:", e?.message || e);
    } finally {
      if (mountedRef.current) setBackfilling(false);
    }
  }, [buildPipeline, mergeCandles]);

  // Fetch missing candles from last known candle → now, at the source resolution.
  const backfill = useCallback(async (sourceName) => {
    const candles = candlesRef.current;
    if (!candles.length) return;
    const intervalMs = srcIntervalRef.current;
    const lastTime = candles[candles.length - 1].time;
    const now = Date.now();
    // Start one bar after the last candle we already have.
    const startSec = Math.floor((lastTime + intervalMs) / 1000);
    const endSec = Math.floor(now / 1000);
    if (endSec <= startSec) return; // already current
    setBackfilling(true);
    try {
      const res = await base44.functions.invoke("GetXauusdHistory", { period1: startSec, period2: endSec, interval: yahooIntervalRef.current });
      const data = res.data;
      if (!mountedRef.current) return;
      if (data?.error) {
        setError(`History backfill error: ${data.error}`);
        setBackfilling(false);
        return;
      }
      if (data?.candles?.length) {
        const merged = mergeCandles(candlesRef.current, data.candles);
        candlesRef.current = merged;
        buildPipeline(merged, sourceName);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError(`History backfill failed: ${e?.message || e}`);
    } finally {
      if (mountedRef.current) setBackfilling(false);
    }
  }, [buildPipeline, mergeCandles]);

  // Run the full pipeline from raw CSV text, then backfill the gap to now.
  const runPipelineText = useCallback(async (text, name) => {
    setError("");
    setLoading(true);
    setPipeline(null);
    setFileName(name);
    await new Promise((r) => setTimeout(r, 50));
    try {
      const { candles } = parseCSV(text);
      candlesRef.current = candles;
      // Detect source resolution so backfill stays resolution-consistent.
      const tf = detectSourceTimeframe(candles);
      srcIntervalRef.current = TIMEFRAME_MS[tf] || 3600000;
      yahooIntervalRef.current = YAHOO_INTERVAL[tf] || "1h";
      buildPipeline(candles, name);
      setLoading(false);
      // v3.2 — deep backfill first (extend history backward so D1/H4 complete),
      // then incremental backfill to the current date.
      await deepBackfill(name);
      await backfill(name);
      setLastSyncedAt(Date.now());
    } catch (e) {
      setError(`Engine error: ${e.message}`);
      setLoading(false);
    }
  }, [buildPipeline, backfill, deepBackfill]);

  // Load a user-selected file.
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      await runPipelineText(text, file.name);
    } catch (e) {
      setError(`Import error: ${e.message}`);
      setLoading(false);
    }
  }, [runPipelineText]);

  // v3.2 — Manual one-click re-sync: re-run the deep backfill (patch missing bars
  // backward) then the incremental backfill (forward to now). Used by the
  // SignalStatusBoard "Re-sync Data" button to clear a BLOCKED / DEGRADED gate
  // without a full page refresh.
  const resyncData = useCallback(async () => {
    if (!candlesRef.current.length) return;
    const name = fileName || "XAUUSD.csv";
    await deepBackfill(name);
    await backfill(name);
    setLastSyncedAt(Date.now());
  }, [deepBackfill, backfill, fileName]);

  // Periodic incremental refresh — append any new hourly candles since last update.
  const refreshNow = useCallback(async () => {
    if (!candlesRef.current.length) return;
    await backfill(fileName || "XAUUSD.csv");
    setLastSyncedAt(Date.now());
  }, [backfill, fileName]);

  // Initial mount: auto-load the seeded dataset, then start the refresh interval.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(defaultCsvUrl);
        const text = await res.text();
        if (!cancelled) await runPipelineText(text, defaultCsvUrl.split("/").pop() || "XAUUSD.csv");
      } catch (e) {
        if (!cancelled) {
          setError(`Auto-load failed: ${e.message}. Use the Import button to load a CSV manually.`);
          setLoading(false);
        }
      }
    })();
    const timer = setInterval(() => {
      if (!cancelled) refreshNow();
    }, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    pipeline,
    loading,
    backfilling,
    error,
    fileName,
    dataUpdatedThrough,
    handleFile,
    runPipelineText,
    fileInputRef,
    refreshNow,
    resyncData,
    lastSyncedAt
  };
}