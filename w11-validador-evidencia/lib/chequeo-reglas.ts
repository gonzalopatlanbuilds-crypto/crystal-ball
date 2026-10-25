// Chequeo por reglas, la línea base contra la que se compara el lector de
// IA (Feature 5, scripts/comparar-lector.ts). A propósito simple, como pide
// el prompt: marca un conflicto de peso cuyo valor nuevo difiere más de
// UMBRAL_PCT del anterior. No dice nada de material, fechas ni folios.
import type { HallazgoParaIA } from "./lector-ia.ts";

export const UMBRAL_PCT = 20;

export interface ResultadoReglas {
  marcado: boolean;
  motivo: string;
}

export function chequeoPorReglas(h: HallazgoParaIA): ResultadoReglas {
  if (h.type !== "value_conflict") return { marcado: false, motivo: "la regla solo mira conflictos de peso" };
  const peso = (h.details.cambios as { campo: string; anterior: number; nuevo: number }[]).find((c) => c.campo === "weight_g");
  if (!peso) return { marcado: false, motivo: "el conflicto no es de peso" };
  if (peso.anterior === 0) return { marcado: true, motivo: "peso anterior en 0" };
  const pct = (Math.abs(peso.nuevo - peso.anterior) / peso.anterior) * 100;
  return pct > UMBRAL_PCT
    ? { marcado: true, motivo: `el peso cambió más de ${UMBRAL_PCT}%` }
    : { marcado: false, motivo: `el peso cambió ${UMBRAL_PCT}% o menos` };
}
