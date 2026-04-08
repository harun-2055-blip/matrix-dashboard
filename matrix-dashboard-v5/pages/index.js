import { useState, useEffect, useMemo, useCallback } from "react";
import Head from "next/head";
import { fetchMarketData, fetchWallet, fetchTrades, fetchOpenTrades } from "../lib/supabaseClient";

const NEON = {
  green: "#00ff88", red: "#ff2e5b", blue: "#00d4ff", orange: "#ff9f1c",
  yellow: "#ffd93d", purple: "#b794ff", textDim: "#71717a", textMute: "#3f3f46",
};

const fmtPrice = (v) => !v ? "—" : v < 1 ? "$" + v.toFixed(4) : v < 100 ? "$" + v.toFixed(2) : "$" + Math.round(v).toLocaleString();
const fmt = (v, d = 2) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const getHeat = (absZ) =>
  absZ >= 3 ? { color: NEON.green, label: "VIP", glow: true } :
  absZ >= 2 ? { color: NEON.orange, label: "GUCLU", glow: false } :
  absZ >= 1 ? { color: NEON.blue, label: "ORTA", glow: false } :
  { color: NEON.textMute, label: "ZAYIF", glow: false };

// AI reasoning generator - trade'e göre Türkçe açıklama üretir
function generateOpenReason(t) {
  const sym = (t.symbol || "").replace("/USDT", "");
  const dir = t.direction === "UP" || t.direction === "LONG" ? "long" : "short";
  const bypass = t.bypass_used ? " VIP Bypass tetiklendi (hacim 5x+)," : "";
  return `${sym}'de 15m ve 1h konsensus ${dir === "long" ? "yukari" : "asagi"} yonde.${bypass} Trend ${dir === "long" ? "UP" : "DOWN"} moderate, ATR x 1.5 SL ile acildi. Risk $100, pozisyon $500 (5x kaldirac).`;
}

function generateCloseReason(t) {
  const status = t.status || "";
  const pnl = t.pnl || 0;
  if (status.includes("TP")) {
    return `Take Profit tetiklendi @ ${fmtPrice(t.exit_price)}. Net ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (fee sonrasi). Brut kazanc $150, maliyet ~$0.50. Disiplinli cikis, tereddut yok.`;
  }
  if (status.includes("SL")) {
    return `Stop Loss vuruldu @ ${fmtPrice(t.exit_price)}. Net ${pnl.toFixed(2)}. Beklenen yon tutmadi, kontrollu kayip. Risk yonetimi devrede, duygulara kapilmadan cikis.`;
  }
  if (status.includes("MOMENTUM")) {
    return `Momentum cikisi tetiklendi — 3 mum ust uste hacim dustu, kazanci korumak icin erken kapatildi. Net +$${pnl.toFixed(2)}. Defansif karar, guvenli tahsilat.`;
  }
  return `Pozisyon kapandi. Net ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}.`;
}

function generateAILogs(trades, coins) {
  const logs = [];
  trades.slice(0, 10).forEach((t) => {
    const sym = (t.symbol || "").replace("/USDT", "");
    const pnl = t.pnl || 0;
    const color = pnl >= 0 ? NEON.green : NEON.red;
    const when = t.closed_at || t.opened_at || "";
    const mins = when ? Math.max(1, Math.round((Date.now() - new Date(when).getTime()) / 60000)) : 0;
    const ago = mins < 60 ? `${mins} dk once` : `${Math.round(mins / 60)} sa once`;
    logs.push({
      color,
      ago,
      msg: `${sym} ${t.direction === "UP" || t.direction === "LONG" ? "long" : "short"} ${t.status || "kapandi"} — Net ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}. ${generateCloseReason(t).split(".")[1] || ""}`.trim(),
    });
  });
  if (coins.length > 0) {
    const up = coins.filter((c) => c.trend_direction === "UP").length;
    logs.push({
      color: NEON.textDim,
      ago: "son tarama",
      msg: `Piyasa genel bakis: ${coins.length} coinin ${up}'i yukari trendde. Bot aktif tarama modunda, sinyal bekleniyor.`,
    });
  }
  return logs;
}

export default function Dashboard() {
  const [page, setPage] = useState("genel");
  const [activeTf, setActiveTf] = useState("TUM");
  const [loading, setLoading] = useState(true);
  const [w, setW] = useState(1200);

  const [wallet, setWallet] = useState(null);
  const [coins, setCoins] = useState([]);
  const [openPositions, setOpenPositions] = useState([]);
  const [historyTrades, setHistoryTrades] = useState([]);

  const [state, setState] = useState({
    paperMode: true, trailingStop: true, kartopu: true,
    ddLimit: 5, riskPct: 2, leverage: 5,
  });

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
      if (trades) setHistoryTrades(trades.filter((t) => t.status !== "OPEN"));
      setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 15000);
    return () => clearInterval(iv);
  }, [loadData]);

  const bal = wallet?.balance || wallet?.total_balance || 300;
  const initBal = wallet?.initial_balance || 300;
  const dailyPnl = wallet?.daily_pnl || 0;
  const pnlPct = initBal > 0 ? ((bal - initBal) / initBal) * 100 : 0;
  const ddPct = wallet?.drawdown_pct || 0;
  const ddLocked = wallet?.drawdown_locked || wallet?.dd_lock_active || false;
  const openCount = openPositions.length;
  const winRate = historyTrades.length > 0 ? (historyTrades.filter((t) => (t.pnl || 0) > 0).length / historyTrades.length) * 100 : 0;

  // Equity data from history
  const equityDataSets = useMemo(() => {
    if (!historyTrades.length) {
      return { "1G": [{ t: "09:00", v: initBal }, { t: "now", v: bal }], "1H": [], "1A": [], "TUM": [] };
    }
    let cum = initBal;
    const sorted = [...historyTrades].reverse();
    const tum = sorted.map((t) => {
      cum += t.pnl || 0;
      const d = t.closed_at || t.opened_at || "";
      return { t: d.slice(5, 10), v: Math.round(cum * 100) / 100 };
    });
    return {
      "1G": tum.slice(-8),
      "1H": tum.slice(-14),
      "1A": tum.slice(-30),
      "TUM": tum,
    };
  }, [historyTrades, bal, initBal]);

  const coinsByWeight = useMemo(() => {
    return [...coins].sort((a, b) => Math.abs(b.z_score || 0) - Math.abs(a.z_score || 0));
  }, [coins]);

  const aiLogs = useMemo(() => generateAILogs(historyTrades, coins), [historyTrades, coins]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050507", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: NEON.textDim, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Veri Yukleniyor</div>
      </div>
    );
  }

  const mob = w < 1000;

  // Equity chart SVG renderer
  const renderChart = () => {
    const data = equityDataSets[activeTf] || [];
    if (data.length < 2) return <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: NEON.textMute, fontSize: 11 }}>Yeterli veri yok</div>;

    const W = 700, H = 240, padL = 48, padR = 20, padT = 20, padB = 30;
    const vals = data.map((p) => p.v);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const pad = range * 0.15;
    const yMin = min - pad, yMax = max + pad;
    const xStep = (W - padL - padR) / (data.length - 1);
    const yScale = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);
    const xAt = (i) => padL + i * xStep;
    const points = data.map((p, i) => `${xAt(i)},${yScale(p.v)}`).join(" ");
    const area = `M ${xAt(0)},${H - padB} L ${data.map((p, i) => `${xAt(i)},${yScale(p.v)}`).join(" L ")} L ${xAt(data.length - 1)},${H - padB} Z`;

    const grid = [];
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * (H - padT - padB);
      const v = yMax - (i / 4) * (yMax - yMin);
      grid.push(<line key={`gl-${i}`} x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.03)" />);
      grid.push(<text key={`gt-${i}`} x={padL - 8} y={y + 3} fill="#3f3f46" fontSize="10" textAnchor="end" fontFamily="'JetBrains Mono', monospace">${Math.round(v)}</text>);
    }

    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 240 }}>
        <defs>
          <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid}
        {data.map((p, i) => {
          if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1) return null;
          return <text key={`xl-${i}`} x={xAt(i)} y={H - 10} fill="#3f3f46" fontSize="10" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">{p.t}</text>;
        })}
        <path d={area} fill="url(#eqG)" />
        <polyline points={points} fill="none" stroke="#00ff88" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={xAt(data.length - 1)} cy={yScale(data[data.length - 1].v)} r="4" fill="#00ff88" stroke="#050507" strokeWidth="2" />
      </svg>
    );
  };

  const currentEquity = equityDataSets[activeTf] || [];
  const displayBal = currentEquity.length > 0 ? currentEquity[currentEquity.length - 1].v : bal;
  const displayPct = currentEquity.length > 1 ? ((currentEquity[currentEquity.length - 1].v - currentEquity[0].v) / currentEquity[0].v) * 100 : pnlPct;

  return (
    <>
      <Head>
        <title>Matrix Trading Engine</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        minHeight: "100vh", color: "#e4e4e7", fontFamily: "'Inter', system-ui, sans-serif",
        background: "#050507",
        backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 255, 136, 0.08), transparent), radial-gradient(ellipse 60% 50% at 80% 50%, rgba(0, 212, 255, 0.04), transparent)",
        padding: mob ? 12 : 20,
      }}>

        {/* HERO SHEET */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: 14,
          background: "rgba(15, 15, 20, 0.6)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, marginBottom: 14, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 14, borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{
              width: 38, height: 38, borderRadius: 9,
              background: "linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,212,255,0.1))",
              border: "1px solid rgba(0,255,136,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, color: "#00ff88", fontSize: 13,
            }}>M6</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>Matrix v6.0</div>
              <div style={{ fontSize: 9, color: "#71717a", letterSpacing: 1, textTransform: "uppercase" }}>Quant Engine</div>
            </div>
          </div>

          {[
            { label: "Kasa", value: `$${fmt(bal)}`, color: "#e4e4e7" },
            { label: "Toplam PnL", value: `${dailyPnl >= 0 ? "+" : ""}$${fmt(dailyPnl)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`, color: dailyPnl >= 0 ? NEON.green : NEON.red },
            { label: "Kazanma", value: `${winRate.toFixed(1)}%`, color: "#e4e4e7" },
            { label: "Acik", value: `${openCount}/3`, color: "#e4e4e7" },
          ].map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <div>
                <div style={{ fontSize: 9, color: "#71717a", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>{m.label}</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            </div>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: state.paperMode ? "rgba(255,159,28,0.1)" : "rgba(255,46,91,0.1)", border: `1px solid ${state.paperMode ? "rgba(255,159,28,0.4)" : "rgba(255,46,91,0.4)"}` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: state.paperMode ? NEON.orange : NEON.red }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: state.paperMode ? NEON.orange : NEON.red }}>{state.paperMode ? "PAPER" : "LIVE"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)" }}>
              <div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: NEON.green }} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: NEON.green }}>CANLI</span>
            </div>
          </div>
        </div>

        {/* NAV TABS */}
        <div className="glass" style={{ padding: "0 8px", marginBottom: 14 }}>
          <div style={{ display: "flex", overflowX: "auto" }}>
            {[
              { id: "genel", label: "Komuta Merkezi" },
              { id: "gecmis", label: "Islem Arsivi" },
              { id: "tarama", label: "Nakit Gocu" },
              { id: "ayarlar", label: "Kontrol Paneli" },
            ].map((item) => (
              <button key={item.id} className={`nav-btn ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════ KOMUTA MERKEZI ═══════════ */}
        {page === "genel" && (
          <>
            <div className="grid-main">
              <div className="glass" style={{ padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#71717a", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Portfoy Performansi</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <div className="mono" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>${fmt(displayBal)}</div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: displayPct >= 0 ? NEON.green : NEON.red }}>
                        {displayPct >= 0 ? "+" : ""}{displayPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["1G", "1H", "1A", "TUM"].map((tf) => (
                      <button key={tf} className={`tf-btn ${activeTf === tf ? "active" : ""}`} onClick={() => setActiveTf(tf)}>{tf}</button>
                    ))}
                  </div>
                </div>
                <div style={{ height: 240, marginTop: 14 }}>{renderChart()}</div>
              </div>

              <div className="glass" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Aktif Pozisyonlar</span>
                  <span className="mono" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(0,212,255,0.15)", color: NEON.blue, border: "1px solid rgba(0,212,255,0.3)" }}>{openCount}/3</span>
                </div>
                {openPositions.length === 0 ? (
                  <div style={{ padding: "30px 0", textAlign: "center", color: NEON.textMute, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Sinyal bekleniyor</div>
                ) : (
                  openPositions.map((t, i) => {
                    const col = (t.pnl || 0) >= 0 ? NEON.green : NEON.red;
                    const dir = t.direction === "UP" || t.direction === "LONG" ? "LONG" : "SHORT";
                    const dirCol = dir === "LONG" ? NEON.green : NEON.red;
                    return (
                      <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 3, height: 32, borderRadius: 2, background: col, boxShadow: `0 0 8px ${col}80` }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{(t.symbol || "").replace("/USDT", "")}</span>
                              <span className="mono" style={{ fontSize: 9, fontWeight: 700, background: `${dirCol}26`, color: dirCol, border: `1px solid ${dirCol}4d`, padding: "2px 6px", borderRadius: 3 }}>{dir} 5x</span>
                            </div>
                            <div className="mono" style={{ fontSize: 10, color: NEON.textDim, marginTop: 2 }}>{fmtPrice(t.entry_price)} → {fmtPrice(t.tp_price)}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: col }}>{(t.pnl || 0) >= 0 ? "+" : ""}${fmt(t.pnl || 0)}</div>
                            <div className="mono" style={{ fontSize: 9, color: NEON.textDim }}>$100 marjin</div>
                          </div>
                        </div>
                        <div className="reason-box">
                          <div style={{ fontSize: 9, fontWeight: 700, color: NEON.blue, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>AI Acilis Nedeni</div>
                          <div style={{ fontSize: 10.5, color: "#b8b8c0", lineHeight: 1.6 }}>{t.ai_reasoning || generateOpenReason(t)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* AI REASONING LOG */}
            <div className="glass" style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(183,148,255,0.15))", border: "1px solid rgba(0,212,255,0.3)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Matrix AI Gunluk Anlatimi</div>
                  <div style={{ fontSize: 9, color: "#71717a", letterSpacing: 0.5 }}>Islem kararlarinin Turkce aciklamalari</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: NEON.green }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: NEON.green }}>Canli</span>
                </div>
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {aiLogs.length === 0 ? (
                  <div style={{ padding: 30, textAlign: "center", color: NEON.textMute, fontSize: 11 }}>Henuz log yok</div>
                ) : (
                  aiLogs.map((l, i) => (
                    <div key={i} style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 8, height: 8, background: l.color, marginTop: 6, flexShrink: 0, boxShadow: `0 0 8px ${l.color}80`, transform: "rotate(45deg)" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: "#d4d4d8", lineHeight: 1.65 }}>{l.msg}</div>
                          <div className="mono" style={{ fontSize: 9, color: NEON.textMute, marginTop: 5, letterSpacing: 0.5 }}>{l.ago}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══════════ ISLEM ARSIVI ═══════════ */}
        {page === "gecmis" && (
          <div className="glass" style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Islem Arsivi</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: NEON.textDim }}>{historyTrades.length} ISLEM</span>
            </div>
            {historyTrades.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: NEON.textMute, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Henuz islem yok</div>
            ) : (
              historyTrades.map((t, i) => {
                const col = (t.pnl || 0) >= 0 ? NEON.green : NEON.red;
                const dir = t.direction === "UP" || t.direction === "LONG" ? "LONG" : "SHORT";
                const dirCol = dir === "LONG" ? NEON.green : NEON.red;
                const stCol = (t.status || "").includes("TP") ? NEON.green : (t.status || "").includes("SL") ? NEON.red : NEON.yellow;
                return (
                  <div key={i} style={{ padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{(t.symbol || "").replace("/USDT", "")}</span>
                          <span className="mono" style={{ fontSize: 9, fontWeight: 700, background: `${dirCol}26`, color: dirCol, border: `1px solid ${dirCol}4d`, padding: "3px 7px", borderRadius: 4 }}>{dir} 5x</span>
                          <span className="mono" style={{ fontSize: 8, fontWeight: 700, background: `${stCol}1a`, color: stCol, padding: "2px 6px", borderRadius: 3 }}>{t.status}</span>
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: NEON.textDim, marginTop: 3 }}>
                          {fmtPrice(t.entry_price)} → {fmtPrice(t.exit_price)}
                          <span style={{ color: NEON.orange, marginLeft: 6 }}>fee -${((t.total_cost || t.entry_fee || 0.5)).toFixed(2)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: col }}>{(t.pnl || 0) >= 0 ? "+" : ""}${fmt(t.pnl || 0)}</div>
                      </div>
                    </div>
                    <div className="reason-box">
                      <div style={{ fontSize: 9, fontWeight: 700, color: NEON.blue, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Acilis</div>
                      <div style={{ fontSize: 10.5, color: "#b8b8c0", lineHeight: 1.6, marginBottom: 8 }}>{t.ai_reasoning || generateOpenReason(t)}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: col, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>Kapanis</div>
                      <div style={{ fontSize: 10.5, color: "#b8b8c0", lineHeight: 1.6 }}>{generateCloseReason(t)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══════════ NAKIT GOCU ═══════════ */}
        {page === "tarama" && (
          <div className="glass" style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Nakit Gocu Isi Haritasi</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: NEON.textDim }}>{coins.length} COIN</span>
            </div>
            {coinsByWeight.map((c) => {
              const absZ = Math.abs(c.z_score || 0);
              const heat = getHeat(absZ);
              const isLong = (c.z_score || 0) < 0;
              const maxZ = Math.max(...coins.map((x) => Math.abs(x.z_score || 0)), 3.5);
              const barColor = isLong ? (absZ >= 2 ? NEON.green : heat.color) : (absZ >= 2 ? NEON.red : heat.color);
              const weight = Math.min(absZ / maxZ, 1) * 100;
              const consCount = (c.consensus_15m ? 1 : 0) + (c.consensus_1h ? 1 : 0);
              return (
                <div key={c.symbol} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8,
                  background: consCount > 0 ? `${barColor}0d` : "transparent",
                  border: `1px solid ${consCount > 0 ? barColor + "33" : "transparent"}`,
                  marginBottom: 6,
                }}>
                  <div className="mono" style={{ width: 52, fontWeight: 700, fontSize: 12 }}>{(c.symbol || "").replace("/USDT", "")}</div>
                  <div style={{ flex: 1, position: "relative", height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
                    <div className={heat.glow ? "hbar-glow" : ""} style={{
                      height: "100%", width: `${weight}%`,
                      background: `linear-gradient(90deg, ${barColor}, ${barColor}80)`,
                      boxShadow: heat.glow ? `0 0 12px ${barColor}, 0 0 20px ${barColor}80` : `0 0 6px ${barColor}40`,
                    }} />
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c.consensus_15m ? NEON.green : "rgba(255,255,255,0.1)" }} />
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c.consensus_1h ? NEON.green : "rgba(255,255,255,0.1)" }} />
                  </div>
                  <div className="mono" style={{ width: 50, textAlign: "right" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: barColor }}>{(c.z_score || 0).toFixed(2)}</div>
                    <div style={{ fontSize: 8, color: NEON.textMute }}>{heat.label}</div>
                  </div>
                  <div className="mono" style={{
                    fontSize: 11, fontWeight: 700, width: 32, textAlign: "right",
                    color: (c.trade_score || 0) >= 48 ? NEON.green : (c.trade_score || 0) >= 42 ? NEON.blue : NEON.textDim,
                  }}>
                    {(c.trade_score || 0).toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════ KONTROL PANELI ═══════════ */}
        {page === "ayarlar" && (
          <div className="grid-2">
            <div className="glass" style={{ padding: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Mod & Anahtarlar</div>
              {[
                { key: "paperMode", label: state.paperMode ? "Paper Trade (Aktif)" : "Paper Trade (Kapali - LIVE!)", col: state.paperMode ? NEON.orange : NEON.red },
                { key: "trailingStop", label: "Trailing Stop / Breakeven", col: NEON.green },
                { key: "kartopu", label: "Kartopu (Bilesik Faiz)", col: NEON.blue },
              ].map((t) => {
                const on = state[t.key];
                return (
                  <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 11, color: NEON.textDim, letterSpacing: 0.5 }}>{t.label}</span>
                    <div
                      className="toggle"
                      onClick={() => setState({ ...state, [t.key]: !on })}
                      style={{
                        background: on ? t.col : "rgba(255,255,255,0.08)",
                        borderColor: on ? t.col : "rgba(255,255,255,0.06)",
                        boxShadow: on ? `0 0 12px ${t.col}99` : "none",
                      }}
                    >
                      <div className="toggle-knob" style={{ transform: `translateX(${on ? 20 : 2}px)` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="glass" style={{ padding: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Risk Parametreleri</div>
              {[
                { key: "ddLimit", label: "Gunluk DD Limiti", min: 2, max: 15, step: 1, suffix: "%" },
                { key: "riskPct", label: "Risk Yuzdesi", min: 1, max: 5, step: 0.5, suffix: "%" },
                { key: "leverage", label: "Kaldirac", min: 1, max: 20, step: 1, suffix: "x" },
              ].map((s) => {
                const v = state[s.key];
                const pct = ((v - s.min) / (s.max - s.min)) * 100;
                return (
                  <div key={s.key} style={{ padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 11, color: NEON.textDim }}>{s.label}</span>
                      <span className="mono" style={{
                        fontSize: 11, fontWeight: 700, color: NEON.orange,
                        background: "rgba(255,159,28,0.12)",
                        border: "1px solid rgba(255,159,28,0.3)",
                        padding: "2px 10px", borderRadius: 4,
                      }}>{v}{s.suffix}</span>
                    </div>
                    <div style={{ position: "relative", height: 6 }}>
                      <div className="slider-fill" style={{ width: `${pct}%` }} />
                      <input
                        type="range" min={s.min} max={s.max} step={s.step} value={v}
                        onChange={(e) => setState({ ...state, [s.key]: Number(e.target.value) })}
                        style={{ position: "absolute", inset: 0, width: "100%", cursor: "pointer" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
