"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseClosureForm, esCierreMismoDia, FOTO_MAX_BYTES } from "@/lib/closures";
import { analizarEvidenciaCierre } from "@/lib/vision";
import { rutaEvidencia, subirEvidencia } from "@/lib/storage";
import { etiquetaEscenario } from "@/lib/findings";

export type ClosureFormState = { error: string } | undefined;

const TIPOS_IMAGEN_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface FindingRow {
  org_id: string;
  owner_id: string;
  status: string;
  created_at: string;
  scenario_label: string;
  description: string;
  corrective_action: string;
}

export async function enviarCierre(
  _prevState: ClosureFormState,
  formData: FormData
): Promise<ClosureFormState> {
  const parsed = parseClosureForm(formData);
  if (!parsed.success) {
    return { error: parsed.error };
  }

  // La foto es obligatoria — se valida aquí, server-side, antes de tocar
  // Storage o la base. El `required` del <input type="file"> en el
  // formulario es solo UX; esta es la validación real.
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Sube una foto de evidencia del cierre." };
  }
  if (!TIPOS_IMAGEN_PERMITIDOS.includes(photo.type)) {
    return { error: "La evidencia debe ser una imagen (jpg, png, webp o gif)." };
  }
  if (photo.size > FOTO_MAX_BYTES) {
    return { error: "La imagen es demasiado grande (máximo 8 MB)." };
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
    .select("org_id, owner_id, status, created_at, scenario_label, description, corrective_action")
    .eq("id", parsed.data.findingId)
    .maybeSingle<FindingRow>();

  if (!finding) {
    return { error: "Hallazgo no encontrado." };
  }
  // Defensa en profundidad: la policy de insert de `closures` ya exige lo
  // mismo (owner + status abierto/rechazado) — este chequeo solo da un
  // mensaje de error legible en vez de un error genérico de Postgres.
  if (finding.owner_id !== user.id) {
    return { error: "Solo el owner asignado puede cerrar este hallazgo." };
  }
  if (finding.status !== "open" && finding.status !== "rejected") {
    return { error: "Este hallazgo no está abierto para cierre." };
  }

  const closureId = crypto.randomUUID();
  const photoBytes = await photo.arrayBuffer();
  const path = rutaEvidencia(finding.org_id, parsed.data.findingId, closureId, photo.type);

  const { error: uploadError } = await subirEvidencia(supabase, path, photoBytes, photo.type);
  if (uploadError) {
    console.error("enviarCierre: subida a Storage falló", uploadError);
    return { error: "No se pudo subir la foto. Intenta de nuevo." };
  }

  const mismoDia = esCierreMismoDia(finding.created_at, new Date());

  // La nota de IA es asistiva, nunca bloqueante: si la llamada falla, el
  // cierre se guarda igual, solo sin nota.
  let aiNote: string | null = null;
  try {
    const photoBase64 = Buffer.from(photoBytes).toString("base64");
    const analisis = await analizarEvidenciaCierre({
      scenarioLabel: etiquetaEscenario(finding.scenario_label),
      description: finding.description,
      correctiveAction: finding.corrective_action,
      closureDescription: parsed.data.description,
      photoBase64,
      mediaType: photo.type,
    });
    aiNote = analisis.note;
  } catch (err) {
    console.error("enviarCierre: análisis de visión falló, se sigue sin nota", err);
  }

  const { error: insertError } = await supabase.from("closures").insert({
    id: closureId,
    finding_id: parsed.data.findingId,
    org_id: finding.org_id,
    closed_by: user.id,
    photo_path: path,
    description: parsed.data.description,
    same_day_flag: mismoDia,
    ai_note: aiNote,
  });
  if (insertError) {
    console.error("enviarCierre: insert en closures falló", insertError);
    return { error: "No se pudo guardar el cierre. Intenta de nuevo." };
  }

  const { error: updateError } = await supabase
    .from("findings")
    .update({ status: "pending_review" })
    .eq("id", parsed.data.findingId);
  if (updateError) {
    console.error("enviarCierre: transición a pending_review falló", updateError);
    return {
      error: "El cierre se guardó, pero no se pudo actualizar el estado del hallazgo.",
    };
  }

  redirect(`/findings/${parsed.data.findingId}`);
}
