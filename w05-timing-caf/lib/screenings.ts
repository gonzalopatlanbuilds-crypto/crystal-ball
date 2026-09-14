import { z } from "zod";

export const NOMBRE_MAX_LARGO = 80;
export const APELLIDO_MAX_LARGO = 80;
export const TELEFONO_REGEX = /^\d{10}$/;

// Rango plausible de una lectura de glucosa capilar (mg/dL). Fuera de
// este rango un glucómetro normalmente ya no da un número (marca "LO"/"HI")
// o el dato es clínicamente implausible para un paciente con vida — por
// eso se rechaza, no solo "negativo".
export const GLUCOSA_MIN = 40;
export const GLUCOSA_MAX = 600;

export const SINTOMAS = [
  { value: "sed_excesiva", label: "Sed excesiva" },
  { value: "fatiga_inusual", label: "Fatiga inusual" },
  { value: "vision_borrosa", label: "Visión borrosa" },
  { value: "perdida_peso", label: "Pérdida de peso sin explicación" },
  { value: "hormigueo", label: "Hormigueo en manos o pies" },
] as const;

export type SintomaValue = (typeof SINTOMAS)[number]["value"];
export const SINTOMA_VALUES = SINTOMAS.map((s) => s.value) as [SintomaValue, ...SintomaValue[]];

export const RANGOS_EDAD = [
  { value: "menor_40", label: "Menor de 40 años" },
  { value: "40_59", label: "40 a 59 años" },
  { value: "60_mas", label: "60 años o más" },
] as const;

export type RangoEdadValue = (typeof RANGOS_EDAD)[number]["value"];
export const RANGO_EDAD_VALUES = RANGOS_EDAD.map((r) => r.value) as [
  RangoEdadValue,
  ...RangoEdadValue[],
];

export const screeningInputSchema = z.object({
  patientFirstName: z
    .string()
    .trim()
    .min(1, "Escribe el nombre del paciente.")
    .max(NOMBRE_MAX_LARGO, `Máximo ${NOMBRE_MAX_LARGO} caracteres.`),
  patientLastName: z
    .string()
    .trim()
    .min(1, "Escribe el apellido del paciente — se usa para la consulta pública del folio.")
    .max(APELLIDO_MAX_LARGO, `Máximo ${APELLIDO_MAX_LARGO} caracteres.`),
  patientPhone: z
    .string()
    .trim()
    .regex(TELEFONO_REGEX, "El teléfono es opcional, pero si lo llenas debe tener 10 dígitos.")
    .optional()
    .or(z.literal("")),
  glucoseMgdl: z.coerce
    .number({ invalid_type_error: "La glucosa debe ser un número." })
    .int("La glucosa debe ser un número entero.")
    .min(GLUCOSA_MIN, `El valor mínimo plausible es ${GLUCOSA_MIN} mg/dL.`)
    .max(GLUCOSA_MAX, `El valor máximo plausible es ${GLUCOSA_MAX} mg/dL.`),
  familyHistory: z.boolean(),
  symptoms: z.array(z.enum(SINTOMA_VALUES)),
  ageBand: z.enum(RANGO_EDAD_VALUES),
});

export type ScreeningInput = z.infer<typeof screeningInputSchema>;

export type ParseScreeningResult =
  | { success: true; data: ScreeningInput }
  | { success: false; error: string };

export function parseScreeningForm(formData: FormData): ParseScreeningResult {
  const patientFirstName = formData.get("patient_first_name");
  const patientLastName = formData.get("patient_last_name");
  const patientPhone = formData.get("patient_phone");
  const glucoseMgdl = formData.get("glucose_mgdl");
  const familyHistory = formData.get("family_history") === "on";

  let symptomsJson: unknown;
  try {
    const raw = formData.get("symptoms");
    symptomsJson = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    return { success: false, error: "Los síntomas llegaron corruptos. Intenta de nuevo." };
  }

  const ageBand = formData.get("age_band");

  const result = screeningInputSchema.safeParse({
    patientFirstName,
    patientLastName,
    patientPhone,
    glucoseMgdl,
    familyHistory,
    symptoms: symptomsJson,
    ageBand,
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { success: true, data: result.data };
}
