// AURUM AI v3.0 — Sends a BUY/SELL alert to a Telegram chat via Bot API.
// Reads TELEGRAM_BOT_TOKEN from secrets. The chat id comes from the request
// payload (the builder sets it in the Alert Settings UI); falls back to the
// TELEGRAM_CHAT_ID secret. Returns Telegram's result. No entity access needed.

import { secrets } from "base44:runtime";

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = secrets.get("TELEGRAM_BOT_TOKEN");
    const chatId = String(body.chat_id || secrets.get("TELEGRAM_CHAT_ID") || "");
    const text = String(body.text || "").slice(0, 4000);
    // Only set parse_mode when the caller explicitly requests it; plain text is
    // safest for automated alerts (no markdown escaping needed).
    const allowedModes = ["HTML", "MarkdownV2"];
    const parseMode = allowedModes.includes(body.parse_mode) ? body.parse_mode : null;

    if (!token) return Response.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
    if (!chatId) return Response.json({ error: "No chat_id provided" }, { status: 400 });
    if (!text) return Response.json({ error: "No message text" }, { status: 400 });

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    };
    if (parseMode) payload.parse_mode = parseMode;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return Response.json({ error: data.description || `Telegram error (${res.status})` }, { status: 502 });
    }
    return Response.json({ ok: true, message_id: data.result?.message_id });
  } catch (error) {
    return Response.json({ error: error?.message || "Telegram send error" }, { status: 500 });
  }
}