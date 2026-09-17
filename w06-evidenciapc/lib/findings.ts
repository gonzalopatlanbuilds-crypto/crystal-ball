import { z } from "zod";

export const DESCRIPCION_MAX_LARGO = 2000;
export const ACCION_MAX_LARGO = 2000;

// Lista cerrada a propósito (en vez de texto libre): "hallazgo ligado a un
// escenario de simulacro, etiquetado" es un requisito del Dragon Stack de
// esta semana — una lista cerrada garantiza que el escenario siempre sea
// una etiqueta reconocible, nunca texto suelto que cada coordinador
// redacta distinto.
export const ESCENARIOS = [
  { value: "sismo_ala_norte", label: "Simulacro de sismo — Ala Norte" },
  { value: "sismo_patio_central", label: "Simulacro de sismo — Patio central" },
  { value: "incendio_laboratorio", label: "Simulacro de incendio — Laboratorio" },
  { value: "incendio_cocina", label: "Simulacro de incendio — Cocina/comedor" },
  { value: "evacuacion_general", label: "Simulacro de evacuación general" },
] as const;

export type EscenarioValue = (typeof ESCENARIOS)[number]["value"];
export const ESCENARIO_VALUES = ESCENARIOS.map((e) => e.value) as [
  EscenarioValue,
  ...EscenarioValue[],
];

export const STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  pending_review: "Cierre en revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const findingInputSchema = z.object({
  scenarioLabel: z.enum(ESCENARIO_VALUES, {
    errorMap: () => ({ message: "Elige el escenario de simulacro." }),
  }),
  description: z
    .string()
    .trim()
    .min(1, "Describe el hallazgo crítico.")
    .max(DESCRIPCION_MAX_LARGO, `Máximo ${DESCRIPCION_MAX_LARGO} caracteres.`),
  correctiveAction: z
    .string()
    .trim()
    .min(1, "Describe la acción correctiva requerida.")
    .max(ACCION_MAX_LARGO, `Máximo ${ACCION_MAX_LARGO} caracteres.`),
  ownerId: z.string().trim().uuid("Elige a quién se le asigna este hallazgo."),
  deadline: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Elige una fecha límite válida."),
});

export type FindingInput = z.infer<typeof findingInputSchema>;

export type ParseFindingResult =
  | { success: true; data: FindingInput }
  | { success: false; error: string };

export function parseFindingForm(formData: FormData): ParseFindingResult {
  const result = findingInputSchema.safeParse({
    scenarioLabel: formData.get("scenario_label"),
    description: formData.get("description"),
    correctiveAction: formData.get("corrective_action"),
    ownerId: formData.get("owner_id"),
    deadline: formData.get("deadline"),
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { success: true, data: result.data };
}

export function etiquetaEscenario(value: string): string {
  return ESCENARIOS.find((e) => e.value === value)?.label ?? value;
}
