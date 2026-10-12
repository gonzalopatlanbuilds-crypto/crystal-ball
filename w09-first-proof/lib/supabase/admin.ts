import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la service role key: se salta RLS y los privilegios por
// columna. Existe por UNA razón: escribir `submissions.ai_observations`,
// que el candidato no puede escribir con la llave pública (si pudiera,
// podría fabricar "observaciones de IA" a su favor). No usarlo para nada
// más; todo lo demás va con la sesión del usuario (lib/supabase/server.ts).
//
// SUPABASE_SERVICE_ROLE_KEY sin NEXT_PUBLIC_: nunca llega al navegador.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
