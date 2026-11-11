import React, { useState, useMemo, useRef, useEffect } from "react";
import LeftRail from "@/components/aurum/LeftRail";
import HeroBar from "@/components/aurum/HeroBar";
import LiveSignalCard from "@/components/aurum/LiveSignalCard";
import MTFCanvas from "@/components/aurum/MTFCanvas";
import DataIntegrityPanel from "@/components/aurum/DataIntegrityPanel";
import BacktestRegion from "@/components/aurum/BacktestRegion";
import BreakdownReport from "@/components/aurum/BreakdownReport";
import BottomDock from "@/components/aurum/BottomDock";
import MobileHeroCard from "@/components/aurum/MobileHeroCard";
import KillZoneBar from "@/components/aurum/KillZoneBar";
import LiquidityHeatmap from "@/components/aurum/LiquidityHeatmap";
import RiskManager from "@/components/aurum/RiskManager";
import SniperSignalCard from "@/components/aurum/SniperSignalCard";
import EconomicCalendarPanel from "@/components/aurum/EconomicCalendarPanel";
import TradeJournal from "@/components/aurum/TradeJournal";
import PerformanceAnalytics from "@/components/aurum/PerformanceAnalytics";
import AlertSettings from "@/components/aurum/AlertSettings";
import InstitutionalChart from "@/components/aurum/InstitutionalChart";
import M15H1ConfluenceCard from "@/components/aurum/M15H1ConfluenceCard";
import SignalStatusBoard from "@/components/aurum/SignalStatusBoard";
import ExecutionCockpit from "@/components/aurum/ExecutionCockpit";
import { computeFinalSignalGate } from "@/lib/aurum/finalSignalGate";
import useLivePrice from "@/hooks/useLivePrice";
import useAutoUpdatingPipeline from "@/hooks/useAutoUpdatingPipeline";
import useEconomicCalendar from "@/hooks/useEconomicCalendar";
import useM5Data from "@/hooks/useM5Data";
import useTradeJournal from "@/hooks/useTradeJournal";
import { computeSniperSignal } from "@/lib/aurum/sniperEngine";
import { buildRiskPlan } from "@/lib/aurum/riskManager";
import { computeM15H1Confluence } from "@/lib/aurum/m15H1Confluence";
import { computeLiquidityHeatmap } from "@/lib/aurum/liquidityHeatmap";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Loader2, AlertCircle } from "lucide-react";

function getCurrentSession() {
  const h = new Date().getUTCHours();
  if (h >= 0 && h < 7) return "ASIAN SESSION";
  if (h >= 7 && h < 12) return "LONDON ACTIVE";
  if (h >= 12 && h < 16) return "LONDON/NY OVERLAP";
  if (h >= 16 && h < 21) return "NEW YORK ACTIVE";
  return "OFF-SESSION";
}

const DEFAULT_CSV_URL = "https://media.base44.com/files/public/6aaff96c746d1c99ddd73156/691f4f5a3_XAUUSD_historical_data2.csv";

function buildAlertText(gate, sniper, livePrice) {
  if (!gate || (gate.finalSignal !== "BUY" && gate.finalSignal !== "SELL")) return null;
  const tv = gate.tradeValidation;
  if (!tv || tv.entry == null) return null;
  const f = (v) => (v == null ? "-" : Number(v).toFixed(2));
  const grade = sniper?.eligible ? ` ${sniper.grade}` : "";
  return [
    `AURUM AI —${grade} ${gate.finalSignal} SIGNAL`,
    `Bias: ${gate.finalBias} | Confluence: ${gate.confluence.score}/100`,
    `Entry: ${f(tv.entry)} | SL: ${f(tv.sl)}`,
    `TP1: ${f(tv.tp1)}${sniper?.tp2 ? ` | TP2: ${f(sniper.tp2)}` : ""}${sniper?.tp3 ? ` | TP3: ${f(sniper.tp3)}` : ""}`,
    `RR 1:${tv.rr} | Spot: ${livePrice != null ? f(livePrice) : "-"}`,
    sniper?.m5Trigger ? `Trigger: ${sniper.m5Trigger.sweepType} sweep + ${sniper.m5Trigger.fvgType} FVG` : "",
    gate.setup?.status ? `Setup: ${gate.setup.status}` : ""
  ].filter(Boolean).join("\n");
}

export default function Home() {
  const {
    pipeline, loading, backfilling, error, fileName, dataUpdatedThrough,
    handleFile, fileInputRef, refreshNow, resyncData, lastSyncedAt
  } = useAutoUpdatingPipeline(DEFAULT_CSV_URL);

  const { price: livePrice, lastUpdated, isLive } = useLivePrice();
  const econ = useEconomicCalendar();
  const { m5, m15 } = useM5Data();
  const journal = useTradeJournal();
  const { addTrade, closeTrade } = journal;
  const { toast } = useToast();

  const [mobileTab, setMobileTab] = useState("live");
  const [dragOver, setDragOver] = useState(false);

  // M15 + H1 Confluence Engine — H1 BOS/CHOCH trend agrees with M15 FVG/OB/Sweep setup.
  // Computed first so its POI entry zone can feed the sniper execution-distance gate.
  const m15h1 = useMemo(() => {
    const h1 = pipeline?.timeframes?.H1 || [];
    const m15src = pipeline?.timeframes?.M15 || [];
    if (!h1.length || !m15src.length) return null;
    return computeM15H1Confluence(h1, m15src);
  }, [pipeline]);

  const heatmap = useMemo(() => {
    const src = pipeline?.timeframes?.H1 || pipeline?.timeframes?.[pipeline?.sourceTimeframe];
    return src ? computeLiquidityHeatmap(src) : null;
  }, [pipeline]);

  // v3.2 Sniper signal — D1/H4/H1/M15 confluence + M5 execution + news block +
  // execution-distance gate (live price vs M15 POI zone). Falls back to the M15
  // zone as the execution reference when H1+M15 are confirmed but M5 has no trigger.
  const sniper = useMemo(() => {
    if (!pipeline?.mtfConfidence) return null;
    return computeSniperSignal({
      mtfConfidence: pipeline.mtfConfidence,
      m15Candles: m15,
      m5Candles: m5,
      newsBlock: econ.newsBlock,
      livePrice,
      entryZone: m15h1?.entryZone
    });
  }, [pipeline, m5, m15, econ.newsBlock, livePrice, m15h1]);

  // V3.1 — Authoritative Final Signal Gate (single source for signal/bias/confluence).
  const gate = useMemo(() => {
    if (!pipeline) return null;
    return computeFinalSignalGate({
      timeframes: pipeline.timeframes,
      m15h1,
      sniper,
      validation: pipeline.validation,
      newsBlock: econ.newsBlock,
      newsStatus: econ.newsStatus,
      livePrice,
      sourceTimeframe: pipeline.sourceTimeframe,
      fileName
    });
  }, [pipeline, m15h1, sniper, econ.newsBlock, econ.newsStatus, livePrice, fileName]);

  const heroEval = gate ? {
    signal: gate.finalSignal,
    marketBias: gate.finalBias,
    confluence: gate.confluence.score,
    waitReasons: gate.waitReasons,
    liveBias: gate.biases.M15
  } : null;

  const alertText = useMemo(() => buildAlertText(gate, sniper, livePrice), [gate, sniper, livePrice]);

  // Auto-send Telegram alert the moment the Final Signal Gate authorizes a NEW
  // BUY/SELL setup. Edge-triggered (fires only on WAIT→BUY or WAIT→SELL
  // transitions) so a persistent signal never spams the chat.
  const prevSignalRef = useRef(null);
  useEffect(() => {
    if (!gate) return;
    const sig = gate.finalSignal;
    const prev = prevSignalRef.current;
    prevSignalRef.current = sig;
    if (sig !== "BUY" && sig !== "SELL") return;
    if (prev === sig) return;
    const chatId = localStorage.getItem("aurum_tg_chat") || "";
    const auto = localStorage.getItem("aurum_auto_alert") === "1";
    if (!auto || !chatId) return;
    const text = buildAlertText(gate, sniper, livePrice);
    if (!text) return;
    base44.functions.invoke("SendTelegramAlert", { chat_id: chatId, text }).catch(() => {});
  }, [gate, sniper, livePrice]);

  // v3.2 — Auto-log to the Trade Journal the moment the Final Signal Gate
  // authorizes a NEW BUY/SELL setup (edge-triggered on WAIT→BUY/SELL). Captures
  // entry/SL/TP1-3/lot/confluence/timestamp directly into the Journal database.
  const loggedSignalRef = useRef(null);
  useEffect(() => {
    if (!gate) return;
    const sig = gate.finalSignal;
    const prev = loggedSignalRef.current;
    loggedSignalRef.current = sig;
    if (sig !== "BUY" && sig !== "SELL") return;
    if (prev === sig) return;
    const tv = gate.tradeValidation;
    if (!tv || tv.entry == null) return;
    const plan = buildRiskPlan({ accountSize: 10000, riskPercent: 1, direction: sig, entry: tv.entry, sl: tv.sl, tp1: tv.tp1, tp2: sniper?.tp2, tp3: sniper?.tp3 });
    const biases = gate.biases || {};
    addTrade({
      direction: sig,
      grade: sniper?.grade || "AUTO",
      entry_price: tv.entry,
      exit_price: 0,
      stop_loss: tv.sl,
      take_profit_1: tv.tp1,
      take_profit_2: sniper?.tp2 ?? null,
      take_profit_3: sniper?.tp3 ?? null,
      risk_reward: tv.rr,
      confidence: gate.confluence?.score ?? 0,
      lot_size: plan.lot,
      risk_percent: 1,
      timeframe_confluence: `D1=${biases.D1 || ""},H4=${biases.H4 || ""},H1=${biases.H1 || ""},M15=${biases.M15 || ""}`,
      session: getCurrentSession(),
      kill_zone: "AUTO",
      entry_time: new Date().toISOString()
    }).then(() => {
      toast({
        title: "Trade Auto-Logged",
        description: `${sig} XAUUSD @ ${Number(tv.entry).toFixed(2)} | Lot: ${plan.lot.toFixed(2)}`,
      });
    }).catch(() => {});
  }, [gate, sniper, addTrade, toast]);

  // v3.2 — Journal auto-close watcher: marks pending trades WIN/LOSS when the
  // live price touches TP1 or SL, recording the close timestamp + realized PnL.
  useEffect(() => {
    if (livePrice == null) return;
    const pending = journal.trades.filter(
      (t) => t.result === "pending" && t.entry_price != null && t.stop_loss != null && t.take_profit_1 != null
    );
    pending.forEach((t) => {
      let hit = null;
      if (t.direction === "BUY") {
        if (livePrice >= t.take_profit_1) hit = "win";
        else if (livePrice <= t.stop_loss) hit = "loss";
      } else {
        if (livePrice <= t.take_profit_1) hit = "win";
        else if (livePrice >= t.stop_loss) hit = "loss";
      }
      if (!hit) return;
      const dir = t.direction === "BUY" ? 1 : -1;
      const exitPrice = hit === "win" ? t.take_profit_1 : t.stop_loss;
      const pips = Math.round((exitPrice - t.entry_price) * dir * 10);
      const pnl = Math.round(pips * (t.lot_size || 0.01));
      closeTrade(t.id, exitPrice, hit, pips, pnl).catch(() => {});
    });
  }, [livePrice, journal.trades, closeTrade]);

  const onInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const hasData = !!pipeline;
  const session = getCurrentSession();

  return (
    <div className="min-h-screen bg-[#0B0D11] text-aurum-text" style={{ paddingLeft: 0 }}>
      <input ref={fileInputRef} type="file" accept=".csv" onChange={onInputChange} className="hidden" />

      <LeftRail hasData={hasData} onFileSelect={() => fileInputRef.current?.click()} engineRunning={loading} fileName={fileName} />

      <div className="md:pl-16">
        {/* Mobile sticky top bar */}
        <div className="md:hidden sticky top-0 z-20 bg-[#0B0D11]/95 backdrop-blur border-b hairline px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-gold flex items-center justify-center font-display font-bold text-[#0B0D11] text-sm">A</div>
            <span className="font-display font-bold text-sm text-aurum-text">AURUM AI</span>
            <span className="text-[0.625rem] text-gold font-data">v3.0</span>
            {backfilling && <span className="text-[0.625rem] text-gold font-data">syncing…</span>}
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hairline bg-surface-elevated text-[0.75rem] font-data text-aurum-text-secondary">
            <Upload className="w-3.5 h-3.5" /> {hasData ? "Loaded" : "Import"}
          </button>
        </div>

        <main className="p-4 pb-24 md:pb-6 md:p-6 max-w-[1600px] mx-auto">
          {dragOver && (
            <div className="fixed inset-0 z-50 bg-[#0B0D11]/80 flex items-center justify-center pointer-events-none">
              <div className="hairline gold-glow rounded-lg bg-surface px-12 py-8 text-center">
                <Upload className="w-10 h-10 text-gold mx-auto mb-3" />
                <p className="font-display font-bold text-aurum-text">Drop XAUUSD CSV</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-gold animate-spin mb-4" />
              <p className="text-sm text-aurum-text-secondary font-data">Running validation & backtest engine…</p>
              <p className="text-[0.75rem] text-aurum-text-secondary font-data mt-1">{fileName}</p>
            </div>
          )}

          {error && !loading && (
            <div className="hairline rounded-lg bg-bear/10 p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-bear flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-bear font-data font-medium">Import Error</p>
                <p className="text-[0.8125rem] text-aurum-text-secondary font-data mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && (
            <>
              {!hasData && !error && (
                <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} onClick={() => fileInputRef.current?.click()} className="hairline rounded-lg border-dashed bg-surface p-12 md:p-20 text-center cursor-pointer hover:bg-surface-elevated transition-colors mb-6">
                  <div className="w-16 h-16 rounded-full bg-surface-elevated hairline flex items-center justify-center mx-auto mb-5">
                    <Upload className="w-7 h-7 text-gold" />
                  </div>
                  <h2 className="font-display font-bold text-2xl text-aurum-text mb-2">Import Historical Data</h2>
                  <p className="text-[0.875rem] text-aurum-text-secondary font-data max-w-md mx-auto">
                    Drop or click to upload a <span className="text-gold">XAUUSD CSV</span> (M5, M15, H1, or D1) to run real data validation, multi-timeframe SMC analysis, sniper entries, chronological backtest, and Monte Carlo simulation.
                  </p>
                  <p className="text-[0.75rem] text-aurum-text-secondary font-data mt-4">No data loaded · Classification: <span className="text-aurum-text">INSUFFICIENT DATA</span></p>
                </div>
              )}

              {hasData && (
                <>
                  <div className="mb-4">
                    <HeroBar lastCandle={pipeline.lastCandle} latestSignal={pipeline.latestSignal} session={session} hasData={hasData} classification={pipeline.classification} livePrice={livePrice} lastUpdated={lastUpdated} isLive={isLive} dataUpdatedThrough={dataUpdatedThrough} backfilling={backfilling} onRefresh={refreshNow} evaluation={heroEval} />
                  </div>

                  {/* v3.1 Signal Status Board — single authoritative status */}
                  <div className="hidden md:block mb-4">
                    <SignalStatusBoard gate={gate} hasData={hasData} livePrice={livePrice} isLive={isLive} dataUpdatedThrough={dataUpdatedThrough} backfilling={backfilling} histError={error} fileName={fileName} onResync={resyncData} resyncing={backfilling} newsBlock={econ.newsBlock} newsEvents={econ.events} lastSyncedAt={lastSyncedAt} />
                  </div>

                  {/* v3.0 Institutional chart + Kill zones */}
                  <div className="hidden md:block mb-4">
                    <InstitutionalChart candles={pipeline.timeframes?.H1 || []} m5Candles={m5} livePrice={livePrice} sniper={sniper} />
                  </div>
                  <div className="hidden md:block mb-4">
                    <KillZoneBar />
                  </div>

                  {/* M15 + H1 Confluence Engine */}
                  <div className="hidden md:grid grid-cols-12 gap-2 mb-4">
                    <div className="col-span-12"><M15H1ConfluenceCard confluence={m15h1} livePrice={livePrice} gate={gate} /></div>
                  </div>

                  {/* v3.0 Sniper + Risk + Liquidity */}
                  <div className="hidden md:grid grid-cols-12 gap-2 mb-4">
                    <div className="col-span-4"><SniperSignalCard sniper={sniper} gate={gate} /></div>
                    <div className="col-span-4"><RiskManager direction={sniper?.direction} entry={sniper?.entry} sl={sniper?.sl} tp1={sniper?.tp1} tp2={sniper?.tp2} tp3={sniper?.tp3} /></div>
                    <div className="col-span-4"><LiquidityHeatmap heatmap={heatmap} /></div>
                  </div>

                  {/* Existing core grid */}
                  <div className="hidden md:grid grid-cols-12 gap-2 mb-4">
                    <div className="col-span-4"><LiveSignalCard gate={gate} sniper={sniper} hasData={hasData} livePrice={livePrice} /></div>
                    <div className="col-span-5"><MTFCanvas mtfBias={pipeline.mtfBias} mtfOrder={pipeline.mtfOrder} sourceTimeframe={pipeline.sourceTimeframe} smcCounts={pipeline.smcCounts} hasData={hasData} /></div>
                    <div className="col-span-3"><DataIntegrityPanel validation={pipeline.validation} stats={pipeline.stats} monteCarlo={pipeline.monteCarlo} classification={pipeline.classification} hasData={hasData} /></div>
                  </div>

                  {/* v3.0 Economic calendar + Journal + Performance */}
                  <div className="hidden md:grid grid-cols-12 gap-2 mb-4">
                    <div className="col-span-4"><EconomicCalendarPanel today={econ.today} nextHigh={econ.nextHigh} newsBlock={econ.newsBlock} newsStatus={econ.newsStatus} loading={econ.loading} error={econ.error} /></div>
                    <div className="col-span-4"><TradeJournal trades={journal.trades} addTrade={journal.addTrade} closeTrade={journal.closeTrade} deleteTrade={journal.deleteTrade} currentSignal={sniper} /></div>
                    <div className="col-span-4"><PerformanceAnalytics trades={journal.trades} /></div>
                  </div>

                  {/* v3.0 Alert settings */}
                  <div className="hidden md:block mb-4 max-w-md">
                    <AlertSettings currentAlertText={alertText} />
                  </div>

                  <div className="hidden md:block mb-4">
                    <BacktestRegion equityCurve={pipeline.equityCurve} trades={pipeline.trades} stats={pipeline.stats} hasData={hasData} backtestStatus={pipeline.backtestStatus} datasetInfo={pipeline.datasetInfo} zeroTradeReason={pipeline.zeroTradeReason} signalCount={pipeline.signalCount} fileName={fileName} />
                  </div>
                  <div className="hidden md:block">
                    <BreakdownReport byDirection={pipeline.byDirection} bySession={pipeline.bySession} byScore={pipeline.byScore} walkForward={pipeline.walkForward} monteCarlo={pipeline.monteCarlo} stats={pipeline.stats} hasData={hasData} />
                  </div>

                  {/* ---------- Mobile ---------- */}
                  <div className="md:hidden">
                    {mobileTab === "live" && (
                      <div className="space-y-4">
                        <ExecutionCockpit gate={gate} sniper={sniper} m5Candles={m5} livePrice={livePrice} />
                        <MobileHeroCard latestSignal={pipeline.latestSignal} lastCandle={pipeline.lastCandle} hasData={hasData} livePrice={livePrice} lastUpdated={lastUpdated} isLive={isLive} dataUpdatedThrough={dataUpdatedThrough} backfilling={backfilling} />
                        <SignalStatusBoard gate={gate} hasData={hasData} livePrice={livePrice} isLive={isLive} dataUpdatedThrough={dataUpdatedThrough} backfilling={backfilling} histError={error} fileName={fileName} onResync={resyncData} resyncing={backfilling} newsBlock={econ.newsBlock} newsEvents={econ.events} lastSyncedAt={lastSyncedAt} />
                        <KillZoneBar />
                        <M15H1ConfluenceCard confluence={m15h1} livePrice={livePrice} gate={gate} />
                        <InstitutionalChart candles={pipeline.timeframes?.H1 || []} m5Candles={m5} livePrice={livePrice} sniper={sniper} />
                      </div>
                    )}

                    {mobileTab === "sniper" && (
                      <div className="space-y-4">
                        <SniperSignalCard sniper={sniper} gate={gate} />
                        <RiskManager direction={sniper?.direction} entry={sniper?.entry} sl={sniper?.sl} tp1={sniper?.tp1} tp2={sniper?.tp2} tp3={sniper?.tp3} />
                        <LiquidityHeatmap heatmap={heatmap} />
                        <EconomicCalendarPanel today={econ.today} nextHigh={econ.nextHigh} newsBlock={econ.newsBlock} newsStatus={econ.newsStatus} loading={econ.loading} error={econ.error} />
                        <AlertSettings currentAlertText={alertText} />
                      </div>
                    )}

                    {mobileTab === "data" && (
                      <DataIntegrityPanel validation={pipeline.validation} stats={pipeline.stats} monteCarlo={pipeline.monteCarlo} classification={pipeline.classification} hasData={hasData} />
                    )}

                    {mobileTab === "backtest" && (
                      <div className="space-y-4">
                        <BacktestRegion equityCurve={pipeline.equityCurve} trades={pipeline.trades} stats={pipeline.stats} hasData={hasData} backtestStatus={pipeline.backtestStatus} datasetInfo={pipeline.datasetInfo} zeroTradeReason={pipeline.zeroTradeReason} signalCount={pipeline.signalCount} fileName={fileName} />
                        <BreakdownReport byDirection={pipeline.byDirection} bySession={pipeline.bySession} byScore={pipeline.byScore} walkForward={pipeline.walkForward} monteCarlo={pipeline.monteCarlo} stats={pipeline.stats} hasData={hasData} />
                        <TradeJournal trades={journal.trades} addTrade={journal.addTrade} closeTrade={journal.closeTrade} deleteTrade={journal.deleteTrade} currentSignal={sniper} />
                        <PerformanceAnalytics trades={journal.trades} />
                      </div>
                    )}

                    {mobileTab === "montecarlo" && (
                      <div className="space-y-4">
                        <div className="hairline rounded-lg bg-surface p-4">
                          <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-3">Monte Carlo · 1,000 iterations</div>
                          <div className="grid grid-cols-2 gap-2">
                            <MCCell label="Median Drawdown" value={`${(pipeline.monteCarlo.medianDrawdown * 100).toFixed(1)}%`} />
                            <MCCell label="95% Drawdown" value={`${(pipeline.monteCarlo.p95Drawdown * 100).toFixed(1)}%`} alert />
                            <MCCell label="Worst Drawdown" value={`${(pipeline.monteCarlo.worstDrawdown * 100).toFixed(1)}%`} alert />
                            <MCCell label="P(DD ≥ 20%)" value={`${pipeline.monteCarlo.prob20.toFixed(0)}%`} />
                            <MCCell label="P(DD ≥ 30%)" value={`${pipeline.monteCarlo.prob30.toFixed(0)}%`} />
                            <MCCell label="P(DD ≥ 50%)" value={`${pipeline.monteCarlo.prob50.toFixed(0)}%`} alert />
                          </div>
                        </div>
                        <div className="hairline rounded-lg bg-surface p-4">
                          <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2">Walk-Forward (60/20/20)</div>
                          <div className="grid grid-cols-3 gap-px">
                            <div className="bg-surface-elevated p-2.5"><div className="text-[0.625rem] text-aurum-text-secondary font-data">Train</div><div className="text-[0.75rem] font-data font-bold text-aurum-text">{pipeline.walkForward.counts.train} tr</div></div>
                            <div className="bg-surface-elevated p-2.5"><div className="text-[0.625rem] text-aurum-text-secondary font-data">Validation</div><div className="text-[0.75rem] font-data font-bold text-aurum-text">{pipeline.walkForward.counts.validation} tr</div></div>
                            <div className="bg-surface-elevated p-2.5"><div className="text-[0.625rem] text-aurum-text-secondary font-data">OOS</div><div className="text-[0.75rem] font-data font-bold text-aurum-text">{pipeline.walkForward.counts.outOfSample} tr</div></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {hasData && pipeline.validation.issues.length > 0 && (
                    <div className="mt-4 hairline rounded-lg bg-surface p-4">
                      <div className="text-[0.6875rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data mb-2">Data Integrity Notes</div>
                      <ul className="space-y-1">
                        {pipeline.validation.issues.map((iss, i) => (<li key={i} className="text-[0.75rem] font-data text-aurum-text-secondary">· {iss}</li>))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      <BottomDock active={mobileTab} onChange={setMobileTab} />
    </div>
  );
}

function MCCell({ label, value, alert }) {
  return (
    <div className="hairline rounded-md bg-surface-elevated px-3 py-2.5">
      <div className="text-[0.625rem] uppercase tracking-[0.08em] text-aurum-text-secondary font-data">{label}</div>
      <div className={`text-[0.8125rem] font-data font-bold mt-0.5 ${alert ? "text-bear" : "text-aurum-text"}`}>{value}</div>
    </div>
  );
}