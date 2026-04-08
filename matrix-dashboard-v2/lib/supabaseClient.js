import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function fetchMarketData() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("market_data")
      .select("*")
      .order("trade_score", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("market_data hatasi:", e);
    return [];
  }
}

export async function fetchWallet() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("wallet_status")
      .select("*")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error("wallet hatasi:", e);
    return null;
  }
}

export async function fetchTrades(limit = 50) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("trades hatasi:", e);
    return [];
  }
}

export async function fetchOpenTrades() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("status", "OPEN")
      .order("opened_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("open trades hatasi:", e);
    return [];
  }
}
