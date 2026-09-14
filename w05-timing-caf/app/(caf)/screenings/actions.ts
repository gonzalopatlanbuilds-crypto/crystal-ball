"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseScreeningForm } from "@/lib/screenings";
import { calcularRiesgo, generarFolio } from "@/lib/scoring";

export type ScreeningFormState = { error: string } | undefined;

const INTENTOS_FOLIO = 5;

export async function crearTamizaje(
  _prevState: ScreeningFormState,
  formData: FormData
): Promise<ScreeningFormState> {
  const parsed = parseScreeningForm(formData);
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

  // El score y el nivel de riesgo no se guardan en la fila: se recalculan
  // siempre a partir de los insumos crudos (ver sql/schema.sql). Aquí solo
  // se calculan para validar que los datos capturados son razonables antes
  // de insertar.
  calcularRiesgo({
    glucoseMgdl: parsed.data.glucoseMgdl,
    familyHistory: parsed.data.familyHistory,
    symptoms: parsed.data.symptoms,
    ageBand: parsed.data.ageBand,
  });

  let screeningId: string | null = null;
  for (let intento = 0; intento < INTENTOS_FOLIO; intento++) {
    const folio = generarFolio();
    const { data, error } = await supabase
      .from("screenings")
      .insert({
        operator_id: user.id,
        folio,
        patient_first_name: parsed.data.patientFirstName,
        patient_last_name: parsed.data.patientLastName,
        patient_phone: parsed.data.patientPhone || null,
        glucose_mgdl: parsed.data.glucoseMgdl,
        family_history: parsed.data.familyHistory,
        symptoms: parsed.data.symptoms,
        age_band: parsed.data.ageBand,
      })
      .select("id")
      .single();

    if (!error) {
      screeningId = data.id;
      break;
    }

    // 23505 = unique_violation — folio ya existe, reintenta con uno nuevo.
    if (error.code !== "23505") {
      console.error("crearTamizaje: insert en screenings falló", error);
      return { error: "No se pudo guardar el tamizaje. Intenta de nuevo." };
    }
  }

  if (!screeningId) {
    return { error: "No se pudo generar un folio único. Intenta de nuevo." };
  }

  redirect(`/screenings/${screeningId}`);
}
