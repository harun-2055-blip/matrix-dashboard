import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = url && key ? createClient(url, key) : null;

const safe = async (fn, fallback) => {
  if (!supabase) return fallback;
  try { return await fn(); } catch (e) { console.error(e); return fallback; }
};

export async function fetchMarketData() {
  return safe(async () => {
    const { data } = await supabase.from("market_data").select("*").order("trade_score", { ascending: false });
    return data || [];
  }, []);
}

export async function fetchWallet() {
  return safe(async () => {
    const { data } = await supabase.from("wallet_status").select("*").eq("id", 1).maybeSingle();
    return data;
  }, null);
}

export async function fetchTrades(limit = 200) {
  return safe(async () => {
    const { data } = await supabase.from("trades").select("*").order("opened_at", { ascending: false }).limit(limit);
    return data || [];
  }, []);
}

export async function fetchOpenTrades() {
  return safe(async () => {
    const { data } = await supabase.from("trades").select("*").eq("status", "OPEN").order("opened_at", { ascending: false });
    return data || [];
  }, []);
}
