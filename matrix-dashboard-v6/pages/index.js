import { useState, useEffect, useMemo, useCallback } from "react";
import Head from "next/head";
import { fetchMarketData, fetchWallet, fetchTrades, fetchOpenTrades } from "../lib/supabaseClient";
import { THEMES } from "../lib/theme";

// ═══════════════════ HELPERS ═══════════════════
const fmt = (v, d = 2) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPrice = (v) => {
  if (!v || v === 0) return "—";
  const n = Number(v);
  if (n < 0.0001) return "$" + n.toFixed(7);
  if (n < 0.01) return "$" + n.toFixed(6);
  if (n < 1) return "$" + n.toFixed(4);
  if (n < 100) return "$" + n.toFixed(2);
  return "$" + Math.round(n).toLocaleString();
};
const fmtDate = (iso) => {
  if (!iso) return "—";
  try { const d = new Date(iso); return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
};
const timeAgo = (iso) => {
  if (!iso) return "—";
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} dk once`;
  if (mins < 1440) return `${Math.round(mins / 60)} sa once`;
  return `${Math.round(mins / 1440)} gun once`;
};
const duration = (open, close) => {
  if (!open || !close) return "—";
  const mins = Math.round((new Date(close) - new Date(open)) / 60000);
  if (mins < 60) return `${mins}dk`;
  return `${(mins / 60).toFixed(1)}sa`;
};
const parseML = (reason) => {
  if (!reason) return 0;
  const m = reason.match(/ML skor ([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
};
const statusInfo = (s) => {
  const map = { TP: { col: "green", label: "TP" }, SL: { col: "red", label: "SL" }, TRAILING: { col: "green", label: "TRAILING" }, TIME_STOP: { col: "orange", label: "ZAMAN" }, TIME_STOP_PROFIT: { col: "blue", label: "ZAMAN+" }, MOMENTUM: { col: "yellow", label: "MOMENTUM" }, FORCE_CLOSED: { col: "red", label: "KAPANDI" }, BREAKEVEN: { col: "green", label: "BE" } };
  return map[s] || { col: "textDim", label: s || "?" };
};

// ═══════════════════ SVG ICONS ═══════════════════
const I = {
  target: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  x: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  lock: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>,
  lockClosed: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  clock: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  trendUp: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  trendDown: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  chevUp: (c, s=10) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>,
  chevDown: (c, s=10) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>,
  chevRight: (c, s=10) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  filter: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  download: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  warn: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>,
  chat: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  bar: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  grid: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  shield: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  gear: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  bolt: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  pulse: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  search: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  info: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  dollar: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  sun: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  moon: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  file: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  globe: (c, s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
};

// ═══════════════════ COMPONENTS ═══════════════════
const Glass = ({ T, children, style = {}, ...p }) => <div style={{ background: T.glassBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${T.border}`, borderRadius: 14, transition: "all 0.3s", ...style }} {...p}>{children}</div>;
const NavBtn = ({ T, active, label, onClick }) => <button onClick={onClick} style={{ background: "none", border: "none", padding: "14px 18px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: active ? T.text : T.textDim, fontWeight: active ? 600 : 400, position: "relative", whiteSpace: "nowrap" }}>{label}{active && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.green}, transparent)` }} />}</button>;
const TfBtn = ({ T, active, label, onClick }) => <button onClick={onClick} style={{ background: active ? `${T.green}1a` : "transparent", border: `1px solid ${active ? `${T.green}4d` : T.border}`, color: active ? T.green : T.textDim, fontSize: 10, fontWeight: 600, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>;
const Toggle = ({ on, color, onToggle }) => <div onClick={onToggle} style={{ position: "relative", width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: on ? color : "rgba(255,255,255,0.06)", border: `1px solid ${on ? color : "rgba(255,255,255,0.12)"}`, boxShadow: on ? `0 0 12px ${color}60` : "none", transition: "all 0.3s" }}><div style={{ position: "absolute", top: 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.4)", transform: `translateX(${on ? 20 : 2}px)`, transition: "transform 0.3s" }} /></div>;

function MLScoreBar({ score, T }) {
  const pct = Math.max(0, Math.min(100, (score - 0.5) / 0.5 * 100));
  const color = score >= 0.80 ? T.green : score >= 0.72 ? T.blue : T.orange;
  return <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}><span style={{ fontSize: 8, color: T.textDim, fontWeight: 600 }}>ML</span><div style={{ flex: 1, height: 4, background: T.border, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})`, borderRadius: 2, boxShadow: `0 0 6px ${color}60` }} /></div><span className="mono" style={{ fontSize: 9, fontWeight: 700, color, minWidth: 28, textAlign: "right" }}>{score.toFixed(2)}</span></div>;
}

function TrailingBadge({ level, T }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ fontSize: 7, color: T.textMute, fontWeight: 600, marginRight: 2 }}>TRAIL</span>{[{ a: level >= 1, l: "BE" }, { a: level >= 2, l: "T1" }].map((s, i) => <div key={i} style={{ width: 18, height: 14, borderRadius: 3, background: s.a ? `${T.green}33` : T.border, border: `1px solid ${s.a ? T.green + "66" : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: s.a ? T.green : T.textMute, boxShadow: s.a ? `0 0 6px ${T.green}40` : "none" }}>{s.l}</div>)}</div>;
}

function TimeStopGauge({ openedAt, maxH, T }) {
  const [el, setEl] = useState(0);
  useEffect(() => { const u = () => setEl((Date.now() - new Date(openedAt).getTime()) / 3600000); u(); const iv = setInterval(u, 10000); return () => clearInterval(iv); }, [openedAt]);
  const pct = Math.min((el / maxH) * 100, 100);
  const rem = Math.max(0, maxH - el);
  const color = pct > 80 ? T.red : pct > 50 ? T.orange : T.textDim;
  return <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>{I.clock(color, 10)}<div style={{ flex: 1, height: 4, background: T.border, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${T.textDim}40, ${color})`, borderRadius: 2 }} /></div><span className="mono" style={{ fontSize: 8, fontWeight: 600, color, minWidth: 32, textAlign: "right" }}>{rem.toFixed(1)}h</span></div>;
}

function TPProgress({ entry, current, tp, sl, direction, T }) {
  const isLong = direction === "UP" || direction === "LONG";
  const tpDist = isLong ? tp - entry : entry - tp;
  const slDist = isLong ? entry - sl : sl - entry;
  const curDist = isLong ? current - entry : entry - current;
  const total = tpDist + slDist;
  const prog = total > 0 ? ((curDist + slDist) / total) * 100 : 50;
  const cp = Math.max(0, Math.min(100, prog));
  const slPct = total > 0 ? (slDist / total) * 100 : 50;
  const isP = curDist > 0;
  return <div style={{ position: "relative", height: 6, background: T.border, borderRadius: 3, margin: "6px 0" }}><div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${slPct}%`, background: `${T.red}15`, borderRadius: "3px 0 0 3px" }} /><div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${100-slPct}%`, background: `${T.green}10`, borderRadius: "0 3px 3px 0" }} /><div style={{ position: "absolute", left: `${slPct}%`, top: -2, bottom: -2, width: 1, background: T.textDim, opacity: 0.4 }} /><div style={{ position: "absolute", left: `${cp}%`, top: -3, width: 8, height: 12, marginLeft: -4, borderRadius: 2, background: isP ? T.green : T.red, boxShadow: `0 0 8px ${isP ? T.green : T.red}60` }} /></div>;
}

// ═══════════════════ AI MODAL ═══════════════════
function AIModal({ trade: t, T, onClose }) {
  const sym = (t.symbol||"").replace("/USDT","").replace(":USDT","");
  const ml = parseML(t.entry_reason);
  const isP = (t.pnl||0) >= 0;
  const col = isP ? T.green : T.red;
  const dir = t.direction === "UP" || t.direction === "LONG" ? "LONG" : "SHORT";
  const dirCol = dir === "LONG" ? T.green : T.red;
  const lev = t.leverage || 5;
  const sections = [
    { icon: I.info(T.blue, 14), title: "ML Karar Ozeti", col: T.blue, text: ml > 0 ? `Yapay zeka modeli bu sinyale %${(ml*100).toFixed(0)} guven skoru verdi. Esik degerimiz %70 — bu sinyal ${ml >= 0.80 ? "esigin cok ustunde, yuksek kaliteli" : "esigin ustunde, kabul edilebilir"} bir giris noktasi.` : "Bu islem ML filtresi oncesi acildi." },
    { icon: I.bar(T.orange, 14), title: "Hacim Analizi", col: T.orange, text: `${sym} islem aninda ortalamanin ${(t.volume_ratio||2).toFixed(1)} kati hacim uretti. Bu buyuk oyuncularin pozisyon aldigina isaret ediyor.` },
    { icon: I.trendUp(T.green, 14), title: "Trend Durumu", col: T.green, text: `4 saatlik grafikte ${dir === "LONG" ? "yukari" : "asagi"} trend tespit edildi. Fiyat hareketli ortalamanin ${dir === "LONG" ? "ustunde" : "altinda"} seyrediyor.` },
    { icon: I.shield(T.purple, 14), title: "Risk Yonetimi", col: T.purple, text: `Giris: ${fmtPrice(t.entry_price)} | TP: ${fmtPrice(t.tp_price)} | SL: ${fmtPrice(t.sl_price)}. Kaldirac ${lev.toFixed(1)}x (max 10x limit). Sabit $100 risk.` },
  ];
  if (t.status === "TRAILING" || t.breakeven_hit) sections.push({ icon: I.lock(T.green, 14), title: "Trailing Stop Aktif", col: T.green, text: "Fiyat TP yolunun %50'sini gecti — SL giris fiyatina cekildi. En kotu senaryo: sifir kayip." });

  return <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "rgba(12,12,18,0.98)", border: `1px solid ${T.borderMed}`, borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: `0 20px 80px rgba(0,0,0,0.8)` }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${dirCol}20`, border: `1px solid ${dirCol}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: dirCol }}>{dir === "LONG" ? "▲" : "▼"}</div>
        <div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16, fontWeight: 700 }}>{sym}</span><span className="mono" style={{ fontSize: 9, fontWeight: 700, background: `${dirCol}25`, color: dirCol, border: `1px solid ${dirCol}55`, padding: "2px 8px", borderRadius: 4 }}>{dir} {lev.toFixed(0)}x</span></div><div className="mono" style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{fmtPrice(t.entry_price)} → {fmtPrice(t.tp_price)}</div></div>
        <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: col }}>{isP ? "+" : ""}${fmt(t.pnl || 0)}</div>
        <button onClick={onClose} style={{ background: T.border, border: `1px solid ${T.borderMed}`, color: T.text, width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{I.x(T.text, 10)}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: `1px solid ${T.border}` }}>
        {[["Giris", fmtPrice(t.entry_price), T.text], ["TP", fmtPrice(t.tp_price), T.green], ["SL", fmtPrice(t.sl_price), T.red], ["Marjin", "$" + (t.margin||100), T.purple]].map(([l, v, c], i) => <div key={i} style={{ padding: "12px 14px", borderRight: i < 3 ? `1px solid ${T.border}` : "none" }}><div style={{ fontSize: 9, color: T.textMute, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>{l}</div><div className="mono" style={{ fontSize: 13, fontWeight: 700, color: c, marginTop: 2 }}>{v}</div></div>)}
      </div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, boxShadow: `0 0 8px ${T.green}80` }} /><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: T.textDim }}>AI Pozisyon Analizi</span></div>
        {sections.map((s, i) => <div key={i} style={{ marginBottom: 10, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, borderRadius: 10, borderLeft: `3px solid ${s.col}` }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>{s.icon}<span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{s.title}</span></div><div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.7 }}>{s.text}</div></div>)}
      </div>
      <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${T.border}` }}>
        {ml > 0 && <MLScoreBar score={ml} T={T} />}
        <TPProgress entry={t.entry_price||0} current={t.current_price||t.exit_price||t.entry_price||0} tp={t.tp_price||0} sl={t.sl_price||0} direction={t.direction} T={T} />
        <div className="mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: T.textMute }}><span>SL {fmtPrice(t.sl_price)}</span><span>Giris {fmtPrice(t.entry_price)}</span><span>TP {fmtPrice(t.tp_price)}</span></div>
      </div>
    </div>
  </div>;
}

// ═══════════════════ EQUITY CHART ═══════════════════
function EquityChart({ data, T }) {
  if (!data || data.length < 2) return <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMute, fontSize: 11 }}>Yeterli veri yok</div>;
  const W = 900, H = 260, pL = 60, pR = 30, pT = 30, pB = 40;
  const vals = data.map(p => p.v);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const rng = mx - mn || 1, pad = rng * 0.15, yMn = mn - pad, yMx = mx + pad;
  const xS = (W - pL - pR) / (data.length - 1);
  const yS = v => pT + (1 - (v - yMn) / (yMx - yMn)) * (H - pT - pB);
  const xA = i => pL + i * xS;
  const pts = data.map((p, i) => `${xA(i)},${yS(p.v)}`).join(" ");
  const area = `M ${xA(0)},${H-pB} L ${data.map((p, i) => `${xA(i)},${yS(p.v)}`).join(" L ")} L ${xA(data.length-1)},${H-pB} Z`;
  const grid = [];
  for (let i = 0; i <= 5; i++) { const y = pT + (i/5)*(H-pT-pB); const v = yMx - (i/5)*(yMx-yMn); grid.push(<line key={`l${i}`} x1={pL} y1={y} x2={W-pR} y2={y} stroke={T.border} />); grid.push(<text key={`t${i}`} x={pL-10} y={y+3} fill={T.textMute} fontSize="10" textAnchor="end" fontFamily="'JetBrains Mono', monospace">${v.toFixed(0)}</text>); }
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 260 }}>
    <defs><linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.green} stopOpacity="0.3" /><stop offset="100%" stopColor={T.green} stopOpacity="0" /></linearGradient></defs>
    {grid}
    {data.map((p, i) => { if (data.length > 8 && i % 2 !== 0 && i !== data.length-1) return null; return <text key={`x${i}`} x={xA(i)} y={H-15} fill={T.textMute} fontSize="10" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">{p.t}</text>; })}
    <path d={area} fill="url(#eqG)" /><polyline points={pts} fill="none" stroke={T.green} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    {data.map((p, i) => { if (!p.trade) return null; const x = xA(i), y = yS(p.v); const st = (p.trade.status||""); const isTP = st.includes("TP") || st === "TRAILING"; const isSL = st.includes("SL"); const c = isTP ? T.green : isSL ? T.red : T.yellow; if (isTP) { const my = y-18; return <g key={`m${i}`}><line x1={x} y1={y} x2={x} y2={my+8} stroke={c} strokeWidth="1" strokeDasharray="2,2" opacity="0.4" /><polygon points={`${x-6},${my+8} ${x+6},${my+8} ${x},${my-2}`} fill={c} stroke={T.bg} strokeWidth="1.5" /></g>; } else if (isSL) { const my = y+18; return <g key={`m${i}`}><line x1={x} y1={y} x2={x} y2={my-8} stroke={c} strokeWidth="1" strokeDasharray="2,2" opacity="0.4" /><polygon points={`${x-6},${my-8} ${x+6},${my-8} ${x},${my+2}`} fill={c} stroke={T.bg} strokeWidth="1.5" /></g>; } return <circle key={`m${i}`} cx={x} cy={y-14} r="4" fill={c} stroke={T.bg} strokeWidth="1.5" />; })}
    <circle cx={xA(data.length-1)} cy={yS(data[data.length-1].v)} r="5" fill={T.green} stroke={T.bg} strokeWidth="2" />
  </svg>;
}

// ═══════════════════ MAIN PAGE ═══════════════════
export default function Dashboard() {
  const [theme, setTheme] = useState("dark");
  const [page, setPage] = useState("genel");
  const [tf, setTf] = useState("TUM");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [mob, setMob] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [coins, setCoins] = useState([]);
  const [openTrades, setOpenTrades] = useState([]);
  const [histTrades, setHistTrades] = useState([]);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [archFilter, setArchFilter] = useState({ coin: "ALL", status: "ALL", dir: "ALL", sort: "date" });
  const [cashSort, setCashSort] = useState("vol");
  const [cashFilter, setCashFilter] = useState("all");
  const [mktSort, setMktSort] = useState("cap");
  const [mktSearch, setMktSearch] = useState("");

  const T = THEMES[theme];

  useEffect(() => { const h = () => setMob(window.innerWidth < 1000); h(); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  useEffect(() => { const s = typeof window !== "undefined" ? localStorage.getItem("matrix-theme") : null; if (s) setTheme(s); }, []);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("matrix-theme", theme); }, [theme]);

  const loadData = useCallback(async () => {
    try {
      const [mkt, wal, trades, openT] = await Promise.all([fetchMarketData(), fetchWallet(), fetchTrades(200), fetchOpenTrades()]);
      if (mkt) setCoins(mkt); if (wal) setWallet(wal); if (openT) setOpenTrades(openT);
      if (trades) setHistTrades(trades.filter(t => t.status !== "OPEN"));
      setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  }, []);

  useEffect(() => { loadData(); const iv = setInterval(loadData, 15000); return () => clearInterval(iv); }, [loadData]);

  const bal = wallet?.balance || 500;
  const initBal = wallet?.initial_balance || 500;
  const dailyPnl = wallet?.daily_pnl || 0;
  const pnlPct = initBal > 0 ? ((bal - initBal) / initBal) * 100 : 0;
  const ddPct = Math.abs(wallet?.daily_dd_pct || 0);
  const ddLocked = wallet?.dd_locked || false;
  const openCount = openTrades.length;
  const winRate = histTrades.length > 0 ? (histTrades.filter(t => (t.pnl||0) > 0).length / histTrades.length) * 100 : 0;

  const equityData = useMemo(() => {
    if (!histTrades.length) return { "1G": [], "1H": [], "1A": [], "TUM": [{ t: "start", v: initBal }, { t: "now", v: bal }] };
    let cum = initBal;
    const sorted = [...histTrades].reverse();
    const tum = sorted.map(t => { cum += t.pnl || 0; return { t: (t.closed_at||t.opened_at||"").slice(5, 10), v: Math.round(cum * 100) / 100, trade: t }; });
    return { "1G": tum.slice(-8), "1H": tum.slice(-14), "1A": tum.slice(-30), "TUM": tum };
  }, [histTrades, bal, initBal]);

  const curEq = equityData[tf] || [];
  const dispBal = curEq.length > 0 ? curEq[curEq.length - 1].v : bal;
  const dispPct = curEq.length > 1 ? ((curEq[curEq.length-1].v - curEq[0].v) / curEq[0].v) * 100 : pnlPct;

  const coinPerf = useMemo(() => {
    const g = {};
    histTrades.forEach(t => { const s = (t.symbol||"").replace("/USDT","").replace(":USDT",""); if (!s) return; if (!g[s]) g[s] = { sym: s, trades: 0, wins: 0, losses: 0, totalPnl: 0, mlSum: 0 }; g[s].trades++; if ((t.pnl||0) > 0) g[s].wins++; else g[s].losses++; g[s].totalPnl += t.pnl || 0; g[s].mlSum += parseML(t.entry_reason); });
    return Object.values(g).map(x => ({ ...x, avgPnl: x.trades > 0 ? x.totalPnl/x.trades : 0, avgMl: x.trades > 0 ? x.mlSum/x.trades : 0, wr: x.trades > 0 ? (x.wins/x.trades)*100 : 0 })).sort((a, b) => b.totalPnl - a.totalPnl);
  }, [histTrades]);

  const aiLogs = useMemo(() => {
    return histTrades.slice(0, 15).map(t => {
      const sym = (t.symbol||"").replace("/USDT","").replace(":USDT","");
      const pnl = t.pnl || 0;
      const ml = parseML(t.entry_reason);
      const color = pnl >= 0 ? T.green : T.red;
      const st = statusInfo(t.status);
      return { color, ago: timeAgo(t.closed_at || t.opened_at), msg: `${sym} ${t.direction === "UP" || t.direction === "LONG" ? "long" : "short"} ${st.label} — Net ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}.${ml > 0 ? ` ML: ${ml.toFixed(2)}` : ""}`, trade: t };
    });
  }, [histTrades, T]);

  const calData = useMemo(() => {
    const m = {};
    histTrades.forEach(t => { const d = t.closed_at || t.opened_at; if (!d) return; const k = d.slice(0, 10); if (!m[k]) m[k] = { pnl: 0, trades: 0, wins: 0 }; m[k].pnl += t.pnl || 0; m[k].trades++; if ((t.pnl||0) > 0) m[k].wins++; });
    return m;
  }, [histTrades]);

  const exportCSV = () => {
    const h = ["Tarih","Sembol","Yon","Giris","Cikis","PnL","ML","Durum","Leverage"];
    const r = histTrades.map(t => [fmtDate(t.closed_at||t.opened_at),(t.symbol||""),t.direction==="UP"||t.direction==="LONG"?"LONG":"SHORT",t.entry_price||0,t.exit_price||0,t.pnl||0,parseML(t.entry_reason).toFixed(2),t.status||"",t.leverage||0]);
    const csv = "\uFEFF" + h.join(",") + "\n" + r.map(x => x.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `matrix_trades_${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: T.textDim, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Veri Yukleniyor</div></div>;

  return <>
    <Head><title>Matrix v7.1</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700;800&display=swap'); .mono{font-family:'JetBrains Mono',monospace} .live-dot{animation:pulse 2s infinite} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    <div style={{ minHeight: "100vh", color: T.text, fontFamily: "'Inter', system-ui, sans-serif", background: T.bg, backgroundImage: T.bgImage, padding: mob ? 12 : 20 }}>

      {/* ═══ HERO ═══ */}
      <Glass T={T} style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 14, borderRight: `1px solid ${T.border}` }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: `linear-gradient(135deg, ${T.green}26, ${T.blue}1a)`, border: `1px solid ${T.green}4d`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: T.green, fontSize: 13 }}>M</div>
          <div><div style={{ fontSize: 13, fontWeight: 700 }}>Matrix</div><div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, textTransform: "uppercase" }}>Quant Engine v7.1</div></div>
        </div>
        {!mob && [{ l: "Kasa", v: `$${fmt(bal)}`, c: T.text }, { l: "Toplam PnL", v: `${dailyPnl >= 0 ? "+" : ""}$${fmt(dailyPnl)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`, c: dailyPnl >= 0 ? T.green : T.red }, { l: "Kazanma", v: `${winRate.toFixed(1)}%`, c: T.text }, { l: "Acik", v: `${openCount}/5`, c: T.text }].map((m, i) => <div key={i} style={{ padding: "0 14px", borderRight: i < 3 ? `1px solid ${T.border}` : "none" }}><div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>{m.l}</div><div className="mono" style={{ fontSize: 14, fontWeight: 700, color: m.c }}>{m.v}</div></div>)}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: `${T.orange}1a`, border: `1px solid ${T.orange}66` }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: T.orange }} /><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: T.orange }}>PAPER</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: `${T.green}0f`, border: `1px solid ${T.green}33` }}><div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} /><span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: T.green }}>ML 0.70</span></div>
          <div onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{ width: 32, height: 32, borderRadius: 8, background: T.border, border: `1px solid ${T.borderMed}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{theme === "dark" ? I.sun("#fbbf24", 14) : I.moon("#1e293b", 14)}</div>
        </div>
      </Glass>

      {/* ═══ NAV ═══ */}
      <Glass T={T} style={{ padding: "0 8px", marginBottom: 14 }}>
        <div style={{ display: "flex", overflowX: "auto" }}>
          {[{ id: "genel", label: "Komuta Merkezi" }, { id: "gecmis", label: "Islem Arsivi" }, { id: "tarama", label: "Nakit Gocu" }, { id: "takvim", label: "Takvim" }, { id: "piyasa", label: "Piyasa" }, { id: "ayarlar", label: "Kontrol Paneli" }].map(item => <NavBtn key={item.id} T={T} active={page === item.id} label={item.label} onClick={() => setPage(item.id)} />)}
        </div>
      </Glass>

      {/* ═══════════ KOMUTA MERKEZI ═══════════ */}
      {page === "genel" && <>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 420px", gap: 14 }}>
          {/* Equity */}
          <Glass T={T} style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: T.textDim, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Portfoy Performansi</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div className="mono" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>${fmt(dispBal)}</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: dispPct >= 0 ? T.green : T.red }}>{dispPct >= 0 ? "+" : ""}{dispPct.toFixed(2)}%</div>
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 10, color: T.textDim }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `7px solid ${T.green}` }} />TP</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `7px solid ${T.red}` }} />SL</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>{["1G","1H","1A","TUM"].map(x => <TfBtn key={x} T={T} active={tf === x} label={x} onClick={() => setTf(x)} />)}</div>
            </div>
            <div style={{ marginTop: 14 }}><EquityChart data={curEq} T={T} /></div>
          </Glass>

          {/* Aktif Pozisyonlar */}
          <Glass T={T} style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Aktif Pozisyonlar</span>
              <span className="mono" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${T.blue}1a`, color: T.blue, border: `1px solid ${T.blue}33` }}>{openCount}/5</span>
            </div>
            {openTrades.length === 0 ? <div style={{ padding: "30px 0", textAlign: "center", color: T.textMute, fontSize: 11 }}>Sinyal bekleniyor</div> : openTrades.map((t, i) => {
              const col = (t.pnl||0) >= 0 ? T.green : T.red;
              const dir = t.direction === "UP" || t.direction === "LONG" ? "LONG" : "SHORT";
              const dirCol = dir === "LONG" ? T.green : T.red;
              const ml = parseML(t.entry_reason);
              const lev = t.leverage || 5;
              return <div key={i} onClick={() => setModal(t)} style={{ padding: 14, marginBottom: 10, borderRadius: 12, background: `${col}08`, border: `1px solid ${col}20`, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 3, height: 40, borderRadius: 2, background: col, boxShadow: `0 0 8px ${col}60` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{(t.symbol||"").replace("/USDT","").replace(":USDT","")}</span>
                      <span className="mono" style={{ fontSize: 8, fontWeight: 700, background: `${dirCol}25`, color: dirCol, border: `1px solid ${dirCol}55`, padding: "2px 6px", borderRadius: 3 }}>{dir} {lev.toFixed(0)}x</span>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{fmtPrice(t.entry_price)} → {fmtPrice(t.tp_price)} | SL {fmtPrice(t.sl_price)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: col }}>{(t.pnl||0) >= 0 ? "+" : ""}${fmt(t.pnl || 0)}</div>
                    <div className="mono" style={{ fontSize: 9, color: col, opacity: 0.7 }}>{((t.pnl_pct||0)).toFixed(2)}%</div>
                  </div>
                </div>
                <TPProgress entry={t.entry_price||0} current={t.current_price||t.entry_price||0} tp={t.tp_price||0} sl={t.sl_price||0} direction={t.direction} T={T} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center", marginTop: 8, padding: "6px 0", borderTop: `1px solid ${T.border}` }}>
                  {ml > 0 ? <MLScoreBar score={ml} T={T} /> : <div />}
                  <TrailingBadge level={t.breakeven_hit ? 1 : 0} T={T} />
                  {t.opened_at ? <TimeStopGauge openedAt={t.opened_at} maxH={6} T={T} /> : <div />}
                </div>
                <div className="mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: T.textMute }}><span>${t.risk_amount || t.margin || 100} risk</span><span style={{ color: T.blue, opacity: 0.6 }}>detay icin tikla</span></div>
              </div>;
            })}
          </Glass>
        </div>

        {/* Alerts + AI Log */}
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 14, marginTop: 14 }}>
          <Glass T={T} style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>{I.warn(T.orange, 14)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Uyarilar</span></div>
            <div style={{ maxHeight: 340, overflowY: "auto", padding: 10 }}>
              {ddLocked && <div style={{ padding: "10px 12px", marginBottom: 6, borderRadius: 8, background: `${T.red}0a`, border: `1px solid ${T.red}2e`, borderLeft: `3px solid ${T.red}` }}><div style={{ fontSize: 11, fontWeight: 700 }}>Circuit Breaker aktif</div><div style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>Bot yeni islem almiyor. 00:00 UTC'de reset olacak.</div></div>}
              {openCount >= 5 && <div style={{ padding: "10px 12px", borderRadius: 8, background: `${T.orange}0a`, border: `1px solid ${T.orange}2e`, borderLeft: `3px solid ${T.orange}` }}><div style={{ fontSize: 11, fontWeight: 700 }}>Tum slotlar dolu</div><div style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>5/5 pozisyon acik — yeni sinyaller atlanacak.</div></div>}
              {!ddLocked && openCount < 5 && <div style={{ padding: 30, textAlign: "center", color: T.textMute, fontSize: 11 }}>Uyari yok</div>}
            </div>
          </Glass>
          <Glass T={T} style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>{I.chat(T.blue, 14)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>AI Anlatim</span><div className="live-dot" style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: T.green }} /></div>
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              {aiLogs.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: T.textMute, fontSize: 11 }}>Henuz log yok</div> : aiLogs.map((l, i) => <div key={i} onClick={() => setModal(l.trade)} style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}><div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}><div style={{ width: 8, height: 8, background: l.color, marginTop: 5, flexShrink: 0, boxShadow: `0 0 8px ${l.color}80`, transform: "rotate(45deg)" }} /><div style={{ flex: 1 }}><div style={{ fontSize: 11, color: T.text, lineHeight: 1.6 }}>{l.msg}</div><div className="mono" style={{ fontSize: 9, color: T.textMute, marginTop: 4 }}>{l.ago}</div></div></div></div>)}
            </div>
          </Glass>
        </div>
      </>}

      {/* ═══════════ ISLEM ARSIVI ═══════════ */}
      {page === "gecmis" && <>
        <Glass T={T} style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>{I.bar(T.green, 14)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Islem Arsivi</span><span className="mono" style={{ fontSize: 10, color: T.textDim }}>{histTrades.length} ISLEM</span>
            <button onClick={exportCSV} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: `linear-gradient(135deg, ${T.green}1f, ${T.blue}14)`, border: `1px solid ${T.green}4d`, color: T.green, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{I.download(T.green, 12)} CSV Indir</button>
          </div>
          {histTrades.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: T.textMute, fontSize: 11 }}>Henuz islem yok</div> : histTrades.map((t, i) => {
            const col = (t.pnl||0) >= 0 ? T.green : T.red;
            const dir = t.direction === "UP" || t.direction === "LONG" ? "LONG" : "SHORT";
            const dirCol = dir === "LONG" ? T.green : T.red;
            const st = statusInfo(t.status);
            const stCol = T[st.col] || T.textDim;
            const ml = parseML(t.entry_reason);
            const lev = t.leverage || 5;
            return <div key={i} onClick={() => setModal(t)} style={{ padding: "14px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 3, height: 28, borderRadius: 2, background: col, boxShadow: `0 0 4px ${col}40` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{(t.symbol||"").replace("/USDT","").replace(":USDT","")}</span>
                    <span className="mono" style={{ fontSize: 9, fontWeight: 700, background: `${dirCol}33`, color: dirCol, border: `1px solid ${dirCol}66`, padding: "3px 7px", borderRadius: 4 }}>{dir} {lev.toFixed(0)}x</span>
                    <span className="mono" style={{ fontSize: 8, fontWeight: 700, background: `${stCol}1f`, color: stCol, padding: "2px 6px", borderRadius: 3 }}>{st.label}</span>
                    {ml > 0 && <span className="mono" style={{ fontSize: 8, color: T.blue, opacity: 0.7 }}>ML {ml.toFixed(2)}</span>}
                    <span className="mono" style={{ fontSize: 9, color: T.textDim, marginLeft: 8 }}>{fmtDate(t.closed_at || t.opened_at)}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>{fmtPrice(t.entry_price)} → {fmtPrice(t.exit_price)} <span style={{ color: T.textMute, marginLeft: 8 }}>{duration(t.opened_at, t.closed_at)}</span></div>
                </div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: col }}>{(t.pnl||0) >= 0 ? "+" : ""}${fmt(t.pnl || 0)}</div>
              </div>
            </div>;
          })}
        </Glass>
      </>}

      {/* ═══════════ NAKIT GOCU ═══════════ */}
      {page === "tarama" && <Glass T={T} style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>{I.pulse(T.blue, 14)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Nakit Gocu & Sinyal Durumu</span><span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: T.textDim }}>{coins.length} COIN</span></div>
        {coins.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: T.textMute, fontSize: 11 }}>Veri bekleniyor</div> : coins.sort((a, b) => Math.abs(b.volume_ratio||0) - Math.abs(a.volume_ratio||0)).map((c, i) => {
          const sym = (c.symbol||"").replace("/USDT","").replace(":USDT","");
          const vr = c.volume_ratio || 0;
          const vrCol = vr >= 5 ? T.green : vr >= 3 ? T.blue : vr >= 2 ? T.orange : T.textMute;
          const perf = coinPerf.find(p => p.sym === sym);
          const pnlCol = perf && perf.totalPnl >= 0 ? T.green : T.red;
          return <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, marginBottom: 6, background: vr >= 3 ? `${vrCol}08` : "transparent", border: `1px solid ${vr >= 3 ? vrCol + "1a" : "transparent"}` }}>
            <div className="mono" style={{ width: 52, fontWeight: 700, fontSize: 12, color: T.text }}>{sym}</div>
            <div style={{ flex: 1, position: "relative", height: 8, background: T.border, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(vr / 8 * 100, 100)}%`, background: `linear-gradient(90deg, ${vrCol}60, ${vrCol})`, boxShadow: vr >= 5 ? `0 0 8px ${vrCol}40` : "none" }} />
            </div>
            <div className="mono" style={{ width: 40, textAlign: "right", fontSize: 11, fontWeight: 700, color: vrCol }}>{vr.toFixed(1)}x</div>
            <div className="mono" style={{ width: 50, textAlign: "right", fontSize: 10, fontWeight: 600, color: c.signal_status === "SINYAL" ? T.green : T.textMute }}>{c.signal_status || "BEKLE"}</div>
            {perf && <div className="mono" style={{ width: 60, textAlign: "right", fontSize: 10, fontWeight: 700, color: pnlCol }}>{perf.totalPnl >= 0 ? "+" : ""}${perf.totalPnl.toFixed(0)}</div>}
          </div>;
        })}
      </Glass>}

      {/* ═══════════ TAKVIM ═══════════ */}
      {page === "takvim" && (() => {
        const mN = ["Ocak","Subat","Mart","Nisan","Mayis","Haziran","Temmuz","Agustos","Eylul","Ekim","Kasim","Aralik"];
        const fD = new Date(calYear, calMonth, 1);
        const dIM = new Date(calYear, calMonth+1, 0).getDate();
        let sW = fD.getDay() - 1; if (sW < 0) sW = 6;
        const mK = `${calYear}-${String(calMonth+1).padStart(2,"0")}`;
        const mPs = Object.entries(calData).filter(([k]) => k.startsWith(mK)).map(([, v]) => v.pnl);
        const mxA = Math.max(...mPs.map(Math.abs), 300);
        const mT = mPs.reduce((a, b) => a+b, 0);
        const aD = mPs.length;
        return <>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
            {[["Bu Ay Toplam", `${mT >= 0 ? "+" : ""}$${mT.toFixed(2)}`, mT >= 0 ? T.green : T.red, T.green], ["En Iyi Gun", mPs.length > 0 ? `+$${Math.max(...mPs).toFixed(2)}` : "$0", T.blue, T.blue], ["En Kotu Gun", mPs.length > 0 ? `$${Math.min(...mPs).toFixed(2)}` : "$0", T.red, T.red], ["Islem Gunu", `${aD}`, T.yellow, T.yellow]].map(([l, v, c, bc], i) => <Glass key={i} T={T} style={{ padding: 16, borderLeft: `3px solid ${bc}` }}><div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>{l}</div><div className="mono" style={{ fontSize: 22, fontWeight: 800, color: c, marginTop: 4 }}>{v}</div></Glass>)}
          </div>
          <Glass T={T} style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => { const m = calMonth-1; if (m < 0) { setCalMonth(11); setCalYear(calYear-1); } else setCalMonth(m); }} style={{ background: T.border, border: `1px solid ${T.borderMed}`, color: T.text, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>‹</button>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{mN[calMonth]} {calYear}</div>
                <button onClick={() => { const m = calMonth+1; if (m > 11) { setCalMonth(0); setCalYear(calYear+1); } else setCalMonth(m); }} style={{ background: T.border, border: `1px solid ${T.borderMed}`, color: T.text, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>›</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 4 }}>{["Pzt","Sal","Car","Per","Cum","Cmt","Paz"].map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, color: T.textDim, fontWeight: 600, padding: "8px 0" }}>{d}</div>)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {Array(sW).fill(null).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: dIM }, (_, i) => i+1).map(d => {
                const k = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                const data = calData[k];
                if (!data) return <div key={d} style={{ aspectRatio: 1, borderRadius: 10, padding: 10, background: T.border, display: "flex", flexDirection: "column", justifyContent: "space-between", color: T.textDim }}><div style={{ fontSize: 14, fontWeight: 700 }}>{d}</div><div style={{ fontSize: 8, opacity: 0.6 }}>0 islem</div></div>;
                const int = Math.min(Math.abs(data.pnl)/mxA, 1);
                const op = 0.08 + int * 0.32;
                const bOp = 0.25 + int * 0.4;
                const c2 = data.pnl >= 0 ? T.green : T.red;
                return <div key={d} style={{ aspectRatio: 1, borderRadius: 10, padding: 10, background: `${c2}${Math.round(op*255).toString(16).padStart(2,"0")}`, border: `1px solid ${c2}${Math.round(bOp*255).toString(16).padStart(2,"0")}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}><div style={{ fontSize: 14, fontWeight: 700, color: c2 }}>{d}</div><div><div className="mono" style={{ fontSize: 11, fontWeight: 700, color: c2 }}>{data.pnl >= 0 ? "+" : ""}${data.pnl.toFixed(0)}</div><div style={{ fontSize: 8, opacity: 0.7, color: c2 }}>{data.trades} islem</div></div></div>;
              })}
            </div>
          </Glass>
        </>;
      })()}

      {/* ═══════════ PIYASA ═══════════ */}
      {page === "piyasa" && <Glass T={T} style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>{I.globe(T.blue, 14)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Piyasa & Bot Durumu</span><span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: T.textDim }}>{coins.length} COIN</span></div>
        {coins.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: T.textMute, fontSize: 11 }}>Veri bekleniyor</div> : coins.map((c, i) => {
          const sym = (c.symbol||"").replace("/USDT","").replace(":USDT","");
          const perf = coinPerf.find(p => p.sym === sym);
          return <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div className="mono" style={{ width: 60, fontWeight: 700, fontSize: 12 }}>{sym}</div>
            <div className="mono" style={{ width: 80, fontSize: 10, color: T.textDim }}>{fmtPrice(c.price)}</div>
            <div className="mono" style={{ width: 50, fontSize: 10, color: (c.volume_ratio||0) >= 3 ? T.green : T.textDim }}>{(c.volume_ratio||0).toFixed(1)}x</div>
            <div className="mono" style={{ width: 50, fontSize: 10, color: c.signal_status === "SINYAL" ? T.green : T.textMute }}>{c.signal_status || "—"}</div>
            {perf && <><div className="mono" style={{ width: 40, fontSize: 9, color: perf.wr >= 50 ? T.green : T.orange }}>%{perf.wr.toFixed(0)}</div><div className="mono" style={{ flex: 1, textAlign: "right", fontSize: 10, fontWeight: 700, color: perf.totalPnl >= 0 ? T.green : T.red }}>{perf.totalPnl >= 0 ? "+" : ""}${perf.totalPnl.toFixed(0)}</div></>}
          </div>;
        })}
      </Glass>}

      {/* ═══════════ KONTROL PANELI ═══════════ */}
      {page === "ayarlar" && <>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <Glass T={T} style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>{I.gear(T.blue, 14)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Strateji v7.1 ML</span></div>
            {[["ML Filtre (XGBoost)", "Esik: 0.70 | 25 ozellik | AUC: 0.707", T.purple], ["Trailing Stop (3 Kademe)", "%50 → Entry, %75 → +%25 kar", T.green], ["Zaman Durdurma", "6sa base + akilli uzatma (max 12sa)", T.blue], ["Sabit Risk", "$100 per trade | Max 10x leverage", T.orange], ["RR Orani", "1.5 (TP = SL x 1.5)", T.yellow], ["SL Araligi", "%4 — %8 (ATR bazli)", T.red], ["Coin Sayisi", "50 coin | 2sa cooldown", T.textDim], ["Max Pozisyon", "5 slot esanli", T.blue]].map(([l, s, c], i) => <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}><div><div style={{ fontSize: 11, color: T.textDim, fontWeight: 600 }}>{l}</div><div style={{ fontSize: 8, color: T.textMute, marginTop: 1 }}>{s}</div></div><div style={{ width: 8, height: 8, borderRadius: 2, background: c }} /></div>)}
          </Glass>
          <Glass T={T} style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>{I.bolt(ddLocked ? T.red : T.green, 14)}<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Circuit Breaker</span></div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0" }}>
              <div style={{ width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${(ddLocked ? T.red : T.green)}18, ${(ddLocked ? T.red : T.green)}04)`, border: `2px solid ${ddLocked ? T.red : T.green}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{ddLocked ? I.lockClosed(T.red, 24) : I.lock(T.green, 24)}<div style={{ fontSize: 9, fontWeight: 800, color: ddLocked ? T.red : T.green, marginTop: 4 }}>{ddLocked ? "KILITLI" : "ACIK"}</div></div>
              <div style={{ fontSize: 12, fontWeight: 700, color: ddLocked ? T.red : T.green, marginTop: 12 }}>{ddLocked ? "Bot yeni islem almiyor" : "Bot aktif islem aliyor"}</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><span style={{ fontSize: 9, color: T.textMute, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Gunluk Drawdown</span><span className="mono" style={{ fontSize: 13, fontWeight: 800, color: ddPct > 3 ? T.red : ddPct > 1 ? T.yellow : T.green }}>{ddPct.toFixed(1)}% / 5%</span></div>
              <div style={{ position: "relative", height: 10, background: T.border, borderRadius: 5, overflow: "hidden" }}><div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min((ddPct/5)*100, 100)}%`, background: `linear-gradient(90deg, ${T.green}, ${T.yellow}, ${T.red})`, borderRadius: 5 }} /></div>
            </div>
          </Glass>
        </div>
      </>}

      {/* ═══ MODAL ═══ */}
      {modal && <AIModal trade={modal} T={T} onClose={() => setModal(null)} />}
    </div>
  </>;
}
