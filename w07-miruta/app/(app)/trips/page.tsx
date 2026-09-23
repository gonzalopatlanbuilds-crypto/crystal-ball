import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { registrarViaje } from "./actions";
import TripForm from "@/components/TripForm";

interface TripRow {
  id: string;
  start_time: string;
  end_time: string;
  status: "verified" | "flagged";
  flag_reason: string | null;
}

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function TripsPage() {
  const supabase = await createClient();
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, start_time, end_time, status, flag_reason")
    .order("start_time", { ascending: false })
    .returns<TripRow[]>();

  const verificados = trips?.filter((t) => t.status === "verified").length ?? 0;
  const marcados = trips?.filter((t) => t.status === "flagged").length ?? 0;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-lg font-semibold text-zinc-900">Tus viajes</h1>
      <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Datos simulados — GPS y telemetría de prueba, ningún viaje aquí es
        real.
      </p>

      <div className="mt-6">
        <TripForm action={registrarViaje} />
      </div>

      {error && (
        <p className="mt-6 text-sm text-red-600">No se pudieron cargar tus viajes.</p>
      )}

      {!error && trips && trips.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          Todavía no has registrado ningún viaje. Usa el formulario de
          arriba para el primero.
        </div>
      )}

      {!error && trips && trips.length > 0 && (
        <>
          <ul className="mt-6 space-y-3">
            {trips.map((t) => {
              const durMin = Math.round(
                (new Date(t.end_time).getTime() - new Date(t.start_time).getTime()) / 60000
              );
              const verificado = t.status === "verified";
              return (
                <li
                  key={t.id}
                  className={`rounded-xl border p-4 ${
                    verificado
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-amber-300 bg-amber-50"
                  }`}
                >
                  <p className="text-sm font-medium text-zinc-900">
                    {formatearFecha(t.start_time)} — {formatearHora(t.start_time)} a{" "}
                    {formatearHora(t.end_time)} ({durMin} min)
                  </p>
                  <p
                    className={`mt-1 text-sm ${
                      verificado ? "text-emerald-700" : "text-amber-800"
                    }`}
                  >
                    {verificado
                      ? "Verificado — duración y velocidad consistentes con la ruta"
                      : `Marcado — ${t.flag_reason}. No se cuenta en tu reporte.`}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 rounded-xl bg-zinc-100 px-4 py-3 text-sm">
            <p className="font-semibold text-zinc-900">
              Resumen: {verificados} viaje{verificados === 1 ? "" : "s"} verificado
              {verificados === 1 ? "" : "s"} · {marcados} marcado{marcados === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-zinc-500">
              Solo los viajes verificados cuentan en tu reporte de ingresos.
            </p>
          </div>

          <Link
            href="/report"
            className="mt-6 inline-block rounded-lg bg-blue-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Generar reporte de ingresos
          </Link>
        </>
      )}
    </main>
  );
}
