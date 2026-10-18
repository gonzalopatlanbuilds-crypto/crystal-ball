import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente para la página pública: solo la llave anon, sin sesión y sin
// cookies (no lee ni escribe ninguna). Lo que puede ver lo decide RLS:
// únicamente published_ledger de organizaciones oficiales.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
