// Siguiente paso concreto — texto fijo, simulado, NUNCA generado por LLM.
// Condición 1 del Blueprint (nunca un dead-end): un resultado de alto
// riesgo siempre tiene que traer una acción concreta, y eso no se puede
// dejar en manos de si la llamada al modelo tuvo éxito o no. Por eso
// vive aquí como lógica de reglas pura, igual que calcularRiesgo().

export interface SiguientePaso {
  clinica: string;
  horario: string;
  mensaje: string;
  urgente: boolean;
}

export function obtenerSiguientePaso(nivel: "alto" | "bajo"): SiguientePaso {
  if (nivel === "alto") {
    return {
      clinica: "Centro de Salud Dr. Ignacio Chávez (Col. Obrera)",
      horario: "Lunes a viernes, 7:00–19:00 — consulta de primera vez sin cita previa",
      mensaje:
        "Acude esta semana con este folio impreso para una valoración de glucosa en ayuno.",
      urgente: true,
    };
  }
  return {
    clinica: "Módulo de salud de tu farmacia más cercana",
    horario: "Todos los días, 9:00–21:00",
    mensaje: "No es urgente. Repite tu chequeo de glucosa en 6 meses o si notas nuevos síntomas.",
    urgente: false,
  };
}
