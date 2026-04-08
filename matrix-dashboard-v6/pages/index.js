import { useState, useEffect, useMemo, useCallback } from "react";
import Head from "next/head";
import { fetchMarketData, fetchWallet, fetchTrades, fetchOpenTrades } from "../lib/supabaseClient";
import { THEMES } from "../lib/theme";

// ═══════════════════ HELPERS ═══════════════════
const fmt = (v, d = 2) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPrice = (v) => {
  if (!v || v === 0) return "—";
  const n = Number(v);
  if (n < 1) return "$" + n.toFixed(4);
  if (n < 100) return "$" + n.toFixed(2);
  return "$" + Math.round(n).toLocaleString();
};
const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};
const timeAgo = (iso) => {
  if (!iso) return "—";
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} dk once`;
  if (mins < 1440) return `${Math.round(mins / 60)} sa once`;
  return `${Math.round(mins / 1440)} gun once`;
};

const getHeat = (absZ, T) =>
  absZ >= 3 ? { color: T.green, label: "VIP", glow: true } :
  absZ >= 2 ? { color: T.orange, label: "GUCLU", glow: false } :
  absZ >= 1 ? { color: T.blue, label: "ORTA", glow: false } :
  { color: T.textMute, label: "ZAYIF", glow: false };

const genOpenReason = (t) => {
  const sym = (t.symbol || "").replace("/USDT", "");
  const dir = t.direction === "UP" || t.direction === "LONG" ? "yukari" : "asagi";
  const bypass = t.bypass_used ? " VIP Bypass tetiklendi (hacim 5x+)," : "";
  return `${sym}'de 15m ve 1h konsensus ${dir} yonde.${bypass} ATR x 1.5 SL ile acildi. Risk $100, pozisyon $500 (5x).`;
};

const genCloseReason = (t) => {
  const status = t.status || "";
  const pnl = t.pnl || 0;
  if (status.includes("TP")) return `TP tetiklendi @ ${fmtPrice(t.exit_price)}. Net ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}.`;
  if (status.includes("SL")) return `SL vuruldu @ ${fmtPrice(t.exit_price)}. Net ${pnl.toFixed(2)}. Kontrollu kayip.`;
  if (status.includes("MOMENTUM")) return `Momentum cikisi — erken kapatildi. Net ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}.`;
  return `Pozisyon kapandi. Net ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}.`;
};

// ═══════════════════ COMPONENTS ═══════════════════
const Glass = ({ T, children, style = {}, ...props }) => (
  <div style={{ background: T.glassBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${T.border}`, borderRadius: 14, transition: "all 0.3s", ...style }} {...props}>
    {children}
  </div>
);

const NavBtn = ({ T, active, label, onClick }) => (
  <button onClick={onClick} style={{
    background: "none", border: "none", padding: "14px 18px", fontSize: 12, cursor: "pointer",
    fontFamily: "inherit", color: active ? T.text : T.textDim, fontWeight: active ? 600 : 400,
    position: "relative", whiteSpace: "nowrap",
  }}>
    {label}
    {active && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.green}, transparent)` }} />}
  </button>
);

const TfBtn = ({ T, active, label, onClick }) => (
  <button onClick={onClick} style={{
    background: active ? `${T.green}1a` : "transparent",
    border: `1px solid ${active ? `${T.green}4d` : T.border}`,
    color: active ? T.green : T.textDim,
    fontSize: 10, fontWeight: 600, padding: "6px 12px", borderRadius: 6,
    cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.5, transition: "all 0.2s",
  }}>{label}</button>
);

// ═══════════════════ EQUITY CHART WITH MARKERS ═══════════════════
function EquityChart({ data, trades, T, tf }) {
  if (!data || data.length < 2) {
    return <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMute, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Yeterli veri yok</div>;
  }

  const W = 900, H = 260, padL = 60, padR = 30, padT = 30, padB = 40;
  const vals = data.map(p => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pad = range * 0.15;
  const yMin = min - pad, yMax = max + pad;
  const xStep = (W - padL - padR) / (data.length - 1);
  const yScale = v => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);
  const xAt = i => padL + i * xStep;

  const points = data.map((p, i) => `${xAt(i)},${yScale(p.v)}`).join(" ");
  const areaPath = `M ${xAt(0)},${H - padB} L ${data.map((p, i) => `${xAt(i)},${yScale(p.v)}`).join(" L ")} L ${xAt(data.length - 1)},${H - padB} Z`;

  const grid = [];
  for (let i = 0; i <= 5; i++) {
    const y = padT + (i / 5) * (H - padT - padB);
    const v = yMax - (i / 5) * (yMax - yMin);
    grid.push(<line key={`l${i}`} x1={padL} y1={y} x2={W - padR} y2={y} stroke={T.border} />);
    grid.push(<text key={`t${i}`} x={padL - 10} y={y + 3} fill={T.textMute} fontSize="10" textAnchor="end" fontFamily="'JetBrains Mono', monospace">${v.toFixed(0)}</text>);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 260 }}>
      <defs>
        <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.green} stopOpacity="0.3" />
          <stop offset="100%" stopColor={T.green} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid}
      {data.map((p, i) => {
        if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1) return null;
        return <text key={`x${i}`} x={xAt(i)} y={H - 15} fill={T.textMute} fontSize="10" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">{p.t}</text>;
      })}
      <path d={areaPath} fill="url(#eqG)" />
      <polyline points={points} fill="none" stroke={T.green} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((p, i) => {
        if (!p.trade) return null;
        const x = xAt(i), y = yScale(p.v);
        const status = p.trade.status || "";
        const isTP = status.includes("TP");
        const isSL = status.includes("SL");
        const col = isTP ? T.green : isSL ? T.red : T.yellow;
        if (isTP) {
          const my = y - 18;
          return <g key={`m${i}`}>
            <line x1={x} y1={y} x2={x} y2={my + 8} stroke={col} strokeWidth="1" strokeDasharray="2,2" opacity="0.4" />
            <polygon points={`${x-6},${my+8} ${x+6},${my+8} ${x},${my-2}`} fill={col} stroke={T.bg} strokeWidth="1.5" />
          </g>;
        } else if (isSL) {
          const my = y + 18;
          return <g key={`m${i}`}>
            <line x1={x} y1={y} x2={x} y2={my - 8} stroke={col} strokeWidth="1" strokeDasharray="2,2" opacity="0.4" />
            <polygon points={`${x-6},${my-8} ${x+6},${my-8} ${x},${my+2}`} fill={col} stroke={T.bg} strokeWidth="1.5" />
          </g>;
        } else {
          return <circle key={`m${i}`} cx={x} cy={y - 14} r="4" fill={col} stroke={T.bg} strokeWidth="1.5" />;
        }
      })}

      <circle cx={xAt(data.length - 1)} cy={yScale(data[data.length - 1].v)} r="5" fill={T.green} stroke={T.bg} strokeWidth="2" />
    </svg>
  );
}

// ═══════════════════ HEAT BAR ═══════════════════
function HeatBar({ coin, maxZ, T }) {
  const absZ = Math.abs(coin.z_score || 0);
  const heat = getHeat(absZ, T);
  const isLong = (coin.z_score || 0) < 0;
  const barColor = isLong ? (absZ >= 2 ? T.green : heat.color) : (absZ >= 2 ? T.red : heat.color);
  const weight = Math.min(absZ / maxZ, 1) * 100;
  const consCount = (coin.consensus_15m ? 1 : 0) + (coin.consensus_1h ? 1 : 0);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8,
      background: consCount > 0 ? `${barColor}10` : "transparent",
      border: `1px solid ${consCount > 0 ? barColor + "33" : "transparent"}`,
      marginBottom: 6,
    }}>
      <div className="mono" style={{ width: 52, fontWeight: 700, fontSize: 12, color: T.text }}>{(coin.symbol || "").replace("/USDT", "")}</div>
      <div style={{ flex: 1, position: "relative", height: 8, background: T.border, borderRadius: 4, overflow: "hidden" }}>
        <div className={heat.glow ? "hbar-glow" : ""} style={{
          height: "100%", width: `${weight}%`,
          background: `linear-gradient(90deg, ${barColor}, ${barColor}80)`,
          boxShadow: heat.glow ? `0 0 12px ${barColor}, 0 0 20px ${barColor}80` : `0 0 6px ${barColor}40`,
        }} />
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: coin.consensus_15m ? T.green : T.border }} />
        <div style={{ width: 8, height: 8, borderRadius: 2, background: coin.consensus_1h ? T.green : T.border }} />
      </div>
      <div className="mono" style={{ width: 50, textAlign: "right" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: barColor }}>{(coin.z_score || 0).toFixed(2)}</div>
        <div style={{ fontSize: 8, color: T.textMute }}>{heat.label}</div>
      </div>
      <div className="mono" style={{
        fontSize: 11, fontWeight: 700, width: 32, textAlign: "right",
        color: (coin.trade_score || 0) >= 48 ? T.green : (coin.trade_score || 0) >= 42 ? T.blue : T.textDim,
      }}>
        {(coin.trade_score || 0).toFixed(0)}
      </div>
    </div>
  );
}

// ═══════════════════ MAIN PAGE ═══════════════════
export default function Dashboard() {
  const [theme, setTheme] = useState("dark");
  const [page, setPage] = useState("genel");
  const [tf, setTf] = useState("TUM");
  const [loading, setLoading] = useState(true);
  const [modalTrade, setModalTrade] = useState(null);
  const [mob, setMob] = useState(false);

  const [wallet, setWallet] = useState(null);
  const [coins, setCoins] = useState([]);
  const [openTrades, setOpenTrades] = useState([]);
  const [histTrades, setHistTrades] = useState([]);

  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const [state, setState] = useState({
    paperMode: true, trailingStop: true, kartopu: true,
    ddLimit: 5, riskPct: 2, leverage: 5,
  });

  const T = THEMES[theme];

  useEffect(() => {
    const h = () => setMob(window.innerWidth < 1000);
    h();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // LOAD THEME FROM LOCAL STORAGE
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("matrix-theme") : null;
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("matrix-theme", theme);
  }, [theme]);

  // FETCH DATA
  const loadData = useCallback(async () => {
    try {
      const [mkt, wal, trades, openT] = await Promise.all([
        fetchMarketData(), fetchWallet(), fetchTrades(200), fetchOpenTrades(),
      ]);
      if (mkt) setCoins(mkt);
      if (wal) setWallet(wal);
      if (openT) setOpenTrades(openT);
      if (trades) setHistTrades(trades.filter(t => t.status !== "OPEN"));
      setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 15000);
    return () => clearInterval(iv);
  }, [loadData]);

  // DERIVED
  const bal = wallet?.balance || wallet?.total_balance || 300;
  const initBal = wallet?.initial_balance || 300;
  const dailyPnl = wallet?.daily_pnl || 0;
  const pnlPct = initBal > 0 ? ((bal - initBal) / initBal) * 100 : 0;
  const ddPct = wallet?.drawdown_pct || 0;
  const ddLocked = wallet?.drawdown_locked || wallet?.dd_lock_active || false;
  const openCount = openTrades.length;
  const winRate = histTrades.length > 0 ? (histTrades.filter(t => (t.pnl || 0) > 0).length / histTrades.length) * 100 : 0;

  // EQUITY CURVE DATA
  const equityDataSets = useMemo(() => {
    if (!histTrades.length) return { "1G": [], "1H": [], "1A": [], "TUM": [{ t: "start", v: initBal }, { t: "now", v: bal }] };
    let cum = initBal;
    const sorted = [...histTrades].reverse();
    const tum = sorted.map(t => {
      cum += t.pnl || 0;
      const d = t.closed_at || t.opened_at || "";
      return { t: d.slice(5, 10), v: Math.round(cum * 100) / 100, trade: t };
    });
    return { "1G": tum.slice(-8), "1H": tum.slice(-14), "1A": tum.slice(-30), "TUM": tum };
  }, [histTrades, bal, initBal]);

  const currentEquity = equityDataSets[tf] || [];
  const displayBal = currentEquity.length > 0 ? currentEquity[currentEquity.length - 1].v : bal;
  const displayPct = currentEquity.length > 1 ? ((currentEquity[currentEquity.length - 1].v - currentEquity[0].v) / currentEquity[0].v) * 100 : pnlPct;

  // COINS SORTED
  const coinsByWeight = useMemo(() => [...coins].sort((a, b) => Math.abs(b.z_score || 0) - Math.abs(a.z_score || 0)), [coins]);
  const maxZ = Math.max(...coins.map(c => Math.abs(c.z_score || 0)), 3.5);

  // COIN PERFORMANCE
  const coinPerf = useMemo(() => {
    const grouped = {};
    histTrades.forEach(t => {
      const sym = (t.symbol || "").replace("/USDT", "");
      if (!sym) return;
      if (!grouped[sym]) grouped[sym] = { sym, trades: 0, wins: 0, losses: 0, totalPnl: 0 };
      grouped[sym].trades++;
      if ((t.pnl || 0) > 0) grouped[sym].wins++;
      else grouped[sym].losses++;
      grouped[sym].totalPnl += t.pnl || 0;
    });
    return Object.values(grouped).map(g => ({ ...g, avgPnl: g.trades > 0 ? g.totalPnl / g.trades : 0 })).sort((a, b) => b.totalPnl - a.totalPnl);
  }, [histTrades]);

  // AI LOGS
  const aiLogs = useMemo(() => {
    const logs = [];
    histTrades.slice(0, 15).forEach(t => {
      const sym = (t.symbol || "").replace("/USDT", "");
      const pnl = t.pnl || 0;
      const color = pnl >= 0 ? T.green : T.red;
      logs.push({ color, ago: timeAgo(t.closed_at || t.opened_at), msg: `${sym} ${t.direction === "UP" || t.direction === "LONG" ? "long" : "short"} ${t.status || "kapandi"} — Net ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}. ${genCloseReason(t).split(".")[1] || ""}`.trim() });
    });
    if (coins.length > 0) {
      const up = coins.filter(c => c.trend_direction === "UP").length;
      logs.push({ color: T.textDim, ago: "son tarama", msg: `Piyasa genel bakis: ${coins.length} coinin ${up}'i yukari trendde. Bot aktif tarama modunda.` });
    }
    return logs;
  }, [histTrades, coins, T]);

  // ALERTS (derived from state)
  const alerts = useMemo(() => {
    const al = [];
    if (ddPct >= 3) al.push({ sev: "danger", title: "Drawdown uyari esigi gecildi", msg: `Gunluk DD %${ddPct.toFixed(1)}, limit %5. Dikkatli ol.`, time: "Suanki", unread: true });
    if (ddLocked) al.push({ sev: "danger", title: "Drawdown kilidi aktif", msg: "Bot yeni islem almiyor. 00:00 UTC'de reset olacak.", time: "Suanki", unread: true });
    coinPerf.filter(c => c.trades >= 3 && c.wins / c.trades < 0.3).forEach(c => {
      al.push({ sev: "danger", title: `${c.sym} kotu performans`, msg: `${c.trades} islemde sadece ${c.wins} kazandi (WR %${((c.wins/c.trades)*100).toFixed(0)}). Ban listesine al.`, time: timeAgo(histTrades[0]?.closed_at), unread: true });
    });
    const vipCoins = coins.filter(c => Math.abs(c.z_score || 0) >= 3);
    vipCoins.forEach(c => {
      al.push({ sev: "success", title: `VIP Bypass: ${(c.symbol || "").replace("/USDT", "")}`, msg: `Z-Score ${(c.z_score || 0).toFixed(2)}, balina hareketi tespit.`, time: "son tarama", unread: true });
    });
    if (openCount === 3) al.push({ sev: "warning", title: "Tum slotlar dolu", msg: "Yeni sinyaller atlanacak — 3/3 pozisyon acik.", time: "Suanki", unread: false });
    histTrades.slice(0, 3).forEach(t => {
      const pnl = t.pnl || 0;
      if (pnl > 50) al.push({ sev: "success", title: `${(t.symbol || "").replace("/USDT", "")} kazanc`, msg: `${t.status} — Net +$${pnl.toFixed(2)}.`, time: timeAgo(t.closed_at), unread: false });
    });
    return al.slice(0, 12);
  }, [ddPct, ddLocked, coinPerf, coins, openCount, histTrades]);

  // CALENDAR DATA
  const calendarData = useMemo(() => {
    const map = {};
    histTrades.forEach(t => {
      const d = t.closed_at || t.opened_at;
      if (!d) return;
      const key = d.slice(0, 10);
      if (!map[key]) map[key] = { pnl: 0, trades: 0, wins: 0, losses: 0 };
      map[key].pnl += t.pnl || 0;
      map[key].trades++;
      if ((t.pnl || 0) > 0) map[key].wins++;
      else map[key].losses++;
    });
    return map;
  }, [histTrades]);

  // FUNNEL DATA (derived)
  const funnelStats = useMemo(() => {
    const totalCoins = coins.length || 20;
    const scans = totalCoins * 960; // 90sn de bir, gunde ~960 kez
    const consensus = coins.filter(c => c.consensus_15m || c.consensus_1h).length * 7; // 7 gun varsayim
    const signals = Math.round(consensus * 0.92);
    const executed = histTrades.length;
    const wins = histTrades.filter(t => (t.pnl || 0) > 0).length;
    return [
      { label: "Tarama", value: scans, color: T.textDim, icon: "scan" },
      { label: "Konsensus", value: consensus, color: T.blue, icon: "check" },
      { label: "Sinyal", value: signals, color: T.purple, icon: "bolt" },
      { label: "Islem", value: executed, color: T.orange, icon: "play" },
      { label: "Kazanc TP", value: wins, color: T.green, icon: "trophy" },
    ];
  }, [coins, histTrades, T]);

  // CSV EXPORT
  const exportCSV = () => {
    const headers = ["Tarih", "Sembol", "Yon", "Giris", "Cikis", "Fee", "Net PnL", "Sonuc"];
    const rows = histTrades.map(t => [
      fmtDate(t.closed_at || t.opened_at),
      (t.symbol || "").replace("/USDT", ""),
      t.direction === "UP" || t.direction === "LONG" ? "LONG" : "SHORT",
      t.entry_price || 0,
      t.exit_price || 0,
      t.total_cost || t.entry_fee || 0.5,
      t.pnl || 0,
      t.status || "",
    ]);
    const csv = "\uFEFF" + headers.join(",") + "\n" + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const today = new Date().toISOString().split("T")[0];
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matrix_trades_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: T.textDim, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Veri Yukleniyor</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Matrix</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        minHeight: "100vh", color: T.text, fontFamily: "'Inter', system-ui, sans-serif",
        background: T.bg, backgroundImage: T.bgImage, padding: mob ? 12 : 20,
      }}>

        {/* HERO */}
        <Glass T={T} style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 14, borderRight: `1px solid ${T.border}` }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: `linear-gradient(135deg, ${T.green}26, ${T.blue}1a)`, border: `1px solid ${T.green}4d`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: T.green, fontSize: 13 }}>M</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Matrix</div>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, textTransform: "uppercase" }}>Quant Engine</div>
            </div>
          </div>

          {!mob && [
            { label: "Kasa", value: `$${fmt(bal)}`, color: T.text },
            { label: "Toplam PnL", value: `${dailyPnl >= 0 ? "+" : ""}$${fmt(dailyPnl)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`, color: dailyPnl >= 0 ? T.green : T.red },
            { label: "Kazanma", value: `${winRate.toFixed(1)}%`, color: T.text },
            { label: "Acik", value: `${openCount}/3`, color: T.text },
          ].map((m, i) => (
            <div key={i} style={{ padding: "0 14px", borderRight: i < 3 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>{m.label}</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: state.paperMode ? `${T.orange}1a` : `${T.red}1a`, border: `1px solid ${state.paperMode ? T.orange : T.red}66` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: state.paperMode ? T.orange : T.red }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: state.paperMode ? T.orange : T.red }}>{state.paperMode ? "PAPER" : "LIVE"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: `${T.green}0f`, border: `1px solid ${T.green}33` }}>
              <div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: T.green }}>CANLI</span>
            </div>
            <div
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              style={{ position: "relative", width: 56, height: 28, borderRadius: 14, cursor: "pointer", background: T.border, border: `1px solid ${T.borderMed}`, transition: "all 0.3s" }}>
              <div style={{ position: "absolute", top: 2, width: 22, height: 22, borderRadius: "50%", background: theme === "dark" ? "#fbbf24" : "#1e293b", transform: `translateX(${theme === "dark" ? 2 : 30}px)`, transition: "transform 0.3s", display: "flex", alignItems: "center", justifyContent: "center", color: theme === "dark" ? "#78350f" : "#e2e8f0" }}>
                {theme === "dark" ?
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> :
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                }
              </div>
            </div>
          </div>
        </Glass>

        {/* NAV */}
        <Glass T={T} style={{ padding: "0 8px", marginBottom: 14 }}>
          <div style={{ display: "flex", overflowX: "auto" }}>
            {[
              { id: "genel", label: "Komuta Merkezi" },
              { id: "gecmis", label: "Islem Arsivi" },
              { id: "tarama", label: "Nakit Gocu" },
              { id: "takvim", label: "Takvim" },
              { id: "piyasa", label: "Piyasa" },
              { id: "ayarlar", label: "Kontrol Paneli" },
            ].map(item => (
              <NavBtn key={item.id} T={T} active={page === item.id} label={item.label} onClick={() => setPage(item.id)} />
            ))}
          </div>
        </Glass>

        {/* ═══════════ KOMUTA MERKEZI ═══════════ */}
        {page === "genel" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 420px", gap: 14 }}>
              <Glass T={T} style={{ padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Portfoy Performansi</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <div className="mono" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>${fmt(displayBal)}</div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: displayPct >= 0 ? T.green : T.red }}>
                        {displayPct >= 0 ? "+" : ""}{displayPct.toFixed(2)}%
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 10, color: T.textDim }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `7px solid ${T.green}` }} />TP
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `7px solid ${T.red}` }} />SL
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["1G", "1H", "1A", "TUM"].map(x => <TfBtn key={x} T={T} active={tf === x} label={x} onClick={() => setTf(x)} />)}
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <EquityChart data={currentEquity} trades={histTrades} T={T} tf={tf} />
                </div>
              </Glass>

              <Glass T={T} style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Aktif Pozisyonlar</span>
                  <span className="mono" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${T.blue}1a`, color: T.blue, border: `1px solid ${T.blue}33` }}>{openCount}/3</span>
                </div>
                {openTrades.length === 0 ? (
                  <div style={{ padding: "30px 0", textAlign: "center", color: T.textMute, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Sinyal bekleniyor</div>
                ) : openTrades.map((t, i) => {
                  const col = (t.pnl || 0) >= 0 ? T.green : T.red;
                  const dir = t.direction === "UP" || t.direction === "LONG" ? "LONG" : "SHORT";
                  const dirCol = dir === "LONG" ? T.green : T.red;
                  return (
                    <div key={i} onClick={() => setModalTrade(t)} style={{ padding: 12, marginBottom: 10, borderRadius: 10, background: `${col}0a`, border: `1px solid ${col}2e`, cursor: "pointer", transition: "all 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 3, height: 32, borderRadius: 2, background: col, boxShadow: `0 0 8px ${col}80` }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{(t.symbol || "").replace("/USDT", "")}</span>
                            <span className="mono" style={{ fontSize: 9, fontWeight: 700, background: `${dirCol}33`, color: dirCol, border: `1px solid ${dirCol}66`, padding: "2px 6px", borderRadius: 3 }}>{dir} 5x</span>
                          </div>
                          <div className="mono" style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{fmtPrice(t.entry_price)} → {fmtPrice(t.tp_price)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: col }}>{(t.pnl || 0) >= 0 ? "+" : ""}${fmt(t.pnl || 0)}</div>
                          <div className="mono" style={{ fontSize: 9, color: T.textDim }}>$100 marjin</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Glass>
            </div>

            {/* Alerts + AI Log */}
            <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 14, marginTop: 14 }}>
              <Glass T={T} style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.orange} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Uyarilar</span>
                  <span className="mono" style={{ fontSize: 9, color: T.textDim, marginLeft: "auto" }}>{alerts.filter(a => a.unread).length} OKUNMAMIS</span>
                </div>
                <div style={{ maxHeight: 340, overflowY: "auto", padding: 10 }}>
                  {alerts.length === 0 ? (
                    <div style={{ padding: 30, textAlign: "center", color: T.textMute, fontSize: 11 }}>Uyari yok</div>
                  ) : alerts.map((a, i) => {
                    const col = a.sev === "danger" ? T.red : a.sev === "warning" ? T.orange : a.sev === "success" ? T.green : T.blue;
                    return (
                      <div key={i} style={{ padding: "10px 12px", marginBottom: 6, borderRadius: 8, background: `${col}0a`, border: `1px solid ${col}2e`, position: "relative", borderLeft: `3px solid ${col}` }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{a.title}</div>
                          <div className="mono" style={{ fontSize: 9, color: T.textDim, marginLeft: "auto" }}>{a.time}</div>
                        </div>
                        <div style={{ fontSize: 10, color: T.textDim, marginTop: 3, lineHeight: 1.5 }}>{a.msg}</div>
                      </div>
                    );
                  })}
                </div>
              </Glass>

              <Glass T={T} style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>AI Anlatim</span>
                  <div className="live-dot" style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: T.green }} />
                </div>
                <div style={{ maxHeight: 340, overflowY: "auto" }}>
                  {aiLogs.length === 0 ? (
                    <div style={{ padding: 30, textAlign: "center", color: T.textMute, fontSize: 11 }}>Henuz log yok</div>
                  ) : aiLogs.map((l, i) => (
                    <div key={i} style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 8, height: 8, background: l.color, marginTop: 5, flexShrink: 0, boxShadow: `0 0 8px ${l.color}80`, transform: "rotate(45deg)" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: T.text, lineHeight: 1.6 }}>{l.msg}</div>
                          <div className="mono" style={{ fontSize: 9, color: T.textMute, marginTop: 4 }}>{l.ago}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Glass>
            </div>

            {/* Funnel */}
            <Glass T={T} style={{ padding: 22, marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Sinyal Funnel (7 Gun)</span>
              </div>
              {funnelStats.map((s, i) => {
                const max = funnelStats[0].value || 1;
                const w = (s.value / max) * 100;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
                    <div style={{ width: 120, fontSize: 11, fontWeight: 700, color: s.color, letterSpacing: 0.5, textTransform: "uppercase" }}>{s.label}</div>
                    <div style={{ flex: 1, position: "relative", height: 36 }}>
                      <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: `${w}%`, background: `linear-gradient(90deg, ${s.color}26, ${s.color}0d)`, border: `1px solid ${s.color}4d`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px" }}>
                        <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}</div>
                        <div className="mono" style={{ fontSize: 9, fontWeight: 700, color: s.color, opacity: 0.7 }}>%{((s.value / max) * 100).toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Glass>
          </>
        )}

        {/* ═══════════ ISLEM ARSIVI ═══════════ */}
        {page === "gecmis" && (
          <>
            {/* Coin Performance Table */}
            <Glass T={T} style={{ padding: 22, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Coin Bazli Performans</span>
                <span className="mono" style={{ fontSize: 10, color: T.textDim, marginLeft: "auto" }}>{coinPerf.length} COIN</span>
              </div>
              {coinPerf.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: T.textMute, fontSize: 11 }}>Veri yok</div>
              ) : coinPerf.map(c => {
                const wr = c.trades > 0 ? (c.wins / c.trades) * 100 : 0;
                const pnlCol = c.totalPnl >= 0 ? T.green : T.red;
                const wrCol = wr >= 60 ? T.green : wr >= 45 ? T.yellow : T.red;
                const maxAbs = Math.max(...coinPerf.map(x => Math.abs(x.totalPnl)), 1);
                const barW = (Math.abs(c.totalPnl) / maxAbs) * 100;
                return (
                  <div key={c.sym} style={{ display: "grid", gridTemplateColumns: "80px 60px 1fr 80px 90px 120px", gap: 16, alignItems: "center", padding: "12px 8px", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="mono" style={{ width: 28, height: 28, borderRadius: 7, background: `${pnlCol}14`, border: `1px solid ${pnlCol}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: pnlCol }}>{c.sym.slice(0, 3)}</div>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{c.sym}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{c.trades}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${wr}%`, background: `linear-gradient(90deg, ${wrCol}, ${wrCol}80)`, boxShadow: `0 0 6px ${wrCol}40` }} />
                      </div>
                      <span className="mono" style={{ fontSize: 9, color: T.textDim }}>{c.wins}W/{c.losses}L</span>
                    </div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: wrCol }}>{wr.toFixed(1)}%</div>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: c.avgPnl >= 0 ? T.green : T.red }}>{c.avgPnl >= 0 ? "+" : ""}${c.avgPnl.toFixed(2)}</div>
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", inset: 0, background: `${pnlCol}14`, borderRadius: 6, width: `${barW}%` }} />
                      <div className="mono" style={{ position: "relative", fontSize: 14, fontWeight: 800, color: pnlCol, padding: "6px 12px", textAlign: "right" }}>
                        {c.totalPnl >= 0 ? "+" : ""}${c.totalPnl.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Glass>

            {/* Trade History */}
            <Glass T={T} style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Islem Arsivi</span>
                <span className="mono" style={{ fontSize: 10, color: T.textDim }}>{histTrades.length} ISLEM</span>
                <button onClick={exportCSV} style={{
                  marginLeft: "auto",
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 16px", borderRadius: 8,
                  background: `linear-gradient(135deg, ${T.green}1f, ${T.blue}14)`,
                  border: `1px solid ${T.green}4d`, color: T.green,
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  CSV Indir
                </button>
              </div>
              {histTrades.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: T.textMute, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Henuz islem yok</div>
              ) : histTrades.map((t, i) => {
                const col = (t.pnl || 0) >= 0 ? T.green : T.red;
                const dir = t.direction === "UP" || t.direction === "LONG" ? "LONG" : "SHORT";
                const dirCol = dir === "LONG" ? T.green : T.red;
                const stCol = (t.status || "").includes("TP") ? T.green : (t.status || "").includes("SL") ? T.red : T.yellow;
                return (
                  <div key={i} style={{ padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{(t.symbol || "").replace("/USDT", "")}</span>
                          <span className="mono" style={{ fontSize: 9, fontWeight: 700, background: `${dirCol}33`, color: dirCol, border: `1px solid ${dirCol}66`, padding: "3px 7px", borderRadius: 4 }}>{dir} 5x</span>
                          <span className="mono" style={{ fontSize: 8, fontWeight: 700, background: `${stCol}1f`, color: stCol, padding: "2px 6px", borderRadius: 3 }}>{t.status}</span>
                          <span className="mono" style={{ fontSize: 9, color: T.textDim, marginLeft: 8 }}>{fmtDate(t.closed_at || t.opened_at)}</span>
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>
                          {fmtPrice(t.entry_price)} → {fmtPrice(t.exit_price)}
                          <span style={{ color: T.orange, marginLeft: 6 }}>fee -${(t.total_cost || t.entry_fee || 0.5).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: col }}>{(t.pnl || 0) >= 0 ? "+" : ""}${fmt(t.pnl || 0)}</div>
                    </div>
                  </div>
                );
              })}
            </Glass>
          </>
        )}

        {/* ═══════════ NAKIT GOCU ═══════════ */}
        {page === "tarama" && (
          <Glass T={T} style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Nakit Gocu Isi Haritasi</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: T.textDim }}>{coins.length} COIN</span>
            </div>
            {coinsByWeight.map(c => <HeatBar key={c.symbol} coin={c} maxZ={maxZ} T={T} />)}
          </Glass>
        )}

        {/* ═══════════ TAKVIM ═══════════ */}
        {page === "takvim" && (() => {
          const monthNames = ["Ocak","Subat","Mart","Nisan","Mayis","Haziran","Temmuz","Agustos","Eylul","Ekim","Kasim","Aralik"];
          const firstDay = new Date(calYear, calMonth, 1);
          const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
          let startWeekday = firstDay.getDay() - 1;
          if (startWeekday < 0) startWeekday = 6;

          const monthKey = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
          const monthPnls = Object.entries(calendarData).filter(([k]) => k.startsWith(monthKey)).map(([, v]) => v.pnl);
          const maxAbs = Math.max(...monthPnls.map(Math.abs), 300);
          const monthTotal = monthPnls.reduce((a, b) => a + b, 0);
          const activeDays = monthPnls.length;
          const bestDay = monthPnls.length > 0 ? Math.max(...monthPnls) : 0;
          const worstDay = monthPnls.length > 0 ? Math.min(...monthPnls) : 0;
          const winDays = monthPnls.filter(p => p > 0).length;

          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
                <Glass T={T} style={{ padding: 16, borderLeft: `3px solid ${T.green}` }}>
                  <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Bu Ay Toplam</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: monthTotal >= 0 ? T.green : T.red, marginTop: 4 }}>{monthTotal >= 0 ? "+" : ""}${monthTotal.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{activeDays} islem gunu</div>
                </Glass>
                <Glass T={T} style={{ padding: 16, borderLeft: `3px solid ${T.blue}` }}>
                  <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>En Iyi Gun</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: T.blue, marginTop: 4 }}>+${bestDay.toFixed(2)}</div>
                </Glass>
                <Glass T={T} style={{ padding: 16, borderLeft: `3px solid ${T.red}` }}>
                  <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>En Kotu Gun</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: T.red, marginTop: 4 }}>${worstDay.toFixed(2)}</div>
                </Glass>
                <Glass T={T} style={{ padding: 16, borderLeft: `3px solid ${T.yellow}` }}>
                  <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Basari Orani</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: T.yellow, marginTop: 4 }}>{winDays}/{activeDays || 0}</div>
                </Glass>
              </div>

              <Glass T={T} style={{ padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => { const m = calMonth - 1; if (m < 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(m); }} style={{ background: T.border, border: `1px solid ${T.borderMed}`, color: T.text, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>‹</button>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{monthNames[calMonth]} {calYear}</div>
                    <button onClick={() => { const m = calMonth + 1; if (m > 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(m); }} style={{ background: T.border, border: `1px solid ${T.borderMed}`, color: T.text, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>›</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 4 }}>
                  {["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"].map(d => (
                    <div key={d} style={{ textAlign: "center", fontSize: 10, color: T.textDim, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", padding: "8px 0" }}>{d}</div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                  {Array(startWeekday).fill(null).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                    const key = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const data = calendarData[key];
                    if (!data) {
                      return <div key={d} style={{ aspectRatio: 1, borderRadius: 10, padding: 10, background: T.border, display: "flex", flexDirection: "column", justifyContent: "space-between", color: T.textDim }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{d}</div>
                        <div style={{ fontSize: 8, opacity: 0.6 }}>0 islem</div>
                      </div>;
                    }
                    const intensity = Math.min(Math.abs(data.pnl) / maxAbs, 1);
                    const opa = 0.08 + intensity * 0.32;
                    const borderOpa = 0.25 + intensity * 0.4;
                    const col = data.pnl >= 0 ? T.green : T.red;
                    return (
                      <div key={d} style={{ aspectRatio: 1, borderRadius: 10, padding: 10, background: `${col}${Math.round(opa * 255).toString(16).padStart(2, "0")}`, border: `1px solid ${col}${Math.round(borderOpa * 255).toString(16).padStart(2, "0")}`, display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: col }}>{d}</div>
                        <div>
                          <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: col }}>{data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(0)}</div>
                          <div style={{ fontSize: 8, opacity: 0.7, color: col }}>{data.trades} islem</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Glass>
            </>
          );
        })()}

        {/* ═══════════ PIYASA ═══════════ */}
        {page === "piyasa" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr 340px", gap: 14, marginBottom: 14 }}>
              {["BTC", "ETH"].map(sym => {
                const c = coins.find(x => (x.symbol || "").startsWith(sym));
                const price = c?.current_price || c?.price || (sym === "BTC" ? 72450 : 2098);
                const change = c?.change_24h || (sym === "BTC" ? 2.34 : 1.78);
                const col = sym === "BTC" ? "#f7931a" : "#627eea";
                return (
                  <Glass key={sym} T={T} style={{ padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${col}, ${col}80)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>{sym === "BTC" ? "₿" : "Ξ"}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{sym === "BTC" ? "Bitcoin" : "Ethereum"}</div>
                        <div style={{ fontSize: 10, color: T.textDim }}>{sym} / USDT</div>
                      </div>
                      <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: change >= 0 ? T.green : T.red, background: `${change >= 0 ? T.green : T.red}1a`, border: `1px solid ${change >= 0 ? T.green : T.red}4d`, padding: "3px 8px", borderRadius: 5 }}>
                        {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>${fmt(price, sym === "BTC" ? 0 : 0)}</div>
                  </Glass>
                );
              })}

              <Glass T={T} style={{ padding: 20 }}>
                <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Fear &amp; Greed</div>
                <svg viewBox="0 0 220 130" style={{ width: "100%", height: 120 }}>
                  <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke={T.border} strokeWidth="18" strokeLinecap="round" />
                  <path d="M 20 110 A 90 90 0 0 1 56 43" fill="none" stroke={T.red} strokeWidth="18" strokeLinecap="round" />
                  <path d="M 56 43 A 90 90 0 0 1 110 20" fill="none" stroke={T.orange} strokeWidth="18" strokeLinecap="round" />
                  <path d="M 110 20 A 90 90 0 0 1 164 43" fill="none" stroke={T.yellow} strokeWidth="18" strokeLinecap="round" />
                  <path d="M 164 43 A 90 90 0 0 1 200 110" fill="none" stroke={T.green} strokeWidth="18" strokeLinecap="round" />
                  <g transform="translate(110 110) rotate(-57.6)">
                    <line x1="0" y1="0" x2="0" y2="-82" stroke={T.text} strokeWidth="3" strokeLinecap="round" />
                    <circle cx="0" cy="-82" r="4" fill={T.text} />
                  </g>
                  <circle cx="110" cy="110" r="8" fill={T.bg} stroke={T.text} strokeWidth="2" />
                </svg>
                <div style={{ textAlign: "center", marginTop: -4 }}>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: T.green, lineHeight: 1 }}>68</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.green, marginTop: 4, letterSpacing: 0.5 }}>GREED</div>
                </div>
              </Glass>
            </div>

            <Glass T={T} style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Piyasa Psikolojisi</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: T.textDim }}>{coins.length} COIN</span>
              </div>
              {coinsByWeight.map(c => <HeatBar key={c.symbol} coin={c} maxZ={maxZ} T={T} />)}
            </Glass>
          </>
        )}

        {/* ═══════════ KONTROL PANELI ═══════════ */}
        {page === "ayarlar" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <Glass T={T} style={{ padding: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Mod & Anahtarlar</div>
                {[
                  { key: "paperMode", label: state.paperMode ? "Paper Trade (Aktif)" : "Paper Trade (Kapali - LIVE!)", col: state.paperMode ? T.orange : T.red },
                  { key: "trailingStop", label: "Trailing Stop / Breakeven", col: T.green },
                  { key: "kartopu", label: "Kartopu (Bilesik Faiz)", col: T.blue },
                ].map(t => {
                  const on = state[t.key];
                  return (
                    <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 11, color: T.textDim, letterSpacing: 0.5 }}>{t.label}</span>
                      <div onClick={() => setState({ ...state, [t.key]: !on })} style={{ position: "relative", width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: on ? t.col : T.border, border: `1px solid ${on ? t.col : T.borderMed}`, boxShadow: on ? `0 0 12px ${t.col}99` : "none", transition: "all 0.3s" }}>
                        <div style={{ position: "absolute", top: 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.4)", transform: `translateX(${on ? 20 : 2}px)`, transition: "transform 0.3s" }} />
                      </div>
                    </div>
                  );
                })}
              </Glass>

              <Glass T={T} style={{ padding: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Risk Parametreleri</div>
                {[
                  { key: "ddLimit", label: "Gunluk DD Limiti", min: 2, max: 15, step: 1, suffix: "%" },
                  { key: "riskPct", label: "Risk Yuzdesi", min: 1, max: 5, step: 0.5, suffix: "%" },
                  { key: "leverage", label: "Kaldirac", min: 1, max: 20, step: 1, suffix: "x" },
                ].map(s => {
                  const v = state[s.key];
                  const pct = ((v - s.min) / (s.max - s.min)) * 100;
                  return (
                    <div key={s.key} style={{ padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: T.textDim }}>{s.label}</span>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: T.orange, background: `${T.orange}1f`, border: `1px solid ${T.orange}4d`, padding: "2px 10px", borderRadius: 4 }}>{v}{s.suffix}</span>
                      </div>
                      <div style={{ position: "relative", height: 6 }}>
                        <div style={{ position: "absolute", top: 0, left: 0, height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${T.orange}, ${T.red})`, width: `${pct}%`, pointerEvents: "none" }} />
                        <input type="range" min={s.min} max={s.max} step={s.step} value={v} onChange={(e) => setState({ ...state, [s.key]: Number(e.target.value) })} style={{ position: "absolute", inset: 0, width: "100%", cursor: "pointer" }} />
                      </div>
                    </div>
                  );
                })}
              </Glass>
            </div>

            {/* Circuit Breaker */}
            <Glass T={T} style={{ padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 20 }}>Circuit Breaker Durumu</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0" }}>
                <div className={ddLocked ? "" : "status-pulse"} style={{ width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${(ddLocked ? T.red : T.green)}26, ${(ddLocked ? T.red : T.green)}05)`, border: `2px solid ${ddLocked ? T.red : T.green}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ddLocked ? T.red : T.green} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d={ddLocked ? "M7 11V7a5 5 0 0 1 10 0v4" : "M7 11V7a5 5 0 0 1 9.9-1"}/></svg>
                  <div style={{ fontSize: 10, fontWeight: 800, color: ddLocked ? T.red : T.green, marginTop: 4 }}>{ddLocked ? "KILITLI" : "ACIK"}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: ddLocked ? T.red : T.green, marginTop: 14 }}>{ddLocked ? "Bot yeni islem almiyor" : "Bot aktif islem aliyor"}</div>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Gunluk Drawdown</span>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: ddPct > 3 ? T.red : ddPct > 1 ? T.yellow : T.green }}>{ddPct.toFixed(1)}% / {state.ddLimit}.0%</span>
                </div>
                <div style={{ position: "relative", height: 10, background: T.border, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min((ddPct / state.ddLimit) * 100, 100)}%`, background: `linear-gradient(90deg, ${T.green}, ${T.yellow}, ${T.red})`, borderRadius: 5 }} />
                </div>
              </div>
            </Glass>
          </>
        )}

        {/* ═══════════ POSITION MODAL ═══════════ */}
        {modalTrade && (
          <div onClick={() => setModalTrade(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: theme === "dark" ? "rgba(10,10,15,0.98)" : "rgba(255,255,255,0.98)",
              border: `1px solid ${T.borderMed}`, borderRadius: 16, width: "100%", maxWidth: 900,
              maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
            }}>
              <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{(modalTrade.symbol || "").replace("/USDT", "")}/USDT</div>
                  <div className="mono" style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>Paper trade ID: {modalTrade.order_id || "—"}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: (modalTrade.pnl || 0) >= 0 ? T.green : T.red }}>
                    {(modalTrade.pnl || 0) >= 0 ? "+" : ""}${fmt(modalTrade.pnl || 0)}
                  </div>
                  <button onClick={() => setModalTrade(null)} style={{ background: T.border, border: `1px solid ${T.borderMed}`, color: T.text, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
              </div>

              <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
                {[
                  ["Giris", fmtPrice(modalTrade.entry_price), T.text],
                  ["TP", fmtPrice(modalTrade.tp_price), T.green],
                  ["SL", fmtPrice(modalTrade.sl_price), T.red],
                  ["Marjin", "$100", T.purple],
                ].map(([l, v, c], i) => (
                  <div key={i} style={{ padding: "0 14px", borderRight: i < 3 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>{l}</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: c, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: 22 }}>
                <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>AI Acilis Nedeni</div>
                <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6, padding: "12px 14px", background: `${T.blue}0a`, border: `1px solid ${T.blue}2e`, borderRadius: 8 }}>
                  {modalTrade.ai_reasoning || genOpenReason(modalTrade)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
