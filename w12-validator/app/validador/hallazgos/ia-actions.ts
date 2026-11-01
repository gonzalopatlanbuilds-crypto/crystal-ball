"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { observarHallazgo, type HallazgoParaIA } from "@/lib/lector-ia";

export type ObservacionState = undefined | { observacion: string } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Endpoint del lector de IA: solo con sesión y organización, solo en el
// servidor. Recibe únicamente el id del hallazgo y lo lee con RLS: el
// navegador no puede mandarle a la IA otro contenido. La observación no se
// guarda y nunca toca el estado del hallazgo. Los errores que ve el
// usuario son genéricos; el detalle (nunca la llave) solo va al log.
export async function pedirObservacionIA(findingId: string): Promise<ObservacionState> {
  if (typeof findingId !== "string" || !UUID.test(findingId)) return { error: "Hallazgo inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: h, error } = await supabase
    .from("findings")
    .select("type, sku, supplier, details")
    .eq("id", findingId)
    .maybeSingle<HallazgoParaIA>();
  if (error) {
    console.error("lector IA: no se pudo leer el hallazgo", error);
    return { error: "No se pudo leer el hallazgo. Intenta de nuevo." };
  }
  if (!h) return { error: "Hallazgo no encontrado." };

  // Se registra ANTES de llamar a la API: un intento fallido también cuenta
  // (si no, alguien podría forzar errores para llamar sin límite).
  const { data: permitido, error: errorLimite } = await supabase.rpc("registrar_llamada_lector");
  if (errorLimite) {
    console.error("lector IA: registrar_llamada_lector falló", errorLimite);
    return { error: "No se pudo consultar a la IA. Intenta de nuevo más tarde." };
  }
  if (permitido !== true) {
    return { error: "Llegaste al límite de consultas a la IA (10 por hora por persona, 30 por día por organización). Intenta más tarde." };
  }

  const r = await observarHallazgo(h);
  if (r.estado === "ok") return { observacion: r.observacion };
  if (r.estado === "descartado") {
    console.error("lector IA: salida descartada por la guardia", r.problemas);
    return { error: "La IA respondió con algo que no pasa la revisión (veredictos o cifras nuevas). No se muestra nada." };
  }
  console.error("lector IA: error", r.motivo);
  return {
    error:
      r.motivo === "falta ANTHROPIC_API_KEY"
        ? "La observación de IA no está configurada en este entorno."
        : "No se pudo consultar a la IA. Intenta de nuevo más tarde.",
  };
}
