"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseAprobacionForm, parseRechazoForm } from "@/lib/reviews";

export type ReviewFormState = { error: string } | undefined;

// El mensaje de error que devuelve el trigger de Postgres
// (`closures_verificador_no_es_owner` / `findings_inmutable_tras_aprobacion`,
// ver sql/schema.sql) llega tal cual en `error.message` — se muestra
// directo porque ya está escrito en español simple para el usuario final,
// no es un error interno.

export async function aprobarCierre(
  _prevState: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const parsed = parseAprobacionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: finding } = await supabase
    .from("findings")
    .select("owner_id")
    .eq("id", parsed.data.findingId)
    .maybeSingle<{ owner_id: string }>();

  if (!finding) {
    return { error: "Hallazgo no encontrado." };
  }
  // Defensa en profundidad: la policy de update de `closures` y el
  // trigger `closures_verificador_no_es_owner` ya bloquean esto a nivel
  // de base — este chequeo solo da un mensaje legible antes de intentarlo.
  if (finding.owner_id === user.id) {
    return { error: "No puedes verificar el cierre de un hallazgo que tú mismo cerraste." };
  }

  const { error: closureError } = await supabase
    .from("closures")
    .update({ verifier_id: user.id, decision: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.closureId);
  if (closureError) {
    console.error("aprobarCierre: update en closures falló", closureError);
    return { error: closureError.message || "No se pudo aprobar el cierre." };
  }

  const { error: findingError } = await supabase
    .from("findings")
    .update({ status: "approved" })
    .eq("id", parsed.data.findingId);
  if (findingError) {
    console.error("aprobarCierre: update en findings falló", findingError);
    return { error: findingError.message || "El cierre se aprobó, pero el hallazgo no se pudo cerrar." };
  }

  redirect(`/findings/${parsed.data.findingId}`);
}

export async function rechazarCierre(
  _prevState: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const parsed = parseRechazoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: finding } = await supabase
    .from("findings")
    .select("owner_id")
    .eq("id", parsed.data.findingId)
    .maybeSingle<{ owner_id: string }>();

  if (!finding) {
    return { error: "Hallazgo no encontrado." };
  }
  if (finding.owner_id === user.id) {
    return { error: "No puedes verificar el cierre de un hallazgo que tú mismo cerraste." };
  }

  const { error: closureError } = await supabase
    .from("closures")
    .update({
      verifier_id: user.id,
      decision: "rejected",
      rejection_reason: parsed.data.reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.closureId);
  if (closureError) {
    console.error("rechazarCierre: update en closures falló", closureError);
    return { error: closureError.message || "No se pudo rechazar el cierre." };
  }

  const { error: findingError } = await supabase
    .from("findings")
    .update({ status: "rejected" })
    .eq("id", parsed.data.findingId);
  if (findingError) {
    console.error("rechazarCierre: update en findings falló", findingError);
    return { error: findingError.message || "El cierre se rechazó, pero el hallazgo no se pudo reabrir." };
  }

  redirect(`/findings/${parsed.data.findingId}`);
}
