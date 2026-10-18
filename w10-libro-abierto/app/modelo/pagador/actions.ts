"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validarEvidencia, type ErroresEvidencia, type ValoresEvidencia } from "@/lib/pagador";

export type EvidenciaState =
  | { errores: ErroresEvidencia; valores: ValoresEvidencia; mensaje?: string; ok?: boolean }
  | undefined;

const VACIO: ValoresEvidencia = { kind: "", description: "", document_ref: "", recorded_on: "" };

export async function registrarEvidencia(_prev: EvidenciaState, formData: FormData): Promise<EvidenciaState> {
  const leer = (k: string) => String(formData.get(k) ?? "");
  const valores: ValoresEvidencia = {
    kind: leer("kind"),
    description: leer("description"),
    document_ref: leer("document_ref"),
    recorded_on: leer("recorded_on"),
  };

  const resultado = validarEvidencia(valores);
  if (!resultado.ok) return { errores: resultado.errores, valores };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle<{ org_id: string }>();
  if (!profile) redirect("/onboarding");

  // recorded_by NO se manda: lo pone la base (default auth.uid()) y el
  // cliente no tiene permiso de escribir esa columna.
  const { error } = await supabase.from("payer_evidence").insert({ org_id: profile.org_id, ...resultado.datos });
  if (error) {
    console.error("registrarEvidencia: insert falló", error);
    return { errores: {}, valores, mensaje: "No se pudo registrar. Intenta de nuevo." };
  }

  revalidatePath("/modelo", "layout");
  return { errores: {}, valores: VACIO, ok: true };
}
