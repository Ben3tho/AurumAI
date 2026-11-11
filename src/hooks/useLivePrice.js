import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Real-time XAUUSD price hook.
// Fires the GetXauusdPrice backend function on a fixed 1-second interval while live.
// On failure, switches to a 5-second retry until the feed recovers, then resumes 1s.
// Returns { price, lastUpdated, isLive, error }.
export default function useLivePrice() {
  const [price, setPrice] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetchPrice = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("GetXauusdPrice", {});
      if (!mountedRef.current) return false;
      const data = res.data;
      if (data && typeof data.price === "number" && Number.isFinite(data.price)) {
        setPrice(data.price);
        setLastUpdated(new Date(data.timestamp || Date.now()));
        setIsLive(true);
        setError(null);
        return true;
      }
      setIsLive(false);
      setError(data?.error || "No price returned");
      return false;
    } catch (e) {
      if (!mountedRef.current) return false;
      setIsLive(false);
      setError(e?.message || "Live feed error");
      return false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let interval;
    let retryTimer;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return; // skip overlap if upstream is slow
      inFlight = true;
      const ok = await fetchPrice();
      inFlight = false;
      // On failure, pause the 1s interval and retry every 5s until recovered.
      if (!ok && mountedRef.current) {
        clearInterval(interval);
        retryTimer = setTimeout(() => {
          interval = setInterval(tick, 1000);
        }, 5000);
      }
    };

    interval = setInterval(tick, 1000);
    tick(); // fire immediately on mount
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      clearTimeout(retryTimer);
    };
  }, [fetchPrice]);

  return { price, lastUpdated, isLive, error };
}