"use server";

import Anthropic from "@anthropic-ai/sdk";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCandidateScoreForm, calcularScore, type CriterioCalificado } from "@/lib/scoring";
import { redactarExplicacionBorderline } from "@/lib/llm";

export type CandidateScoreFormState = { error: string } | undefined;

export async function submitCandidateScore(
  criteriaSetId: string,
  _prevState: CandidateScoreFormState,
  formData: FormData
): Promise<CandidateScoreFormState> {
  const parsed = parseCandidateScoreForm(formData);
  if (!parsed.success) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const { data: criteriaSet } = await supabase
    .from("criteria_sets")
    .select("id, criteria")
    .eq("id", criteriaSetId)
    .maybeSingle<{ id: string; criteria: { label: string; weight: number }[] }>();

  if (!criteriaSet) return { error: "No se encontró el rol. Recarga la página." };

  const criterios = Array.isArray(criteriaSet.criteria) ? criteriaSet.criteria : [];
  if (criterios.length !== parsed.data.scores.length) {
    return { error: "El número de scores no coincide con los criterios del rol. Recarga la página." };
  }

  // La etiqueta y el peso de cada criterio vienen de criteria_sets (server),
  // nunca del formulario — así nadie infla su propio score manipulando el
  // peso al enviar el form.
  const scoresSnapshot = criterios.map((c, i) => ({
    label: c.label,
    weight: c.weight,
    score: parsed.data.scores[i],
  }));

  const { data: inserted, error } = await supabase
    .from("candidate_scores")
    .insert({
      employer_id: user.id,
      criteria_set_id: criteriaSetId,
      candidate_name: parsed.data.candidateName,
      scores: scoresSnapshot,
    })
    .select("id")
    .single();

  if (error || !inserted) return { error: "No se pudo guardar el scorecard. Intenta de nuevo." };

  redirect(`/criteria/${criteriaSetId}/candidates/${inserted.id}`);
}

export type BorderlineExplanationResult =
  | { success: true; explanation: string }
  | { success: false; error: string };

interface CandidateScoreWithRole {
  candidate_name: string;
  scores: CriterioCalificado[];
  criteria_sets: { role_name: string } | { role_name: string }[] | null;
}

// Genera la frase que se le muestra al empleador explicando un resultado
// borderline. Recalcula el score y el flag desde cero con calcularScore()
// (la misma función pura de lib/scoring.ts que ya decidió el flag al
// guardar el scorecard) — nunca confía en un flag que le mande el cliente,
// y se niega a llamar al LLM si el resultado no está flagged: esta llamada
// existe únicamente para redactar un borderline, no para opinar sobre un
// resultado ya claro. Ver DECISIONS.md → "Alcance de Feature 4".
export async function generateBorderlineExplanation(
  candidateScoreId: string
): Promise<BorderlineExplanationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const { data: row } = await supabase
    .from("candidate_scores")
    .select("candidate_name, scores, criteria_sets(role_name)")
    .eq("id", candidateScoreId)
    .maybeSingle<CandidateScoreWithRole>();

  if (!row) return { success: false, error: "No se encontró el candidato." };

  const roleName = Array.isArray(row.criteria_sets)
    ? row.criteria_sets[0]?.role_name
    : row.criteria_sets?.role_name;

  const resultado = calcularScore(row.scores);
  if (!resultado.flagged) {
    return {
      success: false,
      error: "Este resultado no está marcado como borderline — no hay nada que explicar.",
    };
  }

  try {
    const explanation = await redactarExplicacionBorderline({
      roleName: roleName ?? "rol eliminado",
      resultado,
    });
    return { success: true, explanation };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error("generateBorderlineExplanation RateLimitError:", err.message);
      return { success: false, error: "Demasiadas solicitudes al modelo. Intenta de nuevo en un momento." };
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("generateBorderlineExplanation AuthenticationError:", err.message);
      return { success: false, error: "Falta configurar ANTHROPIC_API_KEY en el servidor." };
    }
    if (err instanceof Anthropic.APIError) {
      console.error("generateBorderlineExplanation APIError:", err.status, err.message);
      return { success: false, error: `Error del modelo (${err.status}). Intenta de nuevo.` };
    }
    console.error("generateBorderlineExplanation unexpected error:", err);
    return { success: false, error: "No se pudo generar la explicación. Intenta de nuevo." };
  }
}
