import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { etiquetaEscenario, STATUS_LABELS } from "@/lib/findings";

interface FindingRow {
  id: string;
  scenario_label: string;
  description: string;
  deadline: string;
  status: string;
  owner_id: string;
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-zinc-100 text-zinc-700",
  pending_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: findings, error } = await supabase
    .from("findings")
    .select("id, scenario_label, description, deadline, status, owner_id")
    .order("created_at", { ascending: false })
    .returns<FindingRow[]>();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Hallazgos de tu organización</h1>
        <Link
          href="/findings/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Nuevo hallazgo
        </Link>
      </div>
      <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Datos simulados — ninguna escuela ni persona aquí es real.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-600">
          No se pudieron cargar los hallazgos. Intenta de nuevo.
        </p>
      )}

      {!error && findings && findings.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          Todavía no hay hallazgos registrados. Registra el primero desde
          el botón de arriba.
        </div>
      )}

      {!error && findings && findings.length > 0 && (
        <ul className="mt-6 space-y-3">
          {findings.map((f) => (
            <li key={f.id}>
              <Link
                href={`/findings/${f.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 hover:bg-zinc-50"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {etiquetaEscenario(f.scenario_label)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-zinc-500">{f.description}</p>
                  <p className="mt-1 text-xs text-zinc-400">Fecha límite: {f.deadline}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    STATUS_BADGE[f.status] ?? "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {STATUS_LABELS[f.status] ?? f.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
