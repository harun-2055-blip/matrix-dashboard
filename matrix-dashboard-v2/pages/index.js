import { useState, useEffect, useMemo, useCallback } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Wallet, TrendingUp, TrendingDown, Shield, Zap,
  BarChart3, Target, AlertTriangle, Lock, Unlock, Eye, EyeOff,
  ChevronUp, ChevronDown, Minus, Circle, ArrowUpRight, ArrowDownRight,
  Layers, Clock, DollarSign, Percent, Signal, Radio, Gauge,
} from "lucide-react";
import {
  fetchMarketData, fetchWallet, fetchTrades, fetchOpenTrades,
} from "../lib/supabaseClient";

// Neon palette
const NEON = {
  green: "#00ff88",
  red: "#ff2e5b",
  blue: "#00d4ff",
  yellow: "#ffd93d",
  purple: "#b794ff",
  text: "#e4e4e7",
  textDim: "#71717a",
  textMute: "#3f3f46",
  bg: "#050507",
  card: "rgba(15, 15, 20, 0.6)",
  border: "rgba(255, 255, 255, 0.06)",
  borderActive: "rgba(0, 255, 136, 0.2)",
};

const fmt = (v, d = 2) => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number(v).toLocaleString("en-US", {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });
};

const fmtPrice = (v) => {
  if (!v || v === 0) return "—";
  if (v < 1) return `$${v.toFixed(4)}`;
  if (v < 100) return `$${v.toFixed(2)}`;
  return `$${Math.round(v).toLocaleString()}`;
};

export default function Dashboard() {
  const [page, setPage] = useState("genel");
  const [balHidden, setBalHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedPos, setExpandedPos] = useState(null);
  const [w, setW] = useState(1200);

  const [wallet, setWallet] = useState(null);
  const [coins, setCoins] = useState([]);
  const [openPositions, setOpenPositions] = useState([]);
  const [historyTrades, setHistoryTrades] = useState([]);

  const mob = w < 768;

  useEffect(() => {
    const h = () => setW(window.innerWidth);
    setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [mkt, wal, trades, openT] = await Promise.all([
        fetchMarketData(), fetchWallet(), fetchTrades(50), fetchOpenTrades(),
      ]);
      if (mkt) setCoins(mkt);
      if (wal) setWallet(wal);
      if (openT) setOpenPositions(openT);
      if (trades) {
        setHistoryTrades(trades.filter((t) => t.status !== "OPEN"));
      }
      setLoading(false);
    } catch (e) {
      console.error("Veri hatasi:", e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 15000);
    return () => clearInterval(iv);
  }, [loadData]);

  const bal = wallet?.balance || wallet?.total_balance || 300;
  const initBal = wallet?.initial_balance || 300;
  const dailyPnl = wallet?.daily_pnl || 0;
  const ddPct = wallet?.drawdown_pct || 0;
  const ddLocked = wallet?.drawdown_locked || wallet?.dd_lock_active || false;
  const openCount = openPositions.length;
  const pnlPct = initBal > 0 ? ((bal - initBal) / initBal) * 100 : 0;

  // Sort coins by abs z-score for visual weight
  const coinsByWeight = useMemo(() => {
    return [...coins].sort((a, b) => {
      const za = Math.abs(a.z_score || 0);
      const zb = Math.abs(b.z_score || 0);
      return zb - za;
    });
  }, [coins]);

  const maxAbsZ = useMemo(() => {
    return Math.max(...coins.map((c) => Math.abs(c.z_score || 0)), 2);
  }, [coins]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: NEON.bg }}>
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="inline-block mb-4"
          >
            <Signal size={28} style={{ color: NEON.green }} />
          </motion.div>
          <div style={{ color: NEON.textDim, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
            Veri Yukleniyor
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "genel", label: "Komuta Merkezi", icon: Activity },
    { id: "gecmis", label: "Islem Arsivi", icon: Clock },
    { id: "tarama", label: "Nakit Gocu", icon: Radio },
    { id: "ayarlar", label: "Sistem", icon: Gauge },
  ];

  return (
    <>
      <Head>
        <title>Matrix Trading Engine</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div
        className="min-h-screen"
        style={{
          background: NEON.bg,
          fontFamily: "'Inter', system-ui, sans-serif",
          color: NEON.text,
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 255, 136, 0.08), transparent),
            radial-gradient(ellipse 60% 50% at 80% 50%, rgba(0, 212, 255, 0.04), transparent)
          `,
        }}
      >
        <style jsx global>{`
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
          @keyframes pulse-neon {
            0%, 100% { box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.4); }
            50% { box-shadow: 0 0 0 4px rgba(0, 255, 136, 0); }
          }
          .neon-pulse { animation: pulse-neon 2s infinite; }
          .glass {
            background: rgba(15, 15, 20, 0.6);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.06);
          }
          .mono { font-family: 'JetBrains Mono', monospace; font-feature-settings: 'tnum'; }
        `}</style>

        {/* TOP BAR */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            borderBottom: `1px solid ${NEON.border}`,
            padding: mob ? "12px 16px" : "14px 24px",
            background: "rgba(5, 5, 7, 0.8)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 36, height: 36,
                  background: `linear-gradient(135deg, ${NEON.green}15, ${NEON.blue}10)`,
                  border: `1px solid ${NEON.borderActive}`,
                }}
              >
                <Activity size={16} style={{ color: NEON.green }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.3 }}>
                  MATRIX
                  <span style={{ color: NEON.green, marginLeft: 6, fontWeight: 500 }}>v6.0</span>
                </div>
                {!mob && (
                  <div style={{ fontSize: 9, color: NEON.textDim, letterSpacing: 1.5, textTransform: "uppercase" }}>
                    Quant Komuta Merkezi
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: "rgba(0, 255, 136, 0.06)", border: `1px solid ${NEON.borderActive}` }}>
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: "50%", background: NEON.green }}
                />
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: NEON.green }}>CANLI</span>
              </div>
              <button
                onClick={() => setBalHidden(!balHidden)}
                className="p-2 rounded-md transition-colors"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${NEON.border}`, color: NEON.textDim }}
              >
                {balHidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </motion.div>

        {/* NAVIGATION */}
        <div style={{ borderBottom: `1px solid ${NEON.border}`, padding: mob ? "0 8px" : "0 20px", background: "rgba(5, 5, 7, 0.6)" }}>
          <div className="flex overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className="flex items-center gap-2 px-4 py-3 transition-all whitespace-nowrap relative"
                  style={{
                    color: active ? NEON.text : NEON.textDim,
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <Icon size={13} />
                  {item.label}
                  {active && (
                    <motion.div
                      layoutId="nav-underline"
                      style={{
                        position: "absolute",
                        bottom: 0, left: 0, right: 0, height: 2,
                        background: `linear-gradient(90deg, transparent, ${NEON.green}, transparent)`,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: mob ? 12 : 20 }}>
          <AnimatePresence mode="wait">
            {page === "genel" && (
              <motion.div
                key="genel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {/* HERO BALANCE */}
                <motion.div
                  className="glass rounded-2xl mb-4"
                  style={{ padding: mob ? 20 : 32, position: "relative", overflow: "hidden" }}
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <div style={{
                    position: "absolute", top: 0, right: 0, width: 200, height: 200,
                    background: `radial-gradient(circle, ${dailyPnl >= 0 ? NEON.green : NEON.red}15, transparent 70%)`,
                    pointerEvents: "none",
                  }} />

                  <div className="flex items-center gap-2 mb-3">
                    <Wallet size={12} style={{ color: NEON.textDim }} />
                    <span style={{ fontSize: 10, color: NEON.textDim, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
                      Toplam Kasa
                    </span>
                  </div>

                  <div className="flex items-baseline gap-4 flex-wrap">
                    <div className="mono" style={{ fontSize: mob ? 42 : 64, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
                      {balHidden ? "••••••" : `$${fmt(bal)}`}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md mono" style={{
                      background: dailyPnl >= 0 ? `${NEON.green}12` : `${NEON.red}12`,
                      border: `1px solid ${dailyPnl >= 0 ? NEON.green : NEON.red}30`,
                      color: dailyPnl >= 0 ? NEON.green : NEON.red,
                      fontSize: 13, fontWeight: 700,
                    }}>
                      {dailyPnl >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {dailyPnl >= 0 ? "+" : ""}{fmt(dailyPnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                    </div>
                  </div>

                  {/* Metric strip */}
                  <div className="grid gap-4 mt-6" style={{ gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)" }}>
                    {[
                      { icon: BarChart3, label: "Acik Pozisyon", value: `${openCount}/3`, color: NEON.blue },
                      { icon: Zap, label: "Gunluk DD", value: `${ddPct.toFixed(1)}%`, color: ddPct > 3 ? NEON.red : ddPct > 1 ? NEON.yellow : NEON.green },
                      { icon: ddLocked ? Lock : Unlock, label: "DD Kilidi", value: ddLocked ? "AKTIF" : "ACIK", color: ddLocked ? NEON.red : NEON.green },
                      { icon: Target, label: "Risk/Islem", value: "$100", color: NEON.purple },
                    ].map((m, i) => {
                      const Icon = m.icon;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + i * 0.05 }}
                          style={{ paddingLeft: 12, borderLeft: `2px solid ${m.color}30` }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Icon size={10} style={{ color: m.color }} />
                            <span style={{ fontSize: 9, color: NEON.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>
                              {m.label}
                            </span>
                          </div>
                          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: m.color }}>
                            {m.value}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>

                <div className="grid gap-4" style={{ gridTemplateColumns: mob ? "1fr" : "1fr 400px" }}>
                  {/* NAKIT GOCU CONSENSUS */}
                  <motion.div
                    className="glass rounded-2xl"
                    style={{ padding: mob ? 18 : 24 }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <Radio size={13} style={{ color: NEON.green }} />
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
                          Nakit Gocu Konsensusu
                        </span>
                      </div>
                      <span className="mono" style={{ fontSize: 10, color: NEON.textDim }}>
                        {coins.length} COIN
                      </span>
                    </div>

                    <div className="space-y-2">
                      {coinsByWeight.slice(0, 12).map((c, i) => {
                        const sym = (c.symbol || "").replace("/USDT", "");
                        const z = c.z_score || 0;
                        const score = c.trade_score || 0;
                        const isLong = z < 0;
                        const weight = Math.abs(z) / maxAbsZ;
                        const c15 = c.consensus_15m;
                        const c1h = c.consensus_1h;
                        const consCount = (c15 ? 1 : 0) + (c1h ? 1 : 0);
                        const color = consCount === 2 ? NEON.green : consCount === 1 ? NEON.yellow : NEON.textMute;

                        return (
                          <motion.div
                            key={c.symbol}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.25 + i * 0.02 }}
                            className="flex items-center gap-3 py-2 px-3 rounded-lg"
                            style={{
                              background: consCount > 0 ? `${color}08` : "transparent",
                              border: `1px solid ${consCount > 0 ? color + "20" : "transparent"}`,
                            }}
                          >
                            <div style={{ width: 52, fontWeight: 700, fontSize: 12 }} className="mono">{sym}</div>

                            <div className="flex-1 relative" style={{ height: 6, background: "rgba(255,255,255,0.03)", borderRadius: 3, overflow: "hidden" }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${weight * 100}%` }}
                                transition={{ delay: 0.3 + i * 0.02, duration: 0.6, ease: "easeOut" }}
                                style={{
                                  height: "100%",
                                  background: `linear-gradient(90deg, ${isLong ? NEON.green : NEON.red}, ${isLong ? NEON.green : NEON.red}50)`,
                                  boxShadow: `0 0 8px ${isLong ? NEON.green : NEON.red}40`,
                                }}
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: c15 ? NEON.green : "rgba(255,255,255,0.1)" }} />
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: c1h ? NEON.green : "rgba(255,255,255,0.1)" }} />
                            </div>

                            <div className="mono" style={{ fontSize: 11, color: NEON.textDim, width: 38, textAlign: "right" }}>
                              {z.toFixed(2)}
                            </div>
                            <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: score >= 48 ? NEON.green : score >= 42 ? NEON.blue : NEON.textDim, width: 36, textAlign: "right" }}>
                              {score.toFixed(0)}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* ACTIVE POSITIONS */}
                  <motion.div
                    className="glass rounded-2xl"
                    style={{ padding: mob ? 18 : 22 }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Target size={13} style={{ color: NEON.blue }} />
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
                          Aktif Pozisyonlar
                        </span>
                      </div>
                      <span className="mono px-2 py-0.5 rounded" style={{ fontSize: 10, background: `${NEON.blue}15`, color: NEON.blue, border: `1px solid ${NEON.blue}30` }}>
                        {openCount}/3
                      </span>
                    </div>

                    {openPositions.length === 0 ? (
                      <div className="text-center py-12" style={{ color: NEON.textMute }}>
                        <Minus size={20} style={{ margin: "0 auto 8px" }} />
                        <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Sinyal Bekleniyor</div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {openPositions.map((p, i) => {
                          const isLong = p.direction === "UP" || p.direction === "LONG";
                          const pnl = p.pnl || 0;
                          const col = pnl >= 0 ? NEON.green : NEON.red;
                          const sym = (p.symbol || "").replace("/USDT", "");
                          const expanded = expandedPos === i;

                          return (
                            <motion.div
                              key={i}
                              layout
                              className="rounded-xl overflow-hidden cursor-pointer"
                              style={{
                                background: `${col}06`,
                                border: `1px solid ${col}20`,
                              }}
                              onClick={() => setExpandedPos(expanded ? null : i)}
                              whileHover={{ background: `${col}10` }}
                            >
                              <div className="flex items-center gap-3 p-3">
                                <div style={{ width: 3, height: 36, borderRadius: 2, background: col, boxShadow: `0 0 8px ${col}80` }} />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span style={{ fontSize: 13, fontWeight: 700 }}>{sym}</span>
                                    <span className="mono px-1.5 py-0.5 rounded" style={{
                                      fontSize: 8, fontWeight: 700, letterSpacing: 1,
                                      background: `${col}20`, color: col,
                                    }}>
                                      {isLong ? "LONG" : "SHORT"}
                                    </span>
                                  </div>
                                  <div className="mono" style={{ fontSize: 10, color: NEON.textDim, marginTop: 2 }}>
                                    {fmtPrice(p.entry_price)} → {fmtPrice(p.tp_price)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: col }}>
                                    {pnl >= 0 ? "+" : ""}${fmt(pnl)}
                                  </div>
                                  <div className="mono" style={{ fontSize: 9, color: NEON.textDim }}>
                                    $100 / $500
                                  </div>
                                </div>
                              </div>

                              <AnimatePresence>
                                {expanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    style={{ borderTop: `1px solid ${col}20` }}
                                  >
                                    <div className="p-3 space-y-2">
                                      {[
                                        ["Giris", fmtPrice(p.entry_price)],
                                        ["Stop Loss", fmtPrice(p.sl_price)],
                                        ["Take Profit", fmtPrice(p.tp_price)],
                                        ["Marjin", "$100.00"],
                                        ["Pozisyon", "$500.00"],
                                        ["Kaldirac", "5x"],
                                      ].map(([k, v]) => (
                                        <div key={k} className="flex justify-between">
                                          <span style={{ fontSize: 10, color: NEON.textDim, letterSpacing: 0.5, textTransform: "uppercase" }}>{k}</span>
                                          <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{v}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* DD LOCK WARNING */}
                {ddLocked && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-xl mt-4 flex items-center gap-3 p-4"
                    style={{ borderColor: `${NEON.red}40`, background: `${NEON.red}08` }}
                  >
                    <AlertTriangle size={18} style={{ color: NEON.red }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: NEON.red }}>Drawdown Kilidi Aktif</div>
                      <div style={{ fontSize: 10, color: NEON.textDim }}>Yeni islemler durduruldu. DD: %{ddPct.toFixed(1)}</div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* TRADE HISTORY */}
            {page === "gecmis" && (
              <motion.div
                key="gecmis"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass rounded-2xl"
                style={{ padding: mob ? 18 : 24 }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <Clock size={13} style={{ color: NEON.purple }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
                    Islem Arsivi
                  </span>
                  <span className="mono ml-auto" style={{ fontSize: 10, color: NEON.textDim }}>
                    {historyTrades.length} ISLEM
                  </span>
                </div>

                {historyTrades.length === 0 ? (
                  <div className="text-center py-16" style={{ color: NEON.textMute }}>
                    <Minus size={20} style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Henuz Islem Yok</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyTrades.map((t, i) => {
                      const isLong = t.direction === "UP" || t.direction === "LONG";
                      const pnl = t.pnl || 0;
                      const col = pnl >= 0 ? NEON.green : NEON.red;
                      const sym = (t.symbol || "").replace("/USDT", "");
                      const resColor = (t.status || "").includes("TP") ? NEON.green : NEON.red;

                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="flex items-center gap-3 p-3 rounded-lg"
                          style={{ background: `${col}05`, border: `1px solid ${col}15` }}
                        >
                          <div style={{ width: 3, height: 32, borderRadius: 2, background: col }} />
                          <div style={{ width: 80 }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{sym}</div>
                            <div className="mono" style={{ fontSize: 9, color: col }}>{isLong ? "LONG" : "SHORT"}</div>
                          </div>
                          <div className="mono flex-1" style={{ fontSize: 10, color: NEON.textDim }}>
                            {fmtPrice(t.entry_price)} → {fmtPrice(t.exit_price)}
                          </div>
                          <div className="mono px-2 py-0.5 rounded" style={{ fontSize: 9, background: `${resColor}20`, color: resColor, fontWeight: 700 }}>
                            {t.status}
                          </div>
                          <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: col, width: 80, textAlign: "right" }}>
                            {pnl >= 0 ? "+" : ""}${fmt(pnl)}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* TARAMA */}
            {page === "tarama" && (
              <motion.div
                key="tarama"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass rounded-2xl"
                style={{ padding: mob ? 16 : 24 }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <Radio size={13} style={{ color: NEON.green }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
                    Nakit Gocu Taramasi
                  </span>
                  <span className="mono ml-auto" style={{ fontSize: 10, color: NEON.textDim }}>
                    {coins.length} COIN
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: 680, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${NEON.border}` }}>
                        {["Coin", "Fiyat", "Skor", "Z-Score", "15m", "1h", "Trend", "Durum"].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, color: NEON.textDim, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {coinsByWeight.map((c, i) => {
                        const sym = (c.symbol || "").replace("/USDT", "");
                        const z = c.z_score || 0;
                        const score = c.trade_score || 0;
                        const st = c.signal_status || "BEKLE";
                        const stColor = st === "SINYAL" ? NEON.green : st === "BEKLE" ? NEON.textDim : NEON.red;
                        const trendColor = c.trend_direction === "UP" ? NEON.green : c.trend_direction === "DOWN" ? NEON.red : NEON.textMute;

                        return (
                          <motion.tr
                            key={c.symbol}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.015 }}
                            style={{ borderBottom: `1px solid ${NEON.border}` }}
                          >
                            <td style={{ padding: "10px", fontSize: 12, fontWeight: 700 }} className="mono">{sym}</td>
                            <td className="mono" style={{ padding: "10px", fontSize: 11, color: NEON.text }}>{fmtPrice(c.price)}</td>
                            <td className="mono" style={{ padding: "10px", fontSize: 11, fontWeight: 700, color: score >= 48 ? NEON.green : score >= 42 ? NEON.blue : NEON.textDim }}>
                              {score.toFixed(1)}
                            </td>
                            <td className="mono" style={{ padding: "10px", fontSize: 11, color: z < -1 ? NEON.green : z > 0.3 ? NEON.red : NEON.textDim }}>
                              {z.toFixed(2)}
                            </td>
                            <td style={{ padding: "10px" }}>
                              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.consensus_15m ? NEON.green : "rgba(255,255,255,0.1)" }} />
                            </td>
                            <td style={{ padding: "10px" }}>
                              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.consensus_1h ? NEON.green : "rgba(255,255,255,0.1)" }} />
                            </td>
                            <td style={{ padding: "10px" }}>
                              {c.trend_direction === "UP" ? <ChevronUp size={14} style={{ color: trendColor }} /> : c.trend_direction === "DOWN" ? <ChevronDown size={14} style={{ color: trendColor }} /> : <Minus size={14} style={{ color: trendColor }} />}
                            </td>
                            <td style={{ padding: "10px" }}>
                              <span className="mono px-2 py-0.5 rounded" style={{ fontSize: 9, fontWeight: 700, background: `${stColor}15`, color: stColor, border: `1px solid ${stColor}30` }}>
                                {st}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* AYARLAR */}
            {page === "ayarlar" && (
              <motion.div
                key="ayarlar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid gap-4"
                style={{ gridTemplateColumns: mob ? "1fr" : "1fr 1fr" }}
              >
                {[
                  {
                    title: "Strateji Parametreleri", icon: Target, color: NEON.blue,
                    items: [
                      ["Marjin/Islem", "$100.00"],
                      ["Pozisyon Notional", "$500.00"],
                      ["Kaldirac", "5x"],
                      ["Stop Loss", "ATR x 1.5"],
                      ["Take Profit", "RR 1:1.5"],
                      ["Max Pozisyon", "3 Esanli"],
                    ],
                  },
                  {
                    title: "Risk Yonetimi", icon: Shield, color: NEON.purple,
                    items: [
                      ["Gunluk DD Limiti", "%5"],
                      ["DD Kilidi", ddLocked ? "AKTIF" : "ACIK"],
                      ["Cooldown", "3 saat"],
                      ["Aktif Coin", "20"],
                      ["Tarama Araligi", "90 sn"],
                      ["Mod", "Paper Trade"],
                    ],
                  },
                ].map((card, ci) => {
                  const Icon = card.icon;
                  return (
                    <motion.div
                      key={ci}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: ci * 0.1 }}
                      className="glass rounded-2xl"
                      style={{ padding: 24 }}
                    >
                      <div className="flex items-center gap-2 mb-5">
                        <Icon size={13} style={{ color: card.color }} />
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
                          {card.title}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {card.items.map(([k, v], i) => (
                          <div key={k} className="flex justify-between items-center py-2" style={{ borderBottom: i < card.items.length - 1 ? `1px solid ${NEON.border}` : "none" }}>
                            <span style={{ fontSize: 11, color: NEON.textDim }}>{k}</span>
                            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: card.color }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
