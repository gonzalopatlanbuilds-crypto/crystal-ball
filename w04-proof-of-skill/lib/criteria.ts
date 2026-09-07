import { z } from "zod";

export const PESO_MIN = 0;
export const PESO_MAX = 100;
export const ETIQUETA_MAX_LARGO = 80;
export const ROL_MAX_LARGO = 120;
export const MINIMO_CRITERIOS = 3;
export const SUMA_PESOS_REQUERIDA = 100;

export const criterioSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Escribe una etiqueta para este criterio.")
    .max(ETIQUETA_MAX_LARGO, `Máximo ${ETIQUETA_MAX_LARGO} caracteres.`),
  weight: z.coerce
    .number({ invalid_type_error: "El peso debe ser un número." })
    .int("El peso debe ser un número entero.")
    .min(PESO_MIN, `El peso mínimo es ${PESO_MIN}.`)
    .max(PESO_MAX, `El peso máximo es ${PESO_MAX}.`),
});

export const criteriaSetInputSchema = z
  .object({
    roleName: z
      .string()
      .trim()
      .min(1, "Escribe el nombre del rol.")
      .max(ROL_MAX_LARGO, `Máximo ${ROL_MAX_LARGO} caracteres.`),
    criteria: z
      .array(criterioSchema)
      .min(MINIMO_CRITERIOS, `Agrega al menos ${MINIMO_CRITERIOS} criterios.`),
  })
  .superRefine((data, ctx) => {
    // Si ya falta el mínimo de criterios, ese error basta — no hace falta
    // sumar pesos de una lista que de todos modos está incompleta.
    if (data.criteria.length < MINIMO_CRITERIOS) return;

    const suma = data.criteria.reduce((acc, c) => acc + c.weight, 0);
    if (suma !== SUMA_PESOS_REQUERIDA) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["criteria"],
        message:
          suma < SUMA_PESOS_REQUERIDA
            ? `La suma de los pesos es ${suma}% — te faltan ${SUMA_PESOS_REQUERIDA - suma}% para llegar a ${SUMA_PESOS_REQUERIDA}%.`
            : `La suma de los pesos es ${suma}% — sobran ${suma - SUMA_PESOS_REQUERIDA}%. El score ponderado solo es interpretable si suman exactamente ${SUMA_PESOS_REQUERIDA}%.`,
      });
    }
  });

export type Criterio = z.infer<typeof criterioSchema>;
export type CriteriaSetInput = z.infer<typeof criteriaSetInputSchema>;

export type ParseCriteriaSetResult =
  | { success: true; data: CriteriaSetInput }
  | { success: false; error: string };

export function parseCriteriaSetForm(formData: FormData): ParseCriteriaSetResult {
  const roleName = formData.get("role_name");
  const criteriaRaw = formData.get("criteria");

  let criteriaJson: unknown;
  try {
    criteriaJson = JSON.parse(typeof criteriaRaw === "string" ? criteriaRaw : "[]");
  } catch {
    return { success: false, error: "Los datos de criterios llegaron corruptos. Intenta de nuevo." };
  }

  const result = criteriaSetInputSchema.safeParse({ roleName, criteria: criteriaJson });
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { success: true, data: result.data };
}
