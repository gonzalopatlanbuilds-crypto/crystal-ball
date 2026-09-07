import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CandidateScoreForm from "@/components/CandidateScoreForm";
import { submitCandidateScore } from "../actions";

interface CriteriaSetRow {
  id: string;
  role_name: string;
  criteria: { label: string; weight: number }[];
}

export default async function CalificarCandidatoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: criteriaSet } = await supabase
    .from("criteria_sets")
    .select("id, role_name, criteria")
    .eq("id", id)
    .maybeSingle<CriteriaSetRow>();

  if (!criteriaSet) {
    notFound();
  }

  return (
    <CandidateScoreForm
      action={submitCandidateScore.bind(null, criteriaSet.id)}
      roleName={criteriaSet.role_name}
      criterios={Array.isArray(criteriaSet.criteria) ? criteriaSet.criteria : []}
    />
  );
}
