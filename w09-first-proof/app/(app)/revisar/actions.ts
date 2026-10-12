"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { leerObservaciones } from "@/lib/expediente";
import { validarRevision, type ErroresRevision } from "@/lib/validacion-revision";

export type RevisionState = { errores: ErroresRevision; mensaje?: string } | undefined;

export async function enviarRevision(
  submissionId: string,
  _prev: RevisionState,
  formData: FormData
): Promise<RevisionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Chequeo amistoso: el trigger de la base ya rechaza revisor = candidato,
  // pero aquí se avisa con un mensaje claro. RLS deja ver solo entregas
  // propias, así que si esta consulta la encuentra, es tuya.
  const { data: propia } = await supabase.from("submissions").select("id").eq("id", submissionId).maybeSingle();
  if (propia) {
    return { errores: {}, mensaje: "No puedes revisar tu propia entrega. Pide a otra persona del piloto que la revise." };
  }

  // Las observaciones salen de la base (lectura ciega), nunca del formulario.
  const { data: filas, error: errLectura } = await supabase.rpc("blind_submission", { p_id: submissionId });
  const entrega = (filas as unknown as { ai_observations: unknown; status: string }[] | null)?.[0];
  if (errLectura || !entrega || entrega.status !== "pending_review") {
    return { errores: {}, mensaje: "Esta entrega ya no está disponible para revisión." };
  }

  const ids = (leerObservaciones(entrega.ai_observations) ?? []).map((o) => o.id);
  const decisiones: Record<string, string> = {};
  const motivos: Record<string, string> = {};
  for (const id of ids) {
    decisiones[id] = String(formData.get(`decision_${id}`) ?? "");
    motivos[id] = String(formData.get(`motivo_${id}`) ?? "");
  }

  const r = validarRevision({
    idsObservaciones: ids,
    decisiones,
    motivos,
    conflictoTipo: String(formData.get("conflicto_tipo") ?? ""),
    conflictoTexto: String(formData.get("conflicto_texto") ?? ""),
    recomendacion: String(formData.get("recomendacion") ?? ""),
    nota: String(formData.get("nota") ?? ""),
  });
  if (!r.ok) return { errores: r.errores };

  const { error } = await supabase.rpc("submit_review", {
    p_submission_id: submissionId,
    p_observation_decisions: r.datos.decisiones,
    p_conflict_declaration: r.datos.conflicto,
    p_recommendation: r.datos.recomendacion,
    p_note: r.datos.nota,
  });
  if (error) {
    console.error("enviarRevision: submit_review falló", error);
    return {
      errores: {},
      mensaje: /propia entrega/.test(error.message)
        ? "No puedes revisar tu propia entrega."
        : "No se pudo guardar la revisión. Puede que otra persona ya la haya revisado.",
    };
  }

  redirect(`/revisar/${submissionId}`);
}
