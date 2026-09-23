import { createClient } from "@/lib/supabase/server";
import type { Route } from "@/lib/routes";
import {
  calcularReporte,
  formatearFechaCorta,
  formatearMXN,
  hoyISO,
  primerDiaDelMes,
  type TripStatusRow,
} from "@/lib/report";
import PrintButton from "@/components/PrintButton";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from || primerDiaDelMes();
  const to = params.to || hoyISO();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: route, error: routeError } = await supabase
    .from("routes")
    .select(
      "id, name, origin_label, destination_label, distance_km, expected_duration_min_low, expected_duration_min_high, expected_speed_kmh_low, expected_speed_kmh_high, avg_fare_mxn"
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Route>();

  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("status")
    .gte("start_time", `${from}T00:00:00`)
    .lte("start_time", `${to}T23:59:59`)
    .returns<TripStatusRow[]>();

  const error = routeError || tripsError;
  const reporte = !error && route && trips ? calcularReporte(trips, route) : null;
  const nombreChofer =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Conductor";

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-lg font-semibold text-zinc-900">Reporte de ingresos</h1>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-4 print:hidden">
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="from">
            Desde
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="to">
            Hasta
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Actualizar reporte
        </button>
      </form>

      {error && (
        <p className="mt-6 text-sm text-red-600">No se pudo generar el reporte. Intenta de nuevo.</p>
      )}

      {!error && !route && (
        <p className="mt-6 text-sm text-zinc-500">Todavía no hay una ruta configurada.</p>
      )}

      {!error && route && reporte && (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
          <p className="text-base font-semibold text-zinc-900">Reporte de ingresos verificados</p>
          <p className="text-sm text-zinc-500">
            Emitido por MiRuta — no es una institución financiera
          </p>

          <div className="mt-4 space-y-1 text-sm text-zinc-700">
            <p>Chofer: {nombreChofer}</p>
            <p>
              Ruta: {route.name} — {route.origin_label} ↔ {route.destination_label}
            </p>
            <p>
              Periodo: {formatearFechaCorta(from)} – {formatearFechaCorta(to)}
            </p>
          </div>

          <hr className="my-4 border-zinc-200" />

          <p className="text-base font-semibold text-zinc-900">
            {reporte.verifiedTrips} viaje{reporte.verifiedTrips === 1 ? "" : "s"} verificado
            {reporte.verifiedTrips === 1 ? "" : "s"} de {reporte.totalTrips} registrado
            {reporte.totalTrips === 1 ? "" : "s"}
          </p>
          <p className="text-sm text-zinc-500">
            {reporte.flaggedTrips} viaje{reporte.flaggedTrips === 1 ? "" : "s"} marcado
            {reporte.flaggedTrips === 1 ? "" : "s"} por inconsistencia no se incluye
            {reporte.flaggedTrips === 1 ? "" : "n"} en este total.
          </p>

          <p className="mt-4 text-2xl font-bold text-blue-800">
            Ingreso estimado verificado: {formatearMXN(reporte.estimatedIncomeMxn)}
          </p>
          <p className="text-sm text-zinc-500">
            Basado en tarifa promedio de ruta × viajes verificados — estimado, no contable.
          </p>

          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-zinc-900">Cómo se verificó cada viaje</p>
            <p className="mt-1 text-sm text-zinc-700">
              Duración, velocidad y telemetría de cada viaje comparadas contra la
              geometría conocida de {route.name} — no autorreporte sin revisar.
            </p>
          </div>
        </div>
      )}

      {!error && route && reporte && (
        <div className="mt-6">
          <PrintButton />
        </div>
      )}

      <p className="mt-6 text-sm text-zinc-400">
        Este reporte es tuyo — te sirve para trámites de crédito, renta de vivienda o
        arrendamiento de unidad.
      </p>
    </main>
  );
}
