"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { parseConsultaForm } from "@/lib/consulta";
import { excedeLimite } from "@/lib/rateLimit";
import { calcularRiesgo } from "@/lib/scoring";
import type { RangoEdadValue, SintomaValue } from "@/lib/screenings";

export interface ResultadoConsulta {
  folio: string;
  patientFirstName: string;
  glucoseMgdl: number;
  createdAt: string;
  riesgo: { score: number; nivel: "alto" | "bajo"; motivos: string[] };
}

export type ConsultaFormState =
  | { status: "error"; error: string }
  | { status: "encontrado"; resultado: ResultadoConsulta }
  | undefined;

interface ConsultarTamizajeRow {
  folio: string;
  patient_first_name: string;
  glucose_mgdl: number;
  family_history: boolean;
  symptoms: SintomaValue[];
  age_band: RangoEdadValue;
  created_at: string;
}

// Mismo mensaje sin importar si el folio no existe o si existe pero el
// apellido no coincide — distinguir esos dos casos es exactamente lo que
// permitiría enumerar folios válidos probando apellidos al azar.
const MENSAJE_NO_ENCONTRADO =
  "No encontramos ese resultado. Verifica tu folio y tu apellido e intenta de nuevo.";

export async function buscarTamizaje(
  _prevState: ConsultaFormState,
  formData: FormData
): Promise<ConsultaFormState> {
  const parsed = parseConsultaForm(formData);
  if (!parsed.success) {
    return { status: "error", error: parsed.error };
  }

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (excedeLimite(`consulta:${ip}`)) {
    return {
      status: "error",
      error: "Demasiados intentos. Espera un minuto e intenta de nuevo.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consultar_tamizaje", {
    p_folio: parsed.data.folio,
    p_apellido: parsed.data.apellido,
  });

  if (error) {
    // Nunca se le muestra el error real a un visitante sin login — pero
    // sin loggearlo server-side, un fallo real (ej. la función no existe
    // todavía en Supabase) es indistinguible de un folio equivocado.
    console.error("buscarTamizaje: rpc consultar_tamizaje falló", error);
    return { status: "error", error: MENSAJE_NO_ENCONTRADO };
  }

  const fila = (data as ConsultarTamizajeRow[] | null)?.[0];
  if (!fila) {
    return { status: "error", error: MENSAJE_NO_ENCONTRADO };
  }

  const riesgo = calcularRiesgo({
    glucoseMgdl: fila.glucose_mgdl,
    familyHistory: fila.family_history,
    symptoms: fila.symptoms,
    ageBand: fila.age_band,
  });

  return {
    status: "encontrado",
    resultado: {
      folio: fila.folio,
      patientFirstName: fila.patient_first_name,
      glucoseMgdl: fila.glucose_mgdl,
      createdAt: fila.created_at,
      riesgo,
    },
  };
}
