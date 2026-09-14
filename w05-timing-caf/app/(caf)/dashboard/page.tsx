import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularRiesgo } from "@/lib/scoring";
import type { RangoEdadValue, SintomaValue } from "@/lib/screenings";

interface ScreeningRow {
  id: string;
  folio: string;
  patient_first_name: string;
  patient_last_name: string;
  glucose_mgdl: number;
  family_history: boolean;
  symptoms: SintomaValue[];
  age_band: RangoEdadValue;
  created_at: string;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: screenings, error } = await supabase
    .from("screenings")
    .select(
      "id, folio, patient_first_name, patient_last_name, glucose_mgdl, family_history, symptoms, age_band, created_at"
    )
    .order("created_at", { ascending: false })
    .returns<ScreeningRow[]>();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Tus tamizajes</h1>
        <Link
          href="/screenings/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Nuevo tamizaje
        </Link>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600">
          No se pudieron cargar tus tamizajes. Intenta de nuevo.
        </p>
      )}

      {!error && screenings && screenings.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          Todavía no hay tamizajes capturados. Captura el primero para generar un folio.
        </div>
      )}

      {!error && screenings && screenings.length > 0 && (
        <ul className="mt-6 space-y-3">
          {screenings.map((s) => {
            const riesgo = calcularRiesgo({
              glucoseMgdl: s.glucose_mgdl,
              familyHistory: s.family_history,
              symptoms: s.symptoms,
              ageBand: s.age_band,
            });
            return (
              <li key={s.id}>
                <Link
                  href={`/screenings/${s.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 hover:bg-zinc-50"
                >
                  <div>
                    <p className="font-mono text-sm font-medium text-zinc-900">{s.folio}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {s.patient_first_name} {s.patient_last_name}
                    </p>
                  </div>
                  <span
                    className={
                      riesgo.nivel === "alto"
                        ? "rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700"
                        : "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
                    }
                  >
                    Riesgo {riesgo.nivel === "alto" ? "alto" : "bajo"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
