import { useState, useEffect } from "react";

// AURUM AI v3.2 — Economic-calendar news pause countdown.
// Given the calendar events + newsBlock flag, finds the nearest high-impact USD
// event within the ±30-minute window and returns a live (1s-tick) countdown.
//   phase "PRE"  → counts down to the release time ("High-Impact News in …")
//   phase "POST" → counts down to release + 30m ("Volatility clearing in …")
// Returns null when no high-impact event is inside the active window.
const WINDOW_MS = 30 * 60 * 1000;

function pad(n) { return n < 10 ? "0" + n : "" + n; }

export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export default function useNewsCountdown(events, newsBlock) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!newsBlock || !Array.isArray(events) || !events.length) return null;

  let nearest = null;
  let nearestDiff = Infinity;
  for (const e of events) {
    if (e.impact !== "High") continue;
    const diff = Math.abs(e.timeMs - now);
    if (diff <= WINDOW_MS && diff < nearestDiff) {
      nearest = e;
      nearestDiff = diff;
    }
  }
  if (!nearest) return null;

  const eventTime = nearest.timeMs;
  const phase = now < eventTime ? "PRE" : "POST";
  const targetMs = phase === "PRE" ? eventTime : eventTime + WINDOW_MS;
  const remaining = Math.max(0, targetMs - now);
  return { event: nearest, phase, remaining, eventTime, targetMs };
}