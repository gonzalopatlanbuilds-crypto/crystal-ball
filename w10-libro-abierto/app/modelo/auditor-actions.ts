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
//
// Límite de frecuencia (bug de la prueba mecánica, commit 7): antes no
// había ninguno y cada llamada se cobra a la llave del proyecto. Lo aplica
// la base (registrar_llamada_auditor): 10 por hora por persona, 30 por día
// por organización. Los errores que ve el usuario son genéricos; el
// detalle (nunca la llave) solo va al log del servidor.
export async function pedirObservacionesIA(): Promise<AuditorState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/onboarding");

  // Se registra ANTES de llamar a la API: un intento fallido también cuenta
  // (si no, alguien podría forzar errores para llamar sin límite).
  const { data: permitido, error: errorLimite } = await supabase.rpc("registrar_llamada_auditor");
  if (errorLimite) {
    console.error("auditor: registrar_llamada_auditor falló", errorLimite);
    return { error: "No se pudo consultar a la IA. Intenta de nuevo más tarde." };
  }
  if (permitido !== true) {
    return { error: "Llegaste al límite de consultas al auditor (10 por hora por persona, 30 por día por equipo). Intenta más tarde." };
  }

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
