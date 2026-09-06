import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface CriteriaSetRow {
  id: string;
  role_name: string;
  criteria: unknown;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: criteriaSets, error } = await supabase
    .from("criteria_sets")
    .select("id, role_name, criteria")
    .order("created_at", { ascending: false })
    .returns<CriteriaSetRow[]>();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Tus roles</h1>
        <Link
          href="/criteria/new"
          className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          + Nuevo rol
        </Link>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600">
          No se pudieron cargar tus roles. Intenta de nuevo.
        </p>
      )}

      {!error && criteriaSets && criteriaSets.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          Todavía no hay criterios de contratación configurados. Crea tu primer rol para empezar.
        </div>
      )}

      {!error && criteriaSets && criteriaSets.length > 0 && (
        <ul className="mt-6 space-y-3">
          {criteriaSets.map((set) => {
            const criteria = Array.isArray(set.criteria) ? set.criteria : [];
            return (
              <li key={set.id}>
                <Link
                  href={`/criteria/${set.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <p className="font-medium text-zinc-900">{set.role_name}</p>
                  <p className="mt-1 text-sm text-zinc-500">{criteria.length} criterios ponderados</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
