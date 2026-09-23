import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Route } from "@/lib/routes";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: route, error } = await supabase
    .from("routes")
    .select(
      "id, name, origin_label, destination_label, distance_km, expected_duration_min_low, expected_duration_min_high, expected_speed_kmh_low, expected_speed_kmh_high"
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Route>();

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-lg font-semibold text-zinc-900">Tu ruta</h1>
      <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Datos simulados — ningún conductor ni ruta aquí es una persona o
        empresa real.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-600">
          No se pudo cargar la ruta. Intenta de nuevo.
        </p>
      )}

      {!error && !route && (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          Todavía no hay una ruta configurada.
        </div>
      )}

      {!error && route && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-base font-medium text-zinc-900">{route.name}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {route.origin_label} ↔ {route.destination_label} ·{" "}
            {route.distance_km} km
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-zinc-500">Duración esperada</dt>
              <dd className="font-medium text-zinc-900">
                {route.expected_duration_min_low}–
                {route.expected_duration_min_high} min
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Velocidad promedio esperada</dt>
              <dd className="font-medium text-zinc-900">
                {route.expected_speed_kmh_low}–{route.expected_speed_kmh_high}{" "}
                km/h
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-zinc-400">
            Un viaje que se aleje mucho de este rango se marcará para
            revisión en vez de contarse automáticamente — así el reporte de
            ingresos que construyas sobre tus viajes es algo que puedas
            respaldar tú mismo.
          </p>
        </div>
      )}

      <Link
        href="/trips"
        className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Registrar un viaje
      </Link>
    </main>
  );
}
