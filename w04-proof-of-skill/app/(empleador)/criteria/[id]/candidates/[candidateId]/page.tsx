import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcularScore, type CriterioCalificado } from "@/lib/scoring";
import BorderlineExplanation from "@/components/BorderlineExplanation";

interface CandidateScoreRow {
  id: string;
  candidate_name: string;
  criteria_set_id: string;
  scores: CriterioCalificado[];
  criteria_sets: { role_name: string } | { role_name: string }[] | null;
}

export default async function ScorecardPage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  const { id, candidateId } = await params;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("candidate_scores")
    .select("id, candidate_name, criteria_set_id, scores, criteria_sets(role_name)")
    .eq("id", candidateId)
    .eq("criteria_set_id", id)
    .maybeSingle<CandidateScoreRow>();

  if (!row) {
    notFound();
  }

  const roleName = Array.isArray(row.criteria_sets)
    ? row.criteria_sets[0]?.role_name
    : row.criteria_sets?.role_name;

  const resultado = calcularScore(row.scores);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href={`/criteria/${id}`} className="text-sm text-blue-800 hover:underline">
        ← Volver al rol
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">{row.candidate_name}</h1>
          <p className="text-sm text-zinc-500">Calificado contra: {roleName ?? "rol eliminado"}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          Datos simulados
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 text-center">
        <p className="text-sm text-zinc-500">Score ponderado total</p>
        <p className="mt-1 text-5xl font-bold text-zinc-900">{resultado.totalPonderado}</p>
        <p className="text-sm text-zinc-400">/ 100</p>
      </div>

      {resultado.flagged ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">🔶 Marcado para revisión humana</p>
          <p className="mt-1 text-sm text-amber-800">
            Este resultado no se auto-aprueba. Un revisor humano debe confirmarlo o descartarlo
            antes de avanzar al candidato.
          </p>
          <BorderlineExplanation candidateScoreId={row.id} />
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="font-medium text-emerald-900">✅ Sin señales de alerta en las reglas automáticas</p>
          <p className="mt-1 text-sm text-emerald-800">
            No es una garantía de que el candidato sea el correcto — es una lectura contra tus
            propios pesos, no un veredicto.
          </p>
        </div>
      )}

      {resultado.motivos.length > 0 && (
        <div className="mt-4 rounded-xl bg-zinc-100 p-4">
          <p className="text-sm font-medium text-zinc-700">Motivo (reglas automáticas):</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600">
            {resultado.motivos.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-8 text-sm font-medium text-zinc-700">Desglose por criterio</h2>
      <div className="mt-3 space-y-2">
        {resultado.desglose.map((item, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-zinc-900">{item.label}</p>
              {item.debil && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  débil en criterio de alto peso
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm text-zinc-500">
              <span>peso {item.weight}%</span>
              <span>·</span>
              <span>score {item.score}/100</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${item.debil ? "bg-red-500" : "bg-blue-800"}`}
                style={{ width: `${item.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-zinc-500">
        Este score se calcula 100% con reglas determinísticas contra los pesos que tú definiste
        para este rol — sin caja negra de IA decidiendo el número ni el flag.
      </p>
    </main>
  );
}
