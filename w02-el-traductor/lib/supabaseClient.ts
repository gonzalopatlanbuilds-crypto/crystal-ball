import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (cliente) return cliente;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisa tu .env.local (ver .env.local.example)."
    );
  }

  cliente = createClient(supabaseUrl, supabaseAnonKey);
  return cliente;
}
