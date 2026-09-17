import { z } from "zod";

export const CIERRE_DESCRIPCION_MAX_LARGO = 1000;
export const FOTO_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export const AI_LABEL = "Análisis asistido por IA — apoyo, no veredicto";

export const closureInputSchema = z.object({
  findingId: z.string().trim().uuid("Hallazgo inválido."),
  description: z
    .string()
    .trim()
    .min(1, "Describe brevemente cómo quedó resuelto el hallazgo.")
    .max(CIERRE_DESCRIPCION_MAX_LARGO, `Máximo ${CIERRE_DESCRIPCION_MAX_LARGO} caracteres.`),
});

export type ClosureInput = z.infer<typeof closureInputSchema>;

export type ParseClosureResult =
  | { success: true; data: ClosureInput }
  | { success: false; error: string };

export function parseClosureForm(formData: FormData): ParseClosureResult {
  const result = closureInputSchema.safeParse({
    findingId: formData.get("finding_id"),
    description: formData.get("description"),
  });
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { success: true, data: result.data };
}

// Regla determinista, no un modelo: "mismo día" se compara en la zona
// horaria de la escuela (CDMX), no en UTC — un cierre capturado a las
// 11pm y un hallazgo logueado a la 1am del mismo día calendario local
// deben contar como mismo día, aunque en UTC caigan en fechas distintas.
const ZONA_HORARIA = "America/Mexico_City";

function fechaLocal(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA }).format(fecha);
}

export function esCierreMismoDia(findingCreatedAt: string | Date, closureCreatedAt: Date): boolean {
  const inicio = typeof findingCreatedAt === "string" ? new Date(findingCreatedAt) : findingCreatedAt;
  return fechaLocal(inicio) === fechaLocal(closureCreatedAt);
}
