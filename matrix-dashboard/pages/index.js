import { useState, useEffect, useMemo, useCallback } from "react";
import Head from "next/head";
import {
  TrendingUp, Wallet, Zap, Clock, Sun, Moon, Activity,
  ChevronUp, ChevronDown, Settings, Shield, Lock, Terminal,
  MessageSquare, Diamond, Target, Layers, ToggleLeft, ToggleRight,
  Minus, Plus, Snowflake, AlertTriangle, SlidersHorizontal,
  BarChart3, ArrowUpDown, Menu, X, RefreshCw, Eye, EyeOff,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  fetchMarketData, fetchWallet, fetchTrades, fetchOpenTrades,
} from "../lib/supabaseClient";

const G = "#22c55e", R = "#ef4444", B = "#3b82f6", A = "#eab308", P = "#a78bfa";

const fp = (v) => {
  if (!v || v === 0) return "$0";
  return v < 2 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
};

export default function Dashboard() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState("genel");
  const [posTab, setPosTab] = useState("open");
  const [expPos, setExpPos] = useState(null);
  const [expHist, setExpHist] = useState(null);
  const [eqP, setEqP] = useState("ALL");
  const [sortKey, setSortKey] = useState(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [balHide, setBalHide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [w, setW] = useState(1200);
  const [cfg, setCfg] = useState({ trailing: true, kartopu: true, risk: 2.0, leverage: 5, cooldown: 3, maxPos: 3, dd: 5 });

  const [wallet, setWallet] = useState(null);
  const [coins, setCoins] = useState([]);
  const [openPositions, setOpenPositions] = useState([]);
  const [historyTrades, setHistoryTrades] = useState([]);
  const [equityData, setEquityData] = useState([]);

  const mob = w < 768;
  const t = dark
    ? { bg: "#0d0f14", card: "#13161d", nav: "#0d0f14", brd: "#1f2937", tx: "#f1f5f9", tx2: "#6b7280", tx3: "#374151", inp: "#1a1f28" }
    : { bg: "#f4f2ee", card: "#ffffff", nav: "#eae7e1", brd: "#e5e2dc", tx: "#1a1a1a", tx2: "#6b7280", tx3: "#d1d5db", inp: "#f0ede8" };
  const mo = { fontFamily: "'JetBrains Mono', monospace" };

  useEffect(() => {
    const h = () => setW(window.innerWidth);
    setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [mkt, wal, trades, openT] = await Promise.all([
        fetchMarketData(),
        fetchWallet(),
        fetchTrades(50),
        fetchOpenTrades(),
      ]);
      if (mkt) setCoins(mkt);
      if (wal) setWallet(wal);
      if (openT) setOpenPositions(openT);
      if (trades) {
        const closed = trades.filter((t) => t.status !== "OPEN");
        setHistoryTrades(closed);
        let cum = 0;
        const eq = closed.reverse().map((t) => {
          cum += t.pnl || 0;
          const d = t.closed_at || t.opened_at || "";
          return { d: d.slice(5, 10), v: Math.round((wal?.initial_balance || 300) + cum) };
        });
        if (eq.length > 0) setEquityData(eq);
      }
      setLoading(false);
    } catch (e) {
      console.error("Veri yuklenemedi:", e);
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
  const openCount = wallet?.open_count || openPositions.length;
  const pnlPct = initBal > 0 ? ((bal - initBal) / initBal) * 100 : 0;
  const usedMargin = wallet?.used_margin || 0;
  const freeMargin = wallet?.free_margin || bal;

  const sorted = useMemo(() => {
    if (!sortKey) return coins;
    return [...coins].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortAsc ? va - vb : vb - va;
    });
  }, [coins, sortKey, sortAsc]);

  const doSort = (k) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(false); }
  };

  const navItems = [
    ["genel", "Genel Bakis"],
    ["gecmis", "Islem Gecmisi"],
    ["tarama", "Coin Tarama"],
    ["ayarlar", "Ayarlar"],
  ];

  if (loading) {
    return (
      <div style={{ background: t.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter,sans-serif" }}>
        <div style={{ textAlign: "center", color: t.tx2 }}>
          <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
          <div style={{ fontSize: 13 }}>Veriler yukleniyor...</div>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Matrix Trading Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ background: t.bg, minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif", color: t.tx, fontSize: 13 }}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>

        {/* TOP BAR */}
        <div style={{ background: t.nav, borderBottom: `1px solid ${t.brd}`, padding: mob ? "8px 12px" : "10px 20px", display: "flex", alignItems: "center", gap: mob ? 8 : 16, flexWrap: mob ? "wrap" : "nowrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: G + "18", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${G}30`, flexShrink: 0 }}>
              <Activity size={13} style={{ color: G }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>Matrix v6.0</div>
              {!mob && <div style={{ fontSize: 8, color: t.tx2 }}>Powered by Matrix Engine</div>}
            </div>
          </div>

          {!mob && (
            <div style={{ display: "flex", alignItems: "center", gap: 0, flex: 1, overflowX: "auto" }}>
              {[
                [<Wallet size={12} />, "BAKIYE", balHide ? "****" : `$${bal.toFixed(2)}`, null],
                [<TrendingUp size={12} />, "PNL", `${dailyPnl >= 0 ? "+" : ""}$${dailyPnl.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%)`, dailyPnl >= 0 ? G : R],
                [<Zap size={12} />, "DD", `${ddPct.toFixed(1)}%${ddLocked ? " KILITLI" : ""}`, ddPct > 3 ? R : ddPct > 1 ? A : G],
                [<BarChart3 size={12} />, "POZ", `${openCount}/3`, null],
              ].map(([ic, lb, vl, col], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 14px", borderRight: i < 3 ? `1px solid ${t.brd}` : "none", whiteSpace: "nowrap" }}>
                  <span style={{ color: col || t.tx2 }}>{ic}</span>
                  <div>
                    <div style={{ fontSize: 8, color: t.tx2, fontWeight: 600 }}>{lb}</div>
                    <div style={{ ...mo, fontSize: 12, fontWeight: 700, color: col || t.tx }}>{vl}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: G, animation: "pulse 2s infinite" }} />
            <button onClick={() => setBalHide(!balHide)} style={{ background: "none", border: "none", cursor: "pointer", color: t.tx3, padding: 2 }}>
              {balHide ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button onClick={() => setDark(!dark)} style={{ background: t.card, border: `1px solid ${t.brd}`, borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: t.tx2, display: "flex", alignItems: "center" }}>
              {dark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            {mob && (
              <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: t.card, border: `1px solid ${t.brd}`, borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: t.tx2, display: "flex", alignItems: "center" }}>
                {menuOpen ? <X size={13} /> : <Menu size={13} />}
              </button>
            )}
          </div>

          {mob && (
            <div style={{ display: "flex", gap: 0, width: "100%", overflowX: "auto", marginTop: 4 }}>
              {[
                [`$${bal.toFixed(0)}`, null],
                [`PnL ${dailyPnl >= 0 ? "+" : ""}$${dailyPnl.toFixed(2)}`, dailyPnl >= 0 ? G : R],
                [`DD ${ddPct.toFixed(1)}%`, ddPct > 3 ? R : A],
                [`Poz ${openCount}/3`, null],
              ].map(([v, c], i) => (
                <span key={i} style={{ ...mo, fontSize: 10, fontWeight: 600, color: c || t.tx, padding: "2px 8px", borderRight: i < 3 ? `1px solid ${t.brd}` : "none", whiteSpace: "nowrap" }}>{v}</span>
              ))}
            </div>
          )}
        </div>

        {/* NAV */}
        {mob && menuOpen ? (
          <div style={{ background: t.card, borderBottom: `1px solid ${t.brd}`, padding: 8 }}>
            {navItems.map(([k, l]) => (
              <button key={k} onClick={() => { setPage(k); setMenuOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: page === k ? (dark ? "#1f2937" : "#e5e2dc") : "transparent", border: "none", padding: "10px 14px", fontSize: 13, fontWeight: page === k ? 600 : 400, color: page === k ? t.tx : t.tx2, cursor: "pointer", borderRadius: 6, marginBottom: 2, fontFamily: "inherit" }}>{l}</button>
            ))}
          </div>
        ) : (
          <div style={{ background: t.nav, borderBottom: `1px solid ${t.brd}`, padding: "0 12px", display: mob ? "none" : "flex", overflowX: "auto" }}>
            {navItems.map(([k, l]) => (
              <button key={k} onClick={() => setPage(k)} style={{ background: "none", border: "none", padding: "10px 16px", fontSize: 12, fontWeight: page === k ? 600 : 400, color: page === k ? t.tx : t.tx2, cursor: "pointer", borderBottom: page === k ? `2px solid ${B}` : "2px solid transparent", fontFamily: "inherit", whiteSpace: "nowrap" }}>{l}</button>
            ))}
          </div>
        )}

        {/* GENEL BAKIS */}
        {page === "genel" && (
          <div style={{ padding: mob ? 8 : 14, display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 380px", gap: 10 }}>
            <div>
              {/* EQUITY CHART */}
              <div style={{ background: t.card, border: `1px solid ${t.brd}`, borderRadius: 10, padding: mob ? 12 : 16, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: mob ? "center" : "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.tx2, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Portfolio performance</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: mob ? 22 : 28, fontWeight: 800, ...mo, color: t.tx }}>{balHide ? "****" : `$${bal.toFixed(2)}`}</span>
                      <span style={{ fontSize: mob ? 12 : 14, fontWeight: 600, color: pnlPct >= 0 ? G : R, ...mo }}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {["1D", "1W", "1M", "ALL"].map((p) => (
                      <button key={p} onClick={() => setEqP(p)} style={{ background: eqP === p ? (dark ? "#1f2937" : "#e5e2dc") : "transparent", border: `1px solid ${eqP === p ? t.brd : "transparent"}`, borderRadius: 5, padding: mob ? "4px 8px" : "4px 12px", fontSize: 11, fontWeight: eqP === p ? 700 : 400, color: eqP === p ? t.tx : t.tx2, cursor: "pointer", fontFamily: "inherit" }}>{p}</button>
                    ))}
                  </div>
                </div>
                {equityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={mob ? 160 : 220}>
                    <AreaChart data={equityData}>
                      <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.tx2} stopOpacity={0.08} /><stop offset="100%" stopColor={t.tx2} stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="d" tick={{ fill: t.tx2, fontSize: 9 }} axisLine={false} tickLine={false} interval={mob ? 3 : 1} />
                      <YAxis domain={["dataMin-10", "dataMax+5"]} tick={{ fill: t.tx2, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={45} />
                      <Tooltip contentStyle={{ background: t.card, border: `1px solid ${t.brd}`, borderRadius: 8, fontSize: 11 }} formatter={(v) => [`$${v}`, "Bakiye"]} />
                      <Area type="monotone" dataKey="v" stroke={t.tx2} strokeWidth={1.5} fill="url(#eg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: mob ? 160 : 220, display: "flex", alignItems: "center", justifyContent: "center", color: t.tx3, fontSize: 12 }}>Henuz grafik verisi yok</div>
                )}
                <div style={{ display: "flex", gap: 0, marginTop: 6, fontSize: mob ? 9 : 11, color: t.tx2, ...mo, flexWrap: "wrap" }}>
                  {[["USED MARGIN", `$${usedMargin.toFixed(2)}`], ["FREE MARGIN", `$${freeMargin.toFixed(2)}`], ["DD", `${ddPct.toFixed(1)}%`]].map(([l, v], i) => (
                    <span key={i} style={{ padding: mob ? "2px 8px" : "0 14px", borderRight: i < 2 ? `1px solid ${t.brd}` : "none" }}>{l} <span style={{ color: t.tx, fontWeight: 600 }}>{v}</span></span>
                  ))}
                </div>
              </div>

              {/* NAKIT GOCU TOP 6 */}
              <div style={{ background: t.card, border: `1px solid ${t.brd}`, borderRadius: 10, padding: mob ? 12 : 14 }}>
                <div style={{ fontSize: 10, color: t.tx2, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Nakit Gocu — En Iyi Skorlar</div>
                <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(3,1fr)" : "repeat(6,1fr)", gap: 6 }}>
                  {coins.slice(0, 6).map((c) => {
                    const tot = (c.consensus_15m ? 1 : 0) + (c.consensus_1h ? 1 : 0);
                    return (
                      <div key={c.symbol} style={{ background: dark ? "#1a1f28" : "#f7f5f0", borderRadius: 8, padding: "10px 6px", textAlign: "center", border: `1px solid ${t.brd}` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.tx }}>{(c.symbol || "").replace("/USDT", "")}</div>
                        <div style={{ ...mo, fontSize: 16, fontWeight: 800, color: c.trade_score >= 48 ? G : c.trade_score >= 44 ? B : t.tx2, marginTop: 2 }}>{(c.trade_score || 0).toFixed(1)}</div>
                        <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 4 }}>
                          {[c.consensus_15m, c.consensus_1h].map((v, j) => (
                            <div key={j} style={{ width: 8, height: 8, borderRadius: 2, background: v ? G : t.brd }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 8, color: t.tx2, marginTop: 2 }}>{tot}/2</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT: POSITIONS + LOG */}
            <div>
              <div style={{ background: t.card, border: `1px solid ${t.brd}`, borderRadius: 10, padding: mob ? 12 : 14, marginBottom: 10 }}>
                <div style={{ display: "flex", borderBottom: `1px solid ${t.brd}`, marginBottom: 8 }}>
                  {[["open", "Acik Pozisyonlar", openPositions.length], ["hist", "Gecmis", historyTrades.length]].map(([k, l, n]) => (
                    <button key={k} onClick={() => setPosTab(k)} style={{ background: "none", border: "none", padding: "6px 10px", fontSize: mob ? 11 : 12, fontWeight: posTab === k ? 600 : 400, color: posTab === k ? t.tx : t.tx2, cursor: "pointer", borderBottom: posTab === k ? `2px solid ${B}` : "2px solid transparent", fontFamily: "inherit" }}>
                      {l} <span style={{ ...mo, fontSize: 9, color: t.tx2, background: dark ? "#1f2937" : "#e5e2dc", padding: "1px 5px", borderRadius: 4, marginLeft: 3 }}>{n}</span>
                    </button>
                  ))}
                </div>

                {posTab === "open" && (
                  openPositions.length === 0
                    ? <div style={{ padding: 20, textAlign: "center", color: t.tx3, fontSize: 12 }}>Acik pozisyon yok</div>
                    : openPositions.map((p, i) => {
                        const col = (p.pnl || 0) >= 0 ? G : R;
                        const ex = expPos === i;
                        const side = p.direction === "UP" || p.direction === "LONG" ? "Long" : "Short";
                        return (
                          <div key={i} style={{ borderBottom: `1px solid ${t.brd}` }}>
                            <div onClick={() => setExpPos(ex ? null : i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", cursor: "pointer", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 3, height: 24, borderRadius: 2, background: side === "Long" ? G : R, flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontWeight: 700, color: t.tx, fontSize: 13 }}>{(p.symbol || "").replace("/USDT", "")}</div>
                                  <div style={{ color: side === "Long" ? G : R, fontSize: 10, ...mo }}>{side}</div>
                                </div>
                              </div>
                              <div style={{ textAlign: "center", ...mo, fontSize: 10 }}>
                                <div style={{ color: t.tx2, fontSize: 8 }}>ENTRY</div>
                                <div style={{ color: t.tx }}>{fp(p.entry_price)}</div>
                              </div>
                              <div style={{ textAlign: "right", minWidth: 60 }}>
                                <div style={{ ...mo, color: col, fontWeight: 700, fontSize: 12 }}>{(p.pnl || 0) >= 0 ? "+" : ""}${(p.pnl || 0).toFixed(2)}</div>
                              </div>
                            </div>
                            {ex && p.ai_reasoning && (
                              <div style={{ padding: "8px 0 12px", borderTop: `1px solid ${t.brd}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                                  <MessageSquare size={11} style={{ color: B }} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: B, textTransform: "uppercase" }}>AI Reasoning</span>
                                </div>
                                <p style={{ fontSize: 12, color: t.tx2, lineHeight: 1.7, margin: 0 }}>{p.ai_reasoning}</p>
                              </div>
                            )}
                          </div>
                        );
                      })
                )}

                {posTab === "hist" && (
                  historyTrades.length === 0
                    ? <div style={{ padding: 20, textAlign: "center", color: t.tx3, fontSize: 12 }}>Henuz islem yok</div>
                    : historyTrades.slice(0, 15).map((tr, i) => {
                        const col = (tr.pnl || 0) >= 0 ? G : R;
                        const ex = expHist === i;
                        const side = tr.direction === "UP" || tr.direction === "LONG" ? "Long" : "Short";
                        return (
                          <div key={i} style={{ borderBottom: `1px solid ${t.brd}` }}>
                            <div onClick={() => setExpHist(ex ? null : i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", cursor: "pointer", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 3, height: 24, borderRadius: 2, background: side === "Long" ? G : R, flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontWeight: 700, color: t.tx, fontSize: 13 }}>{(tr.symbol || "").replace("/USDT", "")}</div>
                                  <div style={{ color: side === "Long" ? G : R, fontSize: 10, ...mo }}>{side}</div>
                                </div>
                              </div>
                              <div style={{ ...mo, fontSize: 10, color: (tr.status || "").includes("TP") ? G : R, fontWeight: 600 }}>{tr.status}</div>
                              <div style={{ textAlign: "right", minWidth: 60 }}>
                                <div style={{ ...mo, color: col, fontWeight: 700, fontSize: 12 }}>{(tr.pnl || 0) >= 0 ? "+" : ""}${(tr.pnl || 0).toFixed(2)}</div>
                              </div>
                            </div>
                            {ex && tr.ai_reasoning && (
                              <div style={{ padding: "8px 0 12px", borderTop: `1px solid ${t.brd}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                                  <MessageSquare size={11} style={{ color: B }} />
                                  <span style={{ fontSize: 10, fontWeight: 700, color: B, textTransform: "uppercase" }}>AI Reasoning</span>
                                </div>
                                <p style={{ fontSize: 12, color: t.tx2, lineHeight: 1.7, margin: 0 }}>{tr.ai_reasoning}</p>
                              </div>
                            )}
                          </div>
                        );
                      })
                )}
              </div>

              {/* DD UYARI */}
              {ddLocked && (
                <div style={{ background: R + "12", border: `1px solid ${R}30`, borderRadius: 10, padding: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={16} style={{ color: R, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: R }}>Drawdown Kilidi Aktif</div>
                    <div style={{ fontSize: 10, color: t.tx2 }}>Yeni islemler durduruldu. DD: %{ddPct.toFixed(1)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ISLEM GECMISI */}
        {page === "gecmis" && (
          <div style={{ padding: mob ? 8 : 14 }}>
            <div style={{ background: t.card, border: `1px solid ${t.brd}`, borderRadius: 10, padding: mob ? 12 : 14 }}>
              <div style={{ fontSize: 10, color: t.tx2, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Tum Islem Gecmisi</div>
              {historyTrades.length === 0
                ? <div style={{ padding: 30, textAlign: "center", color: t.tx3 }}>Henuz islem yok</div>
                : historyTrades.map((tr, i) => {
                    const col = (tr.pnl || 0) >= 0 ? G : R;
                    const ex = expHist === i;
                    const side = tr.direction === "UP" || tr.direction === "LONG" ? "Long" : "Short";
                    return (
                      <div key={i} style={{ borderBottom: `1px solid ${t.brd}` }}>
                        <div onClick={() => setExpHist(ex ? null : i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", cursor: "pointer", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 80 }}>
                            <div style={{ width: 3, height: 24, borderRadius: 2, background: side === "Long" ? G : R }} />
                            <div>
                              <div style={{ fontWeight: 700, color: t.tx, fontSize: 13 }}>{(tr.symbol || "").replace("/USDT", "")}</div>
                              <div style={{ color: side === "Long" ? G : R, fontSize: 10, ...mo }}>{side}</div>
                            </div>
                          </div>
                          <div style={{ ...mo, fontSize: 10, color: t.tx2 }}>{fp(tr.entry_price)}</div>
                          <div style={{ ...mo, fontSize: 10, color: t.tx2 }}>{fp(tr.exit_price)}</div>
                          <div style={{ ...mo, fontSize: 10, color: (tr.status || "").includes("TP") ? G : R, fontWeight: 600 }}>{tr.status}</div>
                          <div style={{ textAlign: "right", minWidth: 70 }}>
                            <div style={{ ...mo, color: col, fontWeight: 700, fontSize: 13 }}>{(tr.pnl || 0) >= 0 ? "+" : ""}${(tr.pnl || 0).toFixed(2)}</div>
                          </div>
                        </div>
                        {ex && tr.ai_reasoning && (
                          <div style={{ padding: "8px 0 12px", borderTop: `1px solid ${t.brd}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                              <MessageSquare size={11} style={{ color: B }} />
                              <span style={{ fontSize: 10, fontWeight: 700, color: B, textTransform: "uppercase" }}>AI Reasoning</span>
                            </div>
                            <p style={{ fontSize: 12, color: t.tx2, lineHeight: 1.7, margin: 0 }}>{tr.ai_reasoning}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
              }
            </div>
          </div>
        )}

        {/* COIN TARAMA */}
        {page === "tarama" && (
          <div style={{ padding: mob ? 8 : 14 }}>
            <div style={{ background: t.card, border: `1px solid ${t.brd}`, borderRadius: 10, padding: mob ? 12 : 14 }}>
              <div style={{ fontSize: 10, color: t.tx2, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Coin Tarama & Nakit Gocu — {coins.length} coin</div>
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", minWidth: 650, borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${t.brd}` }}>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: t.tx2, fontWeight: 600 }}>Coin</th>
                      {[["Fiyat", "price"], ["Skor", "trade_score"], ["Z", "z_score"], ["15m", "consensus_15m"], ["1h", "consensus_1h"]].map(([l, f]) => (
                        <th key={f} onClick={() => doSort(f)} style={{ padding: "6px 8px", textAlign: "left", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: sortKey === f ? B : t.tx2, fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                          {l} <ArrowUpDown size={8} style={{ verticalAlign: "middle" }} />
                        </th>
                      ))}
                      <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: t.tx2, fontWeight: 600 }}>Trend</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: t.tx2, fontWeight: 600 }}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((c) => {
                      const sym = (c.symbol || "").replace("/USDT", "");
                      const st = c.signal_status || "BEKLE";
                      return (
                        <tr key={c.symbol} style={{ borderBottom: `1px solid ${t.brd}` }}>
                          <td style={{ padding: "7px 8px", fontWeight: 700, color: t.tx, ...mo, fontSize: 12 }}>{sym}</td>
                          <td style={{ ...mo, color: t.tx, padding: "7px 8px", fontSize: 11 }}>{fp(c.price)}</td>
                          <td style={{ ...mo, padding: "7px 8px", fontWeight: 600, color: (c.trade_score || 0) >= 48 ? G : (c.trade_score || 0) >= 42 ? B : t.tx2 }}>{(c.trade_score || 0).toFixed(1)}</td>
                          <td style={{ ...mo, color: (c.z_score || 0) < -1 ? G : (c.z_score || 0) > 0.3 ? R : t.tx2, padding: "7px 8px" }}>{(c.z_score || 0).toFixed(2)}</td>
                          {[c.consensus_15m, c.consensus_1h].map((v, j) => (
                            <td key={j} style={{ padding: "7px 8px" }}><div style={{ width: 10, height: 10, borderRadius: 2, background: v ? G : t.brd }} /></td>
                          ))}
                          <td style={{ padding: "7px 8px" }}>
                            {c.trend_direction === "UP" ? <ChevronUp size={14} style={{ color: G }} /> : c.trend_direction === "DOWN" ? <ChevronDown size={14} style={{ color: R }} /> : <span style={{ color: t.tx3 }}>—</span>}
                          </td>
                          <td style={{ padding: "7px 8px" }}>
                            <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 4, ...mo, color: st === "SINYAL" ? G : st === "BEKLE" ? t.tx2 : R, background: (st === "SINYAL" ? G : st === "BEKLE" ? t.tx2 : R) + "12" }}>{st}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* AYARLAR */}
        {page === "ayarlar" && (
          <div style={{ padding: mob ? 8 : 14, display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 10 }}>
            <div style={{ background: t.card, border: `1px solid ${t.brd}`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <SlidersHorizontal size={13} style={{ color: B }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: t.tx, textTransform: "uppercase", letterSpacing: 0.5 }}>Strateji Ayarlari</span>
              </div>
              {[
                { l: "Trailing Stop / Breakeven", v: cfg.trailing, f: () => setCfg({ ...cfg, trailing: !cfg.trailing }), I: Target },
                { l: "Kartopu (Bilesik Faiz)", v: cfg.kartopu, f: () => setCfg({ ...cfg, kartopu: !cfg.kartopu }), I: Snowflake },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${t.brd}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><s.I size={14} style={{ color: B }} /><span style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>{s.l}</span></div>
                  <button onClick={s.f} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>{s.v ? <ToggleRight size={30} style={{ color: G }} /> : <ToggleLeft size={30} style={{ color: t.tx3 }} />}</button>
                </div>
              ))}
              {[
                { l: "Islem Basi Risk", v: cfg.risk, f: (v) => setCfg({ ...cfg, risk: Math.round(v * 10) / 10 }), min: 0.5, max: 5, step: 0.5, s: "%", I: Shield },
                { l: "Kaldirac", v: cfg.leverage, f: (v) => setCfg({ ...cfg, leverage: v }), min: 1, max: 20, step: 1, s: "x", I: Layers },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${t.brd}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><s.I size={14} style={{ color: B }} /><span style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>{s.l}</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => s.f(Math.max(s.min, s.v - s.step))} style={{ background: t.inp, border: `1px solid ${t.brd}`, borderRadius: 6, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.tx }}><Minus size={13} /></button>
                    <span style={{ ...mo, fontSize: 16, fontWeight: 700, color: t.tx, minWidth: 40, textAlign: "center" }}>{s.v}{s.s}</span>
                    <button onClick={() => s.f(Math.min(s.max, s.v + s.step))} style={{ background: t.inp, border: `1px solid ${t.brd}`, borderRadius: 6, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.tx }}><Plus size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: t.card, border: `1px solid ${t.brd}`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Shield size={13} style={{ color: B }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: t.tx, textTransform: "uppercase", letterSpacing: 0.5 }}>Risk Yonetimi</span>
              </div>
              {[
                { l: "Cooldown Suresi", v: cfg.cooldown, f: (v) => setCfg({ ...cfg, cooldown: v }), min: 1, max: 6, step: 1, s: " saat", I: Clock },
                { l: "Maks. Pozisyon", v: cfg.maxPos, f: (v) => setCfg({ ...cfg, maxPos: v }), min: 1, max: 10, step: 1, s: "", I: BarChart3 },
                { l: "Gunluk DD Limiti", v: cfg.dd, f: (v) => setCfg({ ...cfg, dd: v }), min: 2, max: 15, step: 1, s: "%", I: AlertTriangle },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${t.brd}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><s.I size={14} style={{ color: B }} /><span style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>{s.l}</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => s.f(Math.max(s.min, s.v - s.step))} style={{ background: t.inp, border: `1px solid ${t.brd}`, borderRadius: 6, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.tx }}><Minus size={13} /></button>
                    <span style={{ ...mo, fontSize: 16, fontWeight: 700, color: t.tx, minWidth: 40, textAlign: "center" }}>{s.v}{s.s}</span>
                    <button onClick={() => s.f(Math.min(s.max, s.v + s.step))} style={{ background: t.inp, border: `1px solid ${t.brd}`, borderRadius: 6, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.tx }}><Plus size={13} /></button>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Lock size={14} style={{ color: ddLocked ? R : A }} /><span style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>Drawdown Kilidi</span></div>
                <span style={{ fontSize: 11, fontWeight: 600, color: ddLocked ? R : G, ...mo }}>{ddLocked ? "KILITLI" : "ACIK"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
