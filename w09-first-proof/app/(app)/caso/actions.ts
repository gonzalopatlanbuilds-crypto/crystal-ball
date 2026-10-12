"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepararObservaciones } from "@/lib/observaciones";
import { validarEntrega, type ErroresEntrega, type ValoresEntrega } from "@/lib/validacion";

export type EntregaState =
  | { errores: ErroresEntrega; valores: ValoresEntrega; mensaje?: string }
  | undefined;

export async function enviarEntrega(
  _prev: EntregaState,
  formData: FormData
): Promise<EntregaState> {
  // Se regresan tal cual al formulario si algo falla: el candidato no
  // pierde lo que escribió (criterio de aceptación de la Feature 2).
  const valores: ValoresEntrega = {
    growth: String(formData.get("growth") ?? ""),
    margin: String(formData.get("margin") ?? ""),
    dso: String(formData.get("dso") ?? ""),
    explanation: String(formData.get("explanation") ?? ""),
  };

  const resultado = validarEntrega(valores);
  if (!resultado.ok) {
    return { errores: resultado.errores, valores };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle<{ org_id: string }>();
  if (!profile) {
    redirect("/onboarding");
  }

  // Seudónimo y status los pone el trigger de la base; el cliente no tiene
  // permiso de escribirlos (ver sql/schema.sql).
  const { data, error } = await supabase
    .from("submissions")
    .insert({ org_id: profile.org_id, candidate_id: user.id, ...resultado.datos })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("enviarEntrega: insert falló", error);
    return {
      errores: {},
      valores,
      mensaje: "No se pudo enviar tu entrega. Intenta de nuevo.",
    };
  }

  await guardarObservaciones(data.id, user.id, resultado.datos.explanation);

  redirect(`/entregas/${data.id}`);
}

// Feature 3. Nunca hace fallar la entrega: si la IA no responde o su texto
// no pasa la guardia, la entrega queda sin observaciones y la revisión
// humana sigue igual. Todo se registra en el log del servidor (el texto
// rechazado incluido, para poder ajustar el prompt), nada se le muestra al
// candidato.
async function guardarObservaciones(submissionId: string, candidateId: string, explicacion: string) {
  const admin = createAdminClient();
  if (!admin) {
    console.error("guardarObservaciones: falta SUPABASE_SERVICE_ROLE_KEY; la entrega queda sin observaciones");
    return;
  }

  const res = await prepararObservaciones(explicacion);
  if (res.estado === "error") {
    console.error("guardarObservaciones: la IA falló", res.motivo);
    return;
  }
  if (res.estado === "descartado") {
    console.error("guardarObservaciones: la guardia descartó todas las salidas", res.problemas, JSON.stringify(res.salidas));
    return;
  }

  // Solo esta entrega, solo si es de quien acaba de enviarla y solo si aún
  // no tiene observaciones: la service role se salta RLS, así que los
  // filtros van explícitos.
  const { error } = await admin
    .from("submissions")
    .update({ ai_observations: res.observaciones })
    .eq("id", submissionId)
    .eq("candidate_id", candidateId)
    .is("ai_observations", null);
  if (error) console.error("guardarObservaciones: no se pudieron guardar", error);
}
