import { z } from "zod";

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;
export const NOMBRE_CANDIDATO_MAX_LARGO = 120;

export const candidateScoreInputSchema = z.object({
  candidateName: z
    .string()
    .trim()
    .min(1, "Escribe un nombre o alias para el candidato simulado.")
    .max(NOMBRE_CANDIDATO_MAX_LARGO, `Máximo ${NOMBRE_CANDIDATO_MAX_LARGO} caracteres.`),
  scores: z
    .array(
      z.coerce
        .number({ invalid_type_error: "Cada score debe ser un número." })
        .int("Cada score debe ser un número entero.")
        .min(SCORE_MIN, `El score mínimo es ${SCORE_MIN}.`)
        .max(SCORE_MAX, `El score máximo es ${SCORE_MAX}.`)
    )
    .min(1, "Falta calificar al menos un criterio."),
});

export type CandidateScoreInput = z.infer<typeof candidateScoreInputSchema>;

export type ParseCandidateScoreResult =
  | { success: true; data: CandidateScoreInput }
  | { success: false; error: string };

export function parseCandidateScoreForm(formData: FormData): ParseCandidateScoreResult {
  const candidateName = formData.get("candidate_name");
  const scoresRaw = formData.get("scores");

  let scoresJson: unknown;
  try {
    scoresJson = JSON.parse(typeof scoresRaw === "string" ? scoresRaw : "[]");
  } catch {
    return { success: false, error: "Los datos de scores llegaron corruptos. Intenta de nuevo." };
  }

  const result = candidateScoreInputSchema.safeParse({ candidateName, scores: scoresJson });
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { success: true, data: result.data };
}

// ============================================================
// Score ponderado + flag de revisión humana. Todo esto es lógica de
// reglas pura (sin IO, determinística, testeable a mano) — la Feature 4
// solo va a redactar la frase que explica un "motivo" ya calculado aquí,
// nunca va a decidir el número ni el flag (ver DECISIONS.md).
// ============================================================

export interface Criterio {
  label: string;
  weight: number;
}

export interface CriterioCalificado extends Criterio {
  score: number;
}

export interface ItemDesglose extends CriterioCalificado {
  pesaMucho: boolean;
  debil: boolean;
}

export interface ResultadoScoring {
  totalPonderado: number;
  desglose: ItemDesglose[];
  flagged: boolean;
  motivos: string[];
}

// Un score total en esta banda no es ni claramente débil ni claramente
// fuerte — no se auto-aprueba, va a revisión humana.
export const UMBRAL_BORDERLINE_BAJO = 45;
export const UMBRAL_BORDERLINE_ALTO = 65;

// Un criterio que pesa esto o más se considera "de alto peso": un score
// débil ahí no se debe promediar en silencio contra un total decente.
export const PESO_CRITICO = 25;
export const SCORE_DEBIL_EN_CRITERIO_CRITICO = 50;

export function calcularScore(criterios: CriterioCalificado[]): ResultadoScoring {
  const pesoTotal = criterios.reduce((acc, c) => acc + c.weight, 0);
  const sumaPonderada = criterios.reduce((acc, c) => acc + c.score * c.weight, 0);
  const totalPonderado = pesoTotal > 0 ? Math.round(sumaPonderada / pesoTotal) : 0;

  const motivos: string[] = [];

  const desglose: ItemDesglose[] = criterios.map((c) => {
    const pesaMucho = c.weight >= PESO_CRITICO;
    const debil = pesaMucho && c.score < SCORE_DEBIL_EN_CRITERIO_CRITICO;
    if (debil) {
      motivos.push(
        `"${c.label}" pesa ${c.weight}% del rol y el candidato sacó ${c.score}/100 — un criterio de alto peso con evidencia débil no se promedia en silencio.`
      );
    }
    return { ...c, pesaMucho, debil };
  });

  const enBandaBorderline =
    totalPonderado >= UMBRAL_BORDERLINE_BAJO && totalPonderado < UMBRAL_BORDERLINE_ALTO;
  if (enBandaBorderline) {
    motivos.push(
      `El score total (${totalPonderado}/100) cae en la banda borderline (${UMBRAL_BORDERLINE_BAJO}–${UMBRAL_BORDERLINE_ALTO}) — ni claramente débil ni claramente fuerte.`
    );
  }

  const flagged = enBandaBorderline || desglose.some((d) => d.debil);

  return { totalPonderado, desglose, flagged, motivos };
}
