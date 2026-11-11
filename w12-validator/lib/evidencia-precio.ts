import { createClient } from "@/lib/supabase/server";
import { normalizarFilas, type FilaPrecio } from "@/lib/precios";

// Lee pricing_evidence con la llave pública (lectura pública por RLS). null
// = no se pudo leer: la página lo dice en vez de inventar un estado.
export async function leerEvidenciaPrecio(): Promise<FilaPrecio[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_evidence")
    .select("id, amount_mxn, state, source, note, created_at")
    .order("id");
  if (error) {
    console.error("pricing_evidence: no se pudo leer", error);
    return null;
  }
  return normalizarFilas(data);
}
