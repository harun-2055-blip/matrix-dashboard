import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function fetchWallet() {
  const { data } = await supabase.from("wallet_status").select("*").limit(1).single();
  return data;
}

export async function fetchOpenTrades() {
  const { data } = await supabase.from("trades").select("*").eq("status", "OPEN").order("opened_at", { ascending: false });
  return data || [];
}

export async function fetchTrades(limit = 200) {
  const { data } = await supabase.from("trades").select("*").neq("status", "OPEN").order("closed_at", { ascending: false }).limit(limit);
  return data || [];
}

export async function fetchMarketData() {
  const { data } = await supabase.from("market_data").select("*").order("symbol");
  return data || [];
}
