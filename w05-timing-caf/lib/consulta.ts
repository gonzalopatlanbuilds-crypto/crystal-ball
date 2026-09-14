import { z } from "zod";

export const FOLIO_MAX_LARGO = 16;
export const APELLIDO_CONSULTA_MAX_LARGO = 80;

export const consultaInputSchema = z.object({
  folio: z
    .string()
    .trim()
    .min(1, "Escribe tu folio.")
    .max(FOLIO_MAX_LARGO, "Ese folio no tiene un formato válido."),
  apellido: z
    .string()
    .trim()
    .min(1, "Escribe tu apellido.")
    .max(APELLIDO_CONSULTA_MAX_LARGO, "Ese apellido no tiene un formato válido."),
});

export type ConsultaInput = z.infer<typeof consultaInputSchema>;

export type ParseConsultaResult =
  | { success: true; data: ConsultaInput }
  | { success: false; error: string };

export function parseConsultaForm(formData: FormData): ParseConsultaResult {
  const result = consultaInputSchema.safeParse({
    folio: formData.get("folio"),
    apellido: formData.get("apellido"),
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { success: true, data: result.data };
}
