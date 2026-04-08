import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function fetchMarketData() {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from("market_data").select("*").order("trade_score", { ascending: false });
    return data || [];
  } catch (e) { console.error(e); return []; }
}

export async function fetchWallet() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.from("wallet_status").select("*").eq("id", 1).single();
    return data;
  } catch (e) { console.error(e); return null; }
}

export async function fetchTrades(limit = 50) {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from("trades").select("*").order("opened_at", { ascending: false }).limit(limit);
    return data || [];
  } catch (e) { console.error(e); return []; }
}

export async function fetchOpenTrades() {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from("trades").select("*").eq("status", "OPEN").order("opened_at", { ascending: false });
    return data || [];
  } catch (e) { console.error(e); return []; }
}
