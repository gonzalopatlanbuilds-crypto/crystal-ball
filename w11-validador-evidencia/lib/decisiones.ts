// Decisiones humanas sobre un hallazgo. Lógica pura: la usa la server
// action y la prueba con `node` (npm run test:logica). La base vuelve a
// exigir la nota (registrar_decision y el check de la tabla).
import { z } from "zod";

export const NOTA_MAX = 1000;

export type Decision = "confirmed" | "discarded";

// Textos de los botones, como el mockup, y qué significa cada uno para la
// evidencia aceptada (la regla de la Feature 3).
export const ETIQUETA_DECISION: Record<Decision, string> = {
  confirmed: "Confirmar discrepancia",
  discarded: "Descartar (error)",
};

export const SIGNIFICADO_DECISION: Record<Decision, string> = {
  confirmed: "La discrepancia es real: el valor nuevo NO pasa a ser la referencia.",
  discarded: "No es un problema: si todos los hallazgos de esa fila se descartan, el valor nuevo pasa a ser la referencia.",
};

export const HISTORIAL_DECISION: Record<Decision, string> = {
  confirmed: "Confirmó la discrepancia",
  discarded: "Descartó el hallazgo",
};

// `\S`: al menos un carácter que no sea espacio, salto de línea o tab (el
// mismo criterio que la base).
export const decisionSchema = z.object({
  findingId: z.string().uuid("Hallazgo inválido."),
  decision: z.enum(["confirmed", "discarded"], { message: "Elige confirmar o descartar." }),
  note: z
    .string({ message: "La nota es obligatoria." })
    .transform((v) => v.trim())
    .refine((v) => /\S/.test(v), "La nota es obligatoria: escribe por qué confirmas o descartas.")
    .refine((v) => v.length <= NOTA_MAX, `La nota tiene más de ${NOTA_MAX} caracteres.`),
});

// Diferencia del valor nuevo respecto al anterior, con signo y un decimal
// ("+34.6%"). La calcula el código, nunca la IA. null si no se puede
// calcular (anterior 0).
export function diferenciaPorcentual(anterior: number, nuevo: number): string | null {
  if (!Number.isFinite(anterior) || !Number.isFinite(nuevo) || anterior === 0) return null;
  const p = ((nuevo - anterior) / anterior) * 100;
  const redondeado = Math.round(p * 10) / 10;
  return `${redondeado > 0 ? "+" : ""}${redondeado.toFixed(1)}%`;
}
