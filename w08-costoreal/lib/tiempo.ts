import { z } from "zod";

// Mismos límites que los `check` de case_time_logs en sql/schema.sql — si
// cambian aquí, cambian allá. La base es la última defensa; esto es lo
// que produce el error inline legible.
export const TARIFA_MIN_MXN = 50;
export const TARIFA_MAX_MXN = 2000;
export const MINUTOS_MIN = 1;
export const MINUTOS_MAX = 480;

export const PHASES = ["intake", "triage", "evidence_packet", "follow_up"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABELS: Record<Phase, string> = {
  intake: "Intake (recepción del caso)",
  triage: "Triage (evaluación inicial)",
  evidence_packet: "Generación de paquete de evidencia",
  follow_up: "Seguimiento (24-48h después)",
};

// z.coerce convertiría "" en 0 y "abc" en NaN con mensajes genéricos; se
// parsea a mano para que cada caso tenga un mensaje en español claro.
function numeroDesdeTexto(mensajeVacio: string) {
  return z
    .string()
    .trim()
    .min(1, mensajeVacio)
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v), "Escribe solo un número (ej. 25 o 180.50).")
    .transform(Number);
}

export const registroTiempoSchema = z.object({
  caseId: z.string().uuid("Caso inválido."),
  phase: z.enum(PHASES, { errorMap: () => ({ message: "Elige una fase." }) }),
  staffName: z
    .string()
    .trim()
    .min(1, "Escribe quién hizo el trabajo (nombre inventado).")
    .max(60, "Máximo 60 caracteres."),
  minutes: numeroDesdeTexto("Escribe los minutos invertidos.")
    .refine((n) => n > 0, "Los minutos tienen que ser mayores a cero.")
    .refine((n) => Number.isInteger(n), "Usa minutos enteros (sin decimales).")
    .refine(
      (n) => n <= MINUTOS_MAX,
      `Máximo ${MINUTOS_MAX} minutos (8 h) por entrada — si fue más, divídelo en varias entradas.`
    ),
  // Los decimales se revisan sobre el texto, no con n * 100 — 180.1 * 100
  // da 18009.999999999998 en punto flotante y se rechazaría por error.
  hourlyRate: numeroDesdeTexto("Escribe la tarifa cargada por hora.")
    .refine(
      (n) => n >= TARIFA_MIN_MXN && n <= TARIFA_MAX_MXN,
      `La tarifa cargada tiene que estar entre $${TARIFA_MIN_MXN} y $${TARIFA_MAX_MXN.toLocaleString("es-MX")} MXN/hora.`
    )
    .refine((n) => /^\d+(\.\d{1,2})?$/.test(String(n)), "Máximo dos decimales en la tarifa."),
});
