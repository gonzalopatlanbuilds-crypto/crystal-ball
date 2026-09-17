import { z } from "zod";

// El join_code real lo genera sql/schema.sql (generar_join_code(), dentro
// de create_org()) — este archivo solo valida forma, nunca genera el
// código, para que exista una sola fuente de verdad de qué códigos son
// válidos (la base, no el cliente).
export const JOIN_CODE_REGEX = /^[A-Z2-9]{3}-?[A-Z2-9]{3}$/;
export const ORG_NAME_MAX_LARGO = 120;

export function normalizarJoinCode(valor: string): string {
  const limpio = valor.trim().toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z2-9]{6}$/.test(limpio)) {
    return `${limpio.slice(0, 3)}-${limpio.slice(3)}`;
  }
  return limpio;
}

export const crearOrgSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de tu escuela u organización.")
    .max(ORG_NAME_MAX_LARGO, `Máximo ${ORG_NAME_MAX_LARGO} caracteres.`),
});

export const unirseOrgSchema = z.object({
  joinCode: z
    .string()
    .transform(normalizarJoinCode)
    .refine((v) => JOIN_CODE_REGEX.test(v), "El código debe verse como ABC-234."),
});
