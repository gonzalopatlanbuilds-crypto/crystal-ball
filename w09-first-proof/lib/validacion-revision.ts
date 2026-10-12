// Validación server-side del formulario de revisión (Feature 4). Mismas
// reglas que submit_review() en sql/schema.sql: la base es la última línea
// de defensa. Sin imports (salvo tipos) para probarla con `node`.

import type { DecisionObservacion, Recomendacion } from "./expediente.ts";

export const NOTA_MAX = 400;
export const CONFLICTO_MAX = 200;
export const MOTIVO_MAX = 120;

export type ErroresRevision = Partial<Record<"conflicto" | "recomendacion" | "nota" | "observaciones", string>>;

export interface RevisionValida {
  decisiones: Record<string, DecisionObservacion>;
  conflicto: string;
  recomendacion: Recomendacion;
  nota: string;
}

export interface EntradaRevision {
  idsObservaciones: string[];
  decisiones: Record<string, string>; // id → "confirmada" | "descartada"
  motivos: Record<string, string>; // id → texto (opcional, solo descartadas)
  conflictoTipo: string; // "ninguno" | "si"
  conflictoTexto: string;
  recomendacion: string;
  nota: string;
}

export function validarRevision(e: EntradaRevision): { ok: true; datos: RevisionValida } | { ok: false; errores: ErroresRevision } {
  const errores: ErroresRevision = {};
  const decisiones: Record<string, DecisionObservacion> = {};

  for (const id of e.idsObservaciones) {
    const d = e.decisiones[id];
    if (d !== "confirmada" && d !== "descartada") {
      errores.observaciones = "Confirma o descarta cada observación de IA.";
      continue;
    }
    const motivo = (e.motivos[id] ?? "").trim();
    if (d === "descartada" && motivo.length > MOTIVO_MAX) {
      errores.observaciones = `El motivo de descarte admite máximo ${MOTIVO_MAX} caracteres.`;
      continue;
    }
    decisiones[id] = d === "descartada" && motivo ? { decision: d, motivo } : { decision: d };
  }

  let conflicto = "";
  if (e.conflictoTipo === "ninguno") {
    conflicto = "Ninguno";
  } else if (e.conflictoTipo === "si") {
    conflicto = e.conflictoTexto.trim();
    if (conflicto.length < 1 || conflicto.length > CONFLICTO_MAX) {
      errores.conflicto = `Describe el conflicto (1 a ${CONFLICTO_MAX} caracteres).`;
    }
  } else {
    errores.conflicto = "Declara si tienes un conflicto de interés.";
  }

  if (e.recomendacion !== "conversar" && e.recomendacion !== "mas_evidencia") {
    errores.recomendacion = "Elige una recomendación.";
  }

  const nota = e.nota.trim();
  if (nota.length < 1 || nota.length > NOTA_MAX) {
    errores.nota = `Escribe una nota de 1 a ${NOTA_MAX} caracteres.`;
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, datos: { decisiones, conflicto, recomendacion: e.recomendacion as Recomendacion, nota } };
}
