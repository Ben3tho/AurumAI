import React, { useState } from "react";
import { NotebookPen, Trash2, Check, X, Plus } from "lucide-react";

// AURUM AI v3.0 — AI Trade Journal. Logs every trade with entry/exit/RR/
// confidence/result + screenshot timestamp. Close and delete supported.
const fmt = (v) => (v == null ? "—" : Number(v).toFixed(2));

export default function TradeJournal({ trades, addTrade, closeTrade, deleteTrade, currentSignal }) {
  const [closing, setClosing] = useState(null);
  const [exitPrice, setExitPrice] = useState("");

  const logCurrent = async () => {
    if (!currentSignal?.eligible) return;
    const s = currentSignal;
    await addTrade({
      direction: s.direction === "bull" ? "BUY" : "SELL",
      grade: s.grade || "MANUAL",
      entry_price: s.entry,
      exit_price: 0,
      stop_loss: s.sl,
      take_profit_1: s.tp1,
      take_profit_2: s.tp2,
      take_profit_3: s.tp3,
      risk_reward: s.rr,
      confidence: s.confidence,
      lot_size: 0,
      risk_percent: 1,
      timeframe_confluence: `D1=${(s.confluence.D1||"").toUpperCase()},H4=${(s.confluence.H4||"").toUpperCase()},H1=${(s.confluence.H1||"").toUpperCase()},M15=${(s.confluence.M15||"").toUpperCase()}`,
      session: s.newsBlock ? "NEWS" : "LIVE",
      kill_zone: "AUTO",
      entry_time: new Date().toISOString()
    });
  };

  const doClose = async (t) => {
    const ex = Number(exitPrice);
    if (!ex) return;
    const dir = t.direction === "BUY" ? 1 : -1;
    const pips = (ex - t.entry_price) * dir * 10; // 1 pip = $0.10 on XAUUSD
    const pnl = pips * (t.lot_size || 0.01) * 1; // approximate USD per pip per 0.01 lot
    await closeTrade(t.id, ex, pips >= 0 ? "win" : "loss", Math.round(pips), Math.round(pnl));
    setClosing(null); setExitPrice("");
  };

  return (
    <div className="hairline rounded-lg bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><NotebookPen className="w-4 h-4 text-gold" /><span className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">AI Trade Journal</span></div>
        <button
          onClick={logCurrent}
          disabled={!currentSignal?.eligible}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-gold text-[#0B0D11] text-[0.6875rem] font-data font-bold disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Log Signal
        </button>
      </div>

      {!trades.length ? (
        <p className="text-[0.75rem] text-aurum-text-secondary font-data">No trades logged yet. Eligible sniper signals can be logged with the button above.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {trades.map((t) => (
            <div key={t.id} className="hairline rounded-md bg-surface-elevated px-3 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-data font-bold ${t.direction === "BUY" ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear"}`}>{t.direction}</span>
                  {t.grade && <span className="text-[0.625rem] font-data text-gold">{t.grade}</span>}
                  <span className="text-[0.75rem] font-data text-aurum-text">E {fmt(t.entry_price)} · SL {fmt(t.stop_loss)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ResultBadge result={t.result} />
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[0.625rem] font-data text-aurum-text-secondary">
                  Conf {t.confidence} · RR 1:{t.risk_reward} · {t.entry_time ? new Date(t.entry_time).toLocaleDateString() : "—"}
                </span>
                {t.screenshot_timestamp && <span className="text-[0.625rem] font-data text-aurum-text-secondary">📸 {new Date(t.screenshot_timestamp).toLocaleTimeString()}</span>}
              </div>
              {t.result === "pending" && (
                <div className="flex items-center gap-2 mt-2">
                  {closing === t.id ? (
                    <>
                      <input type="number" placeholder="Exit price" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} className="flex-1 px-2 py-1 rounded-md hairline bg-surface text-aurum-text font-data text-xs" />
                      <button onClick={() => doClose(t)} className="flex items-center gap-1 px-2 py-1 rounded bg-bull text-[#0B0D11] text-[0.625rem] font-data font-bold"><Check className="w-3 h-3" />Save</button>
                      <button onClick={() => setClosing(null)} className="px-1.5 py-1 rounded hairline bg-surface text-aurum-text-secondary text-[0.625rem]"><X className="w-3 h-3" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setClosing(t.id); setExitPrice(""); }} className="flex items-center gap-1 px-2 py-1 rounded hairline bg-surface text-aurum-text text-[0.625rem] font-data">Close trade</button>
                      <button onClick={() => deleteTrade(t.id)} className="px-1.5 py-1 rounded hairline bg-surface text-bear text-[0.625rem]"><Trash2 className="w-3 h-3" /></button>
                    </>
                  )}
                </div>
              )}
              {t.result !== "pending" && t.pnl_pips != null && (
                <div className="text-[0.625rem] font-data mt-1">
                  <span className={t.pnl_pips >= 0 ? "text-bull" : "text-bear"}>{t.pnl_pips >= 0 ? "+" : ""}{t.pnl_pips} pips · ${t.pnl_usd || 0}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultBadge({ result }) {
  const map = { win: "bg-bull/10 text-bull", loss: "bg-bear/10 text-bear", breakeven: "bg-surface text-aurum-text-secondary", pending: "bg-gold/10 text-gold" };
  return <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-data font-bold ${(map[result] || map.pending)}`}>{(result || "pending").toUpperCase()}</span>;
}