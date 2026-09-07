import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CriteriaBuilder from "@/components/CriteriaBuilder";
import DeleteCandidateButton from "@/components/DeleteCandidateButton";
import { updateCriteriaSet } from "../actions";

interface CriteriaSetRow {
  id: string;
  role_name: string;
  criteria: { label: string; weight: number }[];
}

interface CandidateScoreRow {
  id: string;
  candidate_name: string;
  created_at: string;
}

export default async function EditarRolPage({
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

  const { data: candidateScores } = await supabase
    .from("candidate_scores")
    .select("id, candidate_name, created_at")
    .eq("criteria_set_id", id)
    .order("created_at", { ascending: false })
    .returns<CandidateScoreRow[]>();

  return (
    <>
      <CriteriaBuilder
        action={updateCriteriaSet.bind(null, criteriaSet.id)}
        valoresIniciales={{
          roleName: criteriaSet.role_name,
          criteria: Array.isArray(criteriaSet.criteria) ? criteriaSet.criteria : [],
        }}
        textoBoton="Guardar cambios"
      />

      <div className="mx-auto max-w-2xl px-6 pb-10">
        <hr className="border-zinc-200" />
        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700">Candidatos calificados (simulados)</h2>
          <Link
            href={`/criteria/${id}/candidates/new`}
            className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-50"
          >
            + Calificar candidato
          </Link>
        </div>

        {(!candidateScores || candidateScores.length === 0) && (
          <p className="mt-3 text-sm text-zinc-500">
            Todavía no has calificado a ningún candidato contra este rol.
          </p>
        )}

        {candidateScores && candidateScores.length > 0 && (
          <ul className="mt-3 space-y-2">
            {candidateScores.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5"
              >
                <Link
                  href={`/criteria/${id}/candidates/${c.id}`}
                  className="flex-1 text-sm hover:text-blue-800"
                >
                  {c.candidate_name}
                </Link>
                <DeleteCandidateButton
                  candidateScoreId={c.id}
                  criteriaSetId={id}
                  candidateName={c.candidate_name}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
