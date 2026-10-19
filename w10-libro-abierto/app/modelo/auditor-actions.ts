"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { leerSupuestos } from "@/lib/leer-supuestos";
import { auditarSupuestos } from "@/lib/auditor";
import type { ObservacionIA } from "@/lib/guardia-auditor";

export type AuditorState =
  | { observaciones: ObservacionIA[] }
  | { error: string }
  | undefined;

// Endpoint del auditor: solo con sesión y organización, solo en el
// servidor. Lee los supuestos de la org (RLS) y nunca recibe datos del
// cliente: no se le puede inyectar otra lista desde el navegador. El
// resultado no se guarda ni se publica.
export async function pedirObservacionesIA(): Promise<AuditorState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { filas, error } = await leerSupuestos();
  if (error) return { error: "No se pudieron leer los supuestos. Intenta de nuevo." };
  if (filas.length === 0) return { error: "No hay supuestos que revisar." };

  const r = await auditarSupuestos(filas);
  if (r.estado === "ok") return { observaciones: r.observaciones };
  if (r.estado === "descartado") {
    console.error("auditor: salida descartada por la guardia", r.problemas);
    return { error: "La IA respondió con algo que no pasa la revisión (cifras nuevas o veredictos). No se muestra nada." };
  }
  console.error("auditor: error", r.motivo);
  return {
    error:
      r.motivo === "falta ANTHROPIC_API_KEY"
        ? "El auditor de IA no está configurado en este entorno."
        : "No se pudo consultar a la IA. Intenta de nuevo más tarde.",
  };
}
