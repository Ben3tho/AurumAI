import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { resample } from "@/lib/aurum/multiTimeframe";

// AURUM AI v3.0 — M5 + M15 backfill for sniper entries.
// Yahoo Finance supplies 5m OHLCV for ~60 days. We fetch the recent window,
// dedup by timestamp, resample to M15, and refresh incrementally.
const FULL_DAYS = 60;
const REFRESH_MS = 3 * 60 * 1000;

export default function useM5Data() {
  const [m5, setM5] = useState([]);
  const [m15, setM15] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedThrough, setUpdatedThrough] = useState(null);
  const mapRef = useRef(new Map());
  const mountedRef = useRef(true);

  const fetchRange = async (daysBack) => {
    const nowSec = Math.floor(Date.now() / 1000);
    const startSec = nowSec - daysBack * 24 * 3600;
    const res = await base44.functions.invoke("GetXauusdHistory", { interval: "5m", period1: startSec, period2: nowSec });
    const d = res.data;
    if (d?.error) throw new Error(d.error);
    if (!d?.candles?.length) throw new Error("No M5 candles returned");
    for (const c of d.candles) mapRef.current.set(c.time, c);
    const arr = Array.from(mapRef.current.values()).sort((a, b) => a.time - b.time);
    return arr;
  };

  const build = (arr) => {
    const m15Arr = resample(arr, "M15");
    setM5(arr);
    setM15(m15Arr);
    setUpdatedThrough(arr.length ? new Date(arr[arr.length - 1].time) : null);
  };

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const arr = await fetchRange(FULL_DAYS);
        if (!mountedRef.current) return;
        build(arr);
      } catch (e) {
        if (!mountedRef.current) return;
        setError(e?.message || "M5 fetch failed");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    const t = setInterval(() => {
      fetchRange(2).then((arr) => { if (mountedRef.current) build(arr); }).catch(() => {});
    }, REFRESH_MS);
    return () => { mountedRef.current = false; clearInterval(t); };
  }, []);

  return { m5, m15, loading, error, updatedThrough };
}