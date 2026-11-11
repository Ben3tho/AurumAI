import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

// AURUM AI v3.0 — Live USD economic calendar.
// Fetches high/medium impact USD events and a news-block flag from the
// GetEconomicCalendar backend function. Refreshes every 5 minutes.
const REFRESH_MS = 5 * 60 * 1000;

export default function useEconomicCalendar() {
  const [events, setEvents] = useState([]);
  const [today, setToday] = useState([]);
  const [nextHigh, setNextHigh] = useState(null);
  const [newsBlock, setNewsBlock] = useState(false);
  const [newsStatus, setNewsStatus] = useState("LOADING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);
  const retryRef = useRef(null);

  // V2.4 — on 502 / upstream error, mark UNAVAILABLE and retry after 30s.
  // Signal generation continues on technicals only (newsBlock=false, UNKNOWN).
  const scheduleRetry = () => {
    if (retryRef.current) return;
    retryRef.current = setTimeout(() => { retryRef.current = null; load(); }, 30000);
  };
  const clearRetry = () => { if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; } };

  const load = async () => {
    try {
      const res = await base44.functions.invoke("GetEconomicCalendar", {});
      const d = res.data;
      if (!mountedRef.current) return;
      if (d?.error) {
        setError("");
        setNewsStatus("UNAVAILABLE");
        setNewsBlock(false);
        scheduleRetry();
        return;
      }
      setEvents(d.events || []);
      setToday(d.today || []);
      setNextHigh(d.nextHigh || null);
      setNewsBlock(!!d.newsBlock);
      setNewsStatus(d.newsBlock ? "BLOCK" : "LIVE");
      setError("");
      clearRetry();
    } catch (e) {
      if (!mountedRef.current) return;
      setError("");
      setNewsStatus("UNAVAILABLE");
      setNewsBlock(false);
      scheduleRetry();
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { mountedRef.current = false; clearInterval(t); clearRetry(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { events, today, nextHigh, newsBlock, newsStatus, loading, error, refresh: load };
}