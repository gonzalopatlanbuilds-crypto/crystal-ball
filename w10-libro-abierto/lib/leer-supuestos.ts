import "server-only";
import { createClient } from "@/lib/supabase/server";
import { CLAVES, type EstadoSupuesto } from "@/lib/supuestos";

export interface FilaSupuesto {
  id: string;
  key: string;
  value_num: number;
  unit: string;
  status: EstadoSupuesto;
  source_url: string | null;
  source_date: string | null;
  note: string | null;
}

// Supuestos de la org de la sesión (RLS filtra por org), en el orden del
// catálogo. `numeric` llega como número desde PostgREST.
export async function leerSupuestos(): Promise<{ filas: FilaSupuesto[]; error: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assumptions")
    .select("id, key, value_num, unit, status, source_url, source_date, note")
    .returns<FilaSupuesto[]>();
  if (error) {
    console.error("leerSupuestos: select falló", error);
    return { filas: [], error: true };
  }
  const orden = (k: string) => {
    const i = (CLAVES as string[]).indexOf(k);
    return i === -1 ? CLAVES.length : i;
  };
  const filas = (data ?? []).map((f) => ({ ...f, value_num: Number(f.value_num) }));
  filas.sort((a, b) => orden(a.key) - orden(b.key));
  return { filas, error: false };
}
