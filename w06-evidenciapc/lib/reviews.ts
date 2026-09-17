import { z } from "zod";

export const RECHAZO_MOTIVO_MAX_LARGO = 1000;

const idsSchema = {
  closureId: z.string().trim().uuid("Cierre inválido."),
  findingId: z.string().trim().uuid("Hallazgo inválido."),
};

export const aprobacionSchema = z.object(idsSchema);

export const rechazoSchema = z.object({
  ...idsSchema,
  reason: z
    .string()
    .trim()
    .min(1, "Escribe el motivo del rechazo.")
    .max(RECHAZO_MOTIVO_MAX_LARGO, `Máximo ${RECHAZO_MOTIVO_MAX_LARGO} caracteres.`),
});

export type ParseResult<T> = { success: true; data: T } | { success: false; error: string };

export function parseAprobacionForm(formData: FormData): ParseResult<z.infer<typeof aprobacionSchema>> {
  const result = aprobacionSchema.safeParse({
    closureId: formData.get("closure_id"),
    findingId: formData.get("finding_id"),
  });
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { success: true, data: result.data };
}

export function parseRechazoForm(formData: FormData): ParseResult<z.infer<typeof rechazoSchema>> {
  const result = rechazoSchema.safeParse({
    closureId: formData.get("closure_id"),
    findingId: formData.get("finding_id"),
    reason: formData.get("reason"),
  });
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { success: true, data: result.data };
}
