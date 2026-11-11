import React, { useState } from "react";
import { Send, MessageCircle, Bell } from "lucide-react";
import { base44 } from "@/api/base44Client";

// AURUM AI v3.0 — Alert settings.
// Telegram: auto-sends via Bot API (token is a server secret; chat id stored here).
// WhatsApp: opens wa.me with a prefilled message (tap-to-send — automated WhatsApp
// Business API requires Meta verification and is not configured here).

const LS_CHAT = "aurum_tg_chat";
const LS_AUTO = "aurum_auto_alert";

export default function AlertSettings({ currentAlertText }) {
  const [chatId, setChatId] = useState(localStorage.getItem(LS_CHAT) || "");
  const [auto, setAuto] = useState(localStorage.getItem(LS_AUTO) === "1");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const saveChat = (v) => { setChatId(v); localStorage.setItem(LS_CHAT, v); };
  const toggleAuto = (v) => { setAuto(v); localStorage.setItem(LS_AUTO, v ? "1" : "0"); };

  const testTelegram = async () => {
    if (!chatId) { setStatus("Enter a chat ID first."); return; }
    setSending(true); setStatus("");
    try {
      const res = await base44.functions.invoke("SendTelegramAlert", { chat_id: chatId, text: "🥇 *AURUM AI* — Telegram alert test successful.", parse_mode: "MarkdownV2" });
      const d = res.data;
      if (d?.error) setStatus(`Error: ${d.error}`);
      else setStatus("✓ Test alert sent.");
    } catch (e) {
      setStatus(`Error: ${e?.message || e}`);
    } finally { setSending(false); }
  };

  const waLink = currentAlertText
    ? `https://wa.me/?text=${encodeURIComponent(currentAlertText)}`
    : "https://wa.me/";

  return (
    <div className="hairline rounded-lg bg-surface p-4">
      <div className="flex items-center gap-2 mb-3"><Bell className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">Alerts · Telegram & WhatsApp</span></div>

      <label className="block mb-3">
        <span className="text-[0.625rem] font-data text-aurum-text-secondary">Telegram chat ID</span>
        <input type="text" value={chatId} onChange={(e) => saveChat(e.target.value)} placeholder="e.g. 123456789 or -100123456789" className="w-full mt-0.5 px-2 py-1.5 rounded-md hairline bg-surface-elevated text-aurum-text font-data text-sm focus:outline-none focus:ring-1 ring-gold" />
      </label>

      <div className="flex items-center gap-2 mb-3">
        <button onClick={testTelegram} disabled={sending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gold text-[#0B0D11] text-[0.75rem] font-data font-bold disabled:opacity-50">
          <Send className="w-3.5 h-3.5" /> {sending ? "Sending…" : "Test Telegram"}
        </button>
        <a href={waLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hairline bg-bull/10 text-bull text-[0.75rem] font-data font-bold">
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </a>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={auto} onChange={(e) => toggleAuto(e.target.checked)} className="accent-[hsl(var(--gold))]" />
        <span className="text-[0.6875rem] font-data text-aurum-text">Auto-send BUY/SELL signal alerts to Telegram</span>
      </label>

      {status && <p className="text-[0.6875rem] font-data text-aurum-text-secondary mt-2">{status}</p>}
      <p className="text-[0.625rem] font-data text-aurum-text-secondary mt-2">WhatsApp opens a share sheet (tap-to-send). Auto-sending WhatsApp needs the Business API.</p>
    </div>
  );
}