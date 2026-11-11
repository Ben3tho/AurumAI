// AURUM AI v3.0 — Live economic calendar (USD high-impact events).
// Proxies the keyless ForexFactory "faireconomy" JSON feed server-side and caches
// the raw feed in the CalendarCache entity so a single successful fetch serves
// subsequent calls. The news-block flag is recomputed from the cached events on
// every call against the current time, so the ±30 min window stays accurate even
// when the cache is up to 10 minutes old. Falls back to the next-week feed, then
// to a stale cache, before returning UNAVAILABLE.
// No secret required. Public macro data only.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000; // refresh upstream at most every 10 min
const WINDOW_MS = 30 * 60 * 1000; // +/- 30 min high-impact news block
const FEEDS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.json"
];

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function eatString(timeMs) {
  const d = new Date(timeMs + EAT_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} EAT`;
}

// Recompute the normalized events + news-block flag from raw feed text against `now`.
function recompute(rawText, now) {
  let raw;
  try {
    raw = JSON.parse(rawText);
  } catch (_e) {
    return { events: [], today: [], nextHigh: null, newsBlock: false, count: 0 };
  }
  if (!Array.isArray(raw)) {
    return { events: [], today: [], nextHigh: null, newsBlock: false, count: 0 };
  }

  let newsBlock = false;
  const events = raw
    .filter((e) => e.country === "USD" && (e.impact === "High" || e.impact === "Medium"))
    .map((e) => {
      const timeMs = new Date(e.date).getTime();
      if (Number.isNaN(timeMs)) return null;
      if (e.impact === "High" && Math.abs(timeMs - now) <= WINDOW_MS) newsBlock = true;
      return {
        title: e.title,
        country: e.country,
        impact: e.impact,
        timeMs,
        eat: eatString(timeMs),
        forecast: e.forecast || "",
        previous: e.previous || ""
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timeMs - b.timeMs);

  const nextHigh = events.find((e) => e.impact === "High" && e.timeMs > now) || null;
  const todayEat = eatString(now).slice(0, 10);
  const today = events.filter((e) => e.eat.slice(0, 10) === todayEat);

  return { events, today, nextHigh, newsBlock, count: events.length };
}

async function fetchFeed(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; AURUM-AI/3.0)" },
      signal: controller.signal
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const now = Date.now();

    // --- Check the cache ---
    let latest = null;
    try {
      const cached = await base44.asServiceRole.entities.CalendarCache.list("-fetched_at", 1);
      latest = cached && cached[0] ? cached[0] : null;
    } catch (_e) {
      latest = null;
    }

    // Fresh cache — recompute the block flag against `now` and return.
    if (latest && latest.raw_json && now - latest.fetched_at < CACHE_TTL_MS) {
      const result = recompute(latest.raw_json, now);
      return Response.json({
        ...result,
        fetchedAt: latest.fetched_at,
        source: latest.source,
        cached: true
      });
    }

    // --- Refresh upstream (with fallback feed) ---
    let raw = null;
    let source = null;
    let lastError = null;
    for (const url of FEEDS) {
      const text = await fetchFeed(url);
      if (text) {
        // Validate it parses before accepting.
        try {
          JSON.parse(text);
          raw = text;
          source = url;
          break;
        } catch (_e) {
          lastError = `Bad JSON from ${url}`;
        }
      } else {
        lastError = `Upstream ${url} failed`;
      }
    }

    if (raw != null) {
      // Upsert the cache (shared singleton).
      try {
        if (latest && latest.id) {
          await base44.asServiceRole.entities.CalendarCache.update(latest.id, {
            raw_json: raw,
            fetched_at: now,
            source
          });
        } else {
          await base44.asServiceRole.entities.CalendarCache.create({
            raw_json: raw,
            fetched_at: now,
            source
          });
        }
      } catch (_e) {
        // Cache write failure is non-fatal — we still return fresh data.
      }
      const result = recompute(raw, now);
      return Response.json({
        ...result,
        fetchedAt: now,
        source,
        cached: false
      });
    }

    // --- Upstream failed — serve a stale cache if we have one ---
    if (latest && latest.raw_json) {
      const result = recompute(latest.raw_json, now);
      return Response.json({
        ...result,
        fetchedAt: latest.fetched_at,
        source: latest.source,
        cached: true,
        stale: true
      });
    }

    return Response.json({ error: lastError || "Calendar fetch error" }, { status: 502 });
  } catch (error) {
    return Response.json({ error: error?.message || "Calendar fetch error" }, { status: 500 });
  }
}