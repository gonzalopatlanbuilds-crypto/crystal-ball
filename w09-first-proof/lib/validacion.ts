// Validación server-side de la entrega del candidato. Sin imports (excepto
// tipos) para probarla con `node` directo. Los límites son los mismos que
// los `check` de sql/schema.sql: la base es la última línea de defensa.

import type { ClaveCalculo } from "./caso.ts";

export const EXPLICACION_MIN = 80;
export const EXPLICACION_MAX = 800;

export const RANGOS: Record<ClaveCalculo, { min: number; max: number }> = {
  growth: { min: -1000, max: 1000 },
  margin: { min: -1000, max: 1000 },
  dso: { min: 0, max: 3650 },
};

export type ValoresEntrega = Record<ClaveCalculo | "explanation", string>;
export type ErroresEntrega = Partial<Record<ClaveCalculo | "explanation", string>>;

export interface EntregaValida {
  answer_growth: number | null;
  answer_margin: number | null;
  answer_dso: number | null;
  explanation: string;
}

// "10", "10.0", "10,0", "10 %" → 10. En un teléfono en México es normal
// escribir coma decimal; "1,234.5" (coma de miles) no tiene sentido en
// estas respuestas y se rechaza en vez de adivinar.
export function leerNumero(texto: string): { valor: number | null } | { error: string } {
  const limpio = texto.trim().replace(/\s*%$/, "").trim();
  if (limpio === "") return { valor: null };
  if (!/^-?\d+([.,]\d+)?$/.test(limpio)) {
    return { error: "Escribe solo un número, por ejemplo 12.5" };
  }
  const n = Number(limpio.replace(",", "."));
  if (!Number.isFinite(n)) return { error: "Escribe solo un número, por ejemplo 12.5" };
  return { valor: n };
}

// Las respuestas numéricas pueden ir vacías: el chequeo muestra "sin
// respuesta" y el valor correcto, nunca un castigo. La explicación sí es
// obligatoria porque es lo que lee la persona que revisa.
export function validarEntrega(
  valores: ValoresEntrega
): { ok: true; datos: EntregaValida } | { ok: false; errores: ErroresEntrega } {
  const errores: ErroresEntrega = {};
  const numeros: Partial<Record<ClaveCalculo, number | null>> = {};

  for (const clave of Object.keys(RANGOS) as ClaveCalculo[]) {
    const r = leerNumero(valores[clave] ?? "");
    if ("error" in r) {
      errores[clave] = r.error;
      continue;
    }
    const { min, max } = RANGOS[clave];
    if (r.valor !== null && (r.valor < min || r.valor > max)) {
      errores[clave] = `Debe estar entre ${min} y ${max}.`;
      continue;
    }
    // La base guarda numeric(9, 2): se redondea aquí para que lo que se
    // chequea sea exactamente lo que queda guardado.
    numeros[clave] = r.valor === null ? null : Math.round(r.valor * 100) / 100;
  }

  const explicacion = (valores.explanation ?? "").trim();
  const largo = [...explicacion].length;
  if (largo < EXPLICACION_MIN) {
    errores.explanation = `Escribe al menos ${EXPLICACION_MIN} caracteres (llevas ${largo}).`;
  } else if (largo > EXPLICACION_MAX) {
    errores.explanation = `Máximo ${EXPLICACION_MAX} caracteres (llevas ${largo}).`;
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  return {
    ok: true,
    datos: {
      answer_growth: numeros.growth ?? null,
      answer_margin: numeros.margin ?? null,
      answer_dso: numeros.dso ?? null,
      explanation: explicacion,
    },
  };
}
