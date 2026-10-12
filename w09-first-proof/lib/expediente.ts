// Expediente de evidencia (Feature 4). Todo el texto fijo vive aquí, en
// código: nunca lo genera la IA. Sin imports (salvo tipos y lib/caso.ts)
// para probarlo con `node`.

import { CRITERIOS } from "./caso.ts";

export const NO_PRUEBA = [
  "No es empleo ni trabajo real.",
  "No garantiza una entrevista ni una contratación.",
  "No prueba que lo hizo sin ayuda, ni que un empleador lo aceptaría.",
  "No se ha enviado a ningún empleador: el caso y la vacante son simulados.",
];

export const QUIEN_PUEDE_VERLO =
  "Tú y la persona que revisó tu entrega (sin ver tu nombre). Nadie más: no se comparte con empleadores.";

export const REAL_Y_SIMULADO =
  "Real: tus respuestas, tu explicación y la revisión humana. Simulado: la empresa, el caso y cualquier vacante.";

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
