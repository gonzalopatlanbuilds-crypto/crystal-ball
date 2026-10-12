// Expediente de evidencia (Feature 4). Todo el texto fijo vive aquí, en
// código: nunca lo genera la IA. Sin imports (salvo tipos y lib/caso.ts)
// para probarlo con `node`.

import { CRITERIOS } from "./caso.ts";

// Prueba de persona (F5): con solo la lista de "No", alguien desconfiado
// lee el expediente como algo que no sirve para nada. Esto dice, sin
// prometer nada, qué sí deja ver. Texto fijo, nunca de la IA.
export const SI_MUESTRA: Record<"candidato" | "revisor", string[]> = {
  candidato: [
    "Cómo resolviste un caso financiero, con tus propias palabras.",
    "Qué vio una persona real al revisarlo, sin saber quién eres, y cuándo lo hizo.",
    "Qué revisó el sistema (los números) y qué revisó la persona (la explicación).",
  ],
  revisor: [
    "Cómo resolvió la persona un caso financiero, con sus propias palabras.",
    "Qué viste al revisarlo, sin saber quién es, y cuándo lo hiciste.",
    "Qué revisó el sistema (los números) y qué revisaste tú (la explicación).",
  ],
};

export const NO_PRUEBA = [
  "No es empleo ni trabajo real.",
  "No garantiza una entrevista ni una contratación.",
  "No prueba que lo hizo sin ayuda, ni que un empleador lo aceptaría.",
  "No se ha enviado a ningún empleador: el caso y la vacante son simulados.",
];

// Mismo contenido para las dos vistas, dicho a quien lo lee (bug de la
// pasada mecánica: la copia del revisor le hablaba como si fuera el
// candidato).
export type Vista = "candidato" | "revisor";

export const QUIEN_PUEDE_VERLO: Record<Vista, string> = {
  candidato: "Tú y la persona que revisó tu entrega (sin ver tu nombre). Nadie más: no se comparte con empleadores.",
  revisor: "La persona candidata y tú, que la revisaste sin ver su nombre. Nadie más: no se comparte con empleadores.",
};

export const REAL_Y_SIMULADO: Record<Vista, string> = {
  candidato: "Real: tus respuestas, tu explicación y la revisión humana. Simulado: la empresa, el caso y cualquier vacante.",
  revisor: "Real: las respuestas, la explicación y tu revisión. Simulado: la empresa, el caso y cualquier vacante.",
};

export const RECOMENDACIONES = {
  conversar: "Conversar con el candidato",
  mas_evidencia: "Necesita más evidencia",
} as const;
export type Recomendacion = keyof typeof RECOMENDACIONES;

export type Decision = "confirmada" | "descartada";
export interface DecisionObservacion {
  decision: Decision;
  motivo?: string;
}

// Mapa de criterios publicados → evidencia → quién lo juzgó (la "matching
// logic" del Dragon Stack). C1 lo juzga siempre el sistema; C2 y C3, la
// persona que revisa, y quedan "pendiente" mientras no haya revisión. Sin
// conteos ("2 de 3"): el expediente nunca resume a la persona en un número.
export interface FilaCriterio {
  id: string;
  texto: string;
  evidencia: string;
  juzgadoPor: string;
  pendiente: boolean;
}

const EVIDENCIA: Record<string, string> = {
  C1: "Bloque 1 · Cálculos",
  C2: "Bloque 2 · Explicación y bloque 3 · Observaciones revisadas",
  C3: "Bloque 2 · Explicación",
};

export function mapaCriterios(revisor: string | null): FilaCriterio[] {
  return CRITERIOS.map((c) => {
    const humano = c.juzga === "humano";
    return {
      id: c.id,
      texto: c.texto,
      evidencia: EVIDENCIA[c.id],
      juzgadoPor: humano ? (revisor ? `Revisión humana: ${revisor}` : "Pendiente de revisión humana") : "Sistema (automático)",
      pendiente: humano && !revisor,
    };
  });
}

export function nombreRevisor(displayName: string | null | undefined): string {
  const n = (displayName ?? "").trim();
  return n || "Persona revisora del piloto";
}

export function fechaRevision(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Lo que viene de la base (jsonb) se valida antes de pintarlo.
export function leerDecisiones(v: unknown): Record<string, DecisionObservacion> {
  const salida: Record<string, DecisionObservacion> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return salida;
  for (const [id, d] of Object.entries(v as Record<string, unknown>)) {
    if (!d || typeof d !== "object") continue;
    const { decision, motivo } = d as { decision?: unknown; motivo?: unknown };
    if (decision !== "confirmada" && decision !== "descartada") continue;
    salida[id] = typeof motivo === "string" && motivo ? { decision, motivo } : { decision };
  }
  return salida;
}

export function leerObservaciones(v: unknown): { id: string; texto: string }[] | null {
  if (!Array.isArray(v)) return null;
  const ok = v.every((o) => o && typeof o === "object" && typeof o.id === "string" && typeof o.texto === "string");
  return ok ? (v as { id: string; texto: string }[]) : null;
}
