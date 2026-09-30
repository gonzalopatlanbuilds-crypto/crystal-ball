"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CASE_TYPES } from "@/lib/casos";
import { registroTiempoSchema } from "@/lib/tiempo";

export type CrearCasoState = { error: string } | undefined;

type CampoTiempo = "phase" | "staffName" | "minutes" | "hourlyRate";
export type ErroresTiempo = Partial<Record<CampoTiempo, string>>;

// `valores` regresa lo que se capturó: React 19 resetea el <form> después
// de cada action, así que sin esto un error de validación borraría todo
// lo que la persona escribió.
export type ValoresTiempo = Record<"phase" | "staffName" | "minutes" | "hourlyRate", string>;

export type RegistroTiempoState =
  | { fieldErrors: ErroresTiempo; error?: string; valores: ValoresTiempo }
  | { ok: true }
  | undefined;

// org_id nunca viene del formulario: se lee del perfil de quien está en
// sesión. La policy de insert vuelve a exigir org_id = my_org_id(), así
// que aunque alguien mande otro org_id a mano, la base lo rechaza.
async function contextoSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle<{ org_id: string }>();

  if (error) {
    console.error("contextoSesion: no se pudo leer el perfil", error);
  }
  if (!profile) {
    redirect("/onboarding");
  }

  return { supabase, userId: user.id, orgId: profile.org_id };
}

const crearCasoSchema = z.object({
  caseType: z.enum(CASE_TYPES, { errorMap: () => ({ message: "Elige un tipo de caso." }) }),
});

export async function crearCaso(
  _prevState: CrearCasoState,
  formData: FormData
): Promise<CrearCasoState> {
  const parsed = crearCasoSchema.safeParse({ caseType: formData.get("case_type") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const { supabase, userId, orgId } = await contextoSesion();

  const { data, error } = await supabase
    .from("cases")
    .insert({ org_id: orgId, case_type: parsed.data.caseType, created_by: userId })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("crearCaso: insert falló", error);
    return { error: "No se pudo crear el caso. Intenta de nuevo." };
  }

  revalidatePath("/dashboard");
  redirect(`/cases/${data.id}`);
}

export async function registrarTiempo(
  _prevState: RegistroTiempoState,
  formData: FormData
): Promise<RegistroTiempoState> {
  const texto = (campo: string) => {
    const v = formData.get(campo);
    return typeof v === "string" ? v : "";
  };
  const valores: ValoresTiempo = {
    phase: texto("phase"),
    staffName: texto("staff_name"),
    minutes: texto("minutes"),
    hourlyRate: texto("hourly_rate"),
  };
  const parsed = registroTiempoSchema.safeParse({ caseId: texto("case_id"), ...valores });

  if (!parsed.success) {
    const fieldErrors: ErroresTiempo = {};
    for (const issue of parsed.error.issues) {
      const campo = issue.path[0];
      if (
        (campo === "phase" || campo === "staffName" || campo === "minutes" || campo === "hourlyRate") &&
        !fieldErrors[campo]
      ) {
        fieldErrors[campo] = issue.message;
      }
    }
    const errorCaso = parsed.error.issues.find((i) => i.path[0] === "caseId");
    return { fieldErrors, error: errorCaso?.message, valores };
  }

  const { supabase, userId, orgId } = await contextoSesion();
  const { caseId, phase, staffName, minutes, hourlyRate } = parsed.data;

  const { error } = await supabase.from("case_time_logs").insert({
    org_id: orgId,
    case_id: caseId,
    phase,
    staff_name: staffName,
    minutes,
    hourly_rate_mxn: hourlyRate,
    logged_by: userId,
  });

  if (error) {
    console.error("registrarTiempo: insert falló", error);
    return { fieldErrors: {}, error: "No se pudo guardar el registro. Intenta de nuevo.", valores };
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function borrarEntrada(formData: FormData): Promise<void> {
  const ids = z
    .object({ entryId: z.string().uuid(), caseId: z.string().uuid() })
    .safeParse({ entryId: formData.get("entry_id"), caseId: formData.get("case_id") });
  if (!ids.success) {
    return;
  }

  const { supabase } = await contextoSesion();
  // La policy de delete solo deja borrar entradas propias de la propia
  // org; si no aplica, Postgres borra 0 filas sin error — no hay nada que
  // mostrar distinto, la entrada simplemente sigue ahí.
  const { error } = await supabase.from("case_time_logs").delete().eq("id", ids.data.entryId);
  if (error) {
    console.error("borrarEntrada: delete falló", error);
  }

  revalidatePath(`/cases/${ids.data.caseId}`);
  revalidatePath("/dashboard");
}
