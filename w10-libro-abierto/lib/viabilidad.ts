// Estado de viabilidad: lo calcula el servidor con esta función pura, y la
// base lo vuelve a calcular en SQL (estado_viabilidad) y rechaza cualquier
// publicación cuyo estado no coincida. test:schema compara ambas.

import { calcularModelo, type Supuesto } from "./modelo.ts";
import { CLAVES } from "./supuestos.ts";

export type Viabilidad = "NOT_DEMONSTRATED" | "EVIDENCE_RECORDED_NOT_SUPPORTED" | "SUPPORTED";

export const VIABILIDADES: Viabilidad[] = ["NOT_DEMONSTRATED", "EVIDENCE_RECORDED_NOT_SUPPORTED", "SUPPORTED"];

export const ETIQUETA_VIABILIDAD: Record<Viabilidad, string> = {
  NOT_DEMONSTRATED: "NO DEMOSTRADA",
  EVIDENCE_RECORDED_NOT_SUPPORTED: "EVIDENCIA REGISTRADA, NO SUSTENTADA",
  SUPPORTED: "SUSTENTADA",
};

// Textos de /financiamiento (fijos en código). La etiqueta pública cambia;
// los valores internos del estado (NOT_DEMONSTRATED, etc.) no.
export const ETIQUETA_PUBLICA_VIABILIDAD = "¿Alguien paga por esto?";
export const ACLARACION_VIABILIDAD =
  "Esto no dice si los resultados del verificador son correctos. Dice si ya hay alguien que pague por operarlo.";
export const EXPLICACION_10_A_1 =
  "El 10:1 es la regla que nos pusimos: lo que el pagador evita perder debe ser al menos 10 veces lo que paga.";

// Las líneas que lee el estudiante bajo el estado: la explicación del estado,
// la aclaración, y la explicación del 10:1 solo si el texto lo menciona.
export function lineasPublicas(estado: Viabilidad): string[] {
  const base = EXPLICACION_PUBLICA[estado];
  return [...base, ACLARACION_VIABILIDAD, ...(base.some((l) => l.includes("10:1")) ? [EXPLICACION_10_A_1] : [])];
}

// Lo que lee el estudiante en /financiamiento. Texto fijo en código.
export const EXPLICACION_PUBLICA: Record<Viabilidad, string[]> = {
  NOT_DEMONSTRATED: [
    "Todavía no hay evidencia registrada de un pagador.",
    "Ninguna fuente de dinero está asegurada.",
  ],
  EVIDENCE_RECORDED_NOT_SUPPORTED: [
    "Hay evidencia registrada de un posible pagador,",
    "pero no todos los supuestos tienen fuente o el 10:1 no se cumple.",
  ],
  SUPPORTED: [
    "Hay evidencia de un pagador, todos los supuestos tienen fuente",
    "y el 10:1 se cumple.",
  ],
};

export function calcularViabilidad(hayEvidencia: boolean, supuestos: readonly Supuesto[]): Viabilidad {
  if (!hayEvidencia) return "NOT_DEMONSTRATED";
  const todosSustentados = CLAVES.every((k) => supuestos.some((s) => s.key === k && s.status === "sustained"));
  const cumple = calcularModelo(supuestos).diezAUno.cumple === true;
  return todosSustentados && cumple ? "SUPPORTED" : "EVIDENCE_RECORDED_NOT_SUPPORTED";
}

// Qué falta para pasar al siguiente estado (pantalla del operador).
export function queFalta(hayEvidencia: boolean, supuestos: readonly Supuesto[]): string[] {
  const faltas: string[] = [];
  if (!hayEvidencia) faltas.push("Registra evidencia de un pagador.");
  const noSustentados = CLAVES.filter((k) => !supuestos.some((s) => s.key === k && s.status === "sustained"));
  if (noSustentados.length > 0) faltas.push(`${noSustentados.length} de ${CLAVES.length} supuestos no están sustentados (o no existen).`);
  const cumple = calcularModelo(supuestos).diezAUno.cumple;
  if (cumple === null) faltas.push("El 10:1 no es calculable (falta la pérdida evitada).");
  else if (!cumple) faltas.push("El 10:1 no se cumple.");
  return faltas;
}
