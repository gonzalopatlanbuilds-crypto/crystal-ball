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
  discarded: "Descartar no cambia ningún dato: solo registra que esta discrepancia no aplica.",
};

// Lo que pasa APARTE de la decisión, como consecuencia del propio dato
// (regla de la Feature 3). Va separado de SIGNIFICADO_DECISION para que no
// se lea como algo que el revisor "activa" al descartar.
export const CONSECUENCIA_DESCARTE =
  "Aparte, y de forma automática: cuando todos los hallazgos de esa fila (este SKU con este proveedor, en esta carga) quedan descartados, sus valores se vuelven la evidencia aceptada contra la que se comparan las cargas siguientes. No lo activa esta decisión por sí sola: depende de que ninguno de esos hallazgos siga pendiente o confirmado.";

export const HISTORIAL_DECISION: Record<Decision, string> = {
  confirmed: "Confirmó la discrepancia",
  discarded: "Descartó el hallazgo",
};

// `\S`: al menos un carácter que no sea espacio, salto de línea o tab (el
// mismo criterio que la base).
export const decisionSchema = z.object({
  findingId: z.string().uuid("Hallazgo inválido."),
  decision: z.enum(["confirmed", "discarded"], { message: "Elige confirmar o descartar." }),
  // Sin caracteres de formato invisibles (ancho cero, marcas de dirección)
  // y con al menos una letra o un dígito: una nota de puros espacios raros o
  // invisibles se veía vacía y pasaba `trim()` + `\S` (bug de la prueba
  // mecánica, encontrado con la sesión real contra el proyecto).
  note: z
    .string({ message: "La nota es obligatoria." })
    .transform((v) => v.replace(/\p{Cf}/gu, "").trim())
    .refine((v) => /[\p{L}\p{N}]/u.test(v), "La nota es obligatoria: escribe por qué confirmas o descartas.")
    .refine((v) => v.length <= NOTA_MAX, `La nota tiene más de ${NOTA_MAX} caracteres.`),
});

// ¿La nota tiene algo que leer? Las decisiones guardadas antes del arreglo
// de la prueba mecánica pueden tener notas invisibles (la tabla es
// append-only): la página las marca en vez de mostrar un hueco.
export function notaVisible(nota: string): boolean {
  return /[\p{L}\p{N}]/u.test(nota.replace(/\p{Cf}/gu, ""));
}

// Diferencia del valor nuevo respecto al anterior, con signo y un decimal
// ("+34.6%"). La calcula el código, nunca la IA. null si no se puede
// calcular (anterior 0).
export function diferenciaPorcentual(anterior: number, nuevo: number): string | null {
  if (!Number.isFinite(anterior) || !Number.isFinite(nuevo) || anterior === 0) return null;
  const p = ((nuevo - anterior) / anterior) * 100;
  const redondeado = Math.round(p * 10) / 10;
  return `${redondeado > 0 ? "+" : ""}${redondeado.toFixed(1)}%`;
}
