"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  redirect(`/entregas/${data.id}`);
}
