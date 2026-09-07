"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCandidateScoreForm } from "@/lib/scoring";

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
