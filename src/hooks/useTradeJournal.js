import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";

// AURUM AI v3.0 — AI Trade Journal CRUD.
export default function useTradeJournal() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const list = await base44.entities.TradeJournal.list("-entry_time", 200);
      if (!mountedRef.current) return;
      setTrades(list || []);
      setError("");
    } catch (e) {
      if (mountedRef.current) setError(e?.message || "Failed to load journal");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const addTrade = useCallback(async (data) => {
    const rec = await base44.entities.TradeJournal.create({
      result: "pending",
      exit_price: 0,
      ...data,
      screenshot_timestamp: data.screenshot_timestamp || new Date().toISOString()
    });
    if (mountedRef.current) setTrades((prev) => [rec, ...prev]);
    return rec;
  }, []);

  const updateTrade = useCallback(async (id, data) => {
    const rec = await base44.entities.TradeJournal.update(id, data);
    if (mountedRef.current) setTrades((prev) => prev.map((t) => (t.id === id ? rec : t)));
    return rec;
  }, []);

  const closeTrade = useCallback(async (id, exitPrice, result, pnlPips, pnlUsd) => {
    return updateTrade(id, {
      exit_price: exitPrice,
      result,
      pnl_pips: pnlPips,
      pnl_usd: pnlUsd,
      exit_time: new Date().toISOString()
    });
  }, [updateTrade]);

  const deleteTrade = useCallback(async (id) => {
    await base44.entities.TradeJournal.delete(id);
    if (mountedRef.current) setTrades((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [refresh]);

  return { trades, loading, error, addTrade, updateTrade, closeTrade, deleteTrade, refresh };
}