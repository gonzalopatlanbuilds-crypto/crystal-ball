import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CASE_TYPE_LABELS, SIMULADO_AVISO, codigoCaso, type CaseType } from "@/lib/casos";
import { PHASES, PHASE_LABELS, type Phase } from "@/lib/tiempo";
import {
  costoCasoCentavos,
  costoEntradaCentavos,
  formatoMxn,
  minutosTotales,
} from "@/lib/costos";
import TimeEntryForm from "@/components/TimeEntryForm";
import { borrarEntrada } from "../actions";

interface CaseRow {
  id: string;
  case_number: number;
  case_type: CaseType;
}

interface LogRow {
  id: string;
  phase: Phase;
  staff_name: string;
  minutes: number;
  hourly_rate_mxn: number | string;
  logged_by: string;
}

function tarifa(valor: number | string): string {
  return `$${Number(valor).toLocaleString("es-MX", { maximumFractionDigits: 2 })}/hora`;
}

export default async function CasePage({ params }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS: un caso de otra organización no llega aquí como error sino como
  // "no existe" — mismo resultado para la persona que no debe verlo.
  const { data: caso, error: errorCaso } = await supabase
    .from("cases")
    .select("id, case_number, case_type")
    .eq("id", id)
    .maybeSingle<CaseRow>();

  if (errorCaso) {
    console.error("CasePage: no se pudo leer el caso", errorCaso);
  }
  if (!caso) {
    notFound();
  }

  const { data: logs, error: errorLogs } = await supabase
    .from("case_time_logs")
    .select("id, phase, staff_name, minutes, hourly_rate_mxn, logged_by")
    .eq("case_id", caso.id)
    .order("created_at", { ascending: true })
    .returns<LogRow[]>();

  if (errorLogs) {
    console.error("CasePage: no se pudieron leer los registros", errorLogs);
  }

  const entradas = logs ?? [];
  const ordenadas = [...entradas].sort(
    (a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase)
  );
  const total = costoCasoCentavos(entradas);
  const minutos = minutosTotales(entradas);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/dashboard" className="text-sm text-sky-800 hover:underline">
        ← Volver al panel
      </Link>
      <h1 className="mt-3 text-xl font-semibold text-zinc-900">
        Caso {codigoCaso(caso.case_number)} — {CASE_TYPE_LABELS[caso.case_type]}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">Registra el tiempo real invertido por fase.</p>

      {errorLogs && (
        <p className="mt-4 text-sm text-red-600">
          No se pudieron cargar los registros de tiempo. Intenta de nuevo.
        </p>
      )}

      {!errorLogs && ordenadas.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Todavía no hay tiempo registrado en este caso.
        </div>
      )}

      {ordenadas.length > 0 && (
        <ul className="mt-6 space-y-2">
          {ordenadas.map((e) => {
            const costo = costoEntradaCentavos(e.minutes, e.hourly_rate_mxn);
            return (
              <li key={e.id} className="rounded-xl bg-stone-100 px-5 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-zinc-900">{PHASE_LABELS[e.phase]}</p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      Personal: {e.staff_name} · Tarifa: {tarifa(e.hourly_rate_mxn)}
                    </p>
                    {/* La cuenta completa en pantalla es el punto de este
                        slice: cualquiera puede rehacerla a mano. */}
                    <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
                      {e.minutes} min × {tarifa(e.hourly_rate_mxn)} ÷ 60 = {formatoMxn(costo)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-900 tabular-nums">{e.minutes} min</p>
                    {e.logged_by === user?.id && (
                      <form action={borrarEntrada}>
                        <input type="hidden" name="entry_id" value={e.id} />
                        <input type="hidden" name="case_id" value={caso.id} />
                        <button type="submit" className="mt-1 text-xs text-zinc-500 hover:text-red-600">
                          Borrar
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 rounded-xl border border-sky-500 bg-sky-50 px-5 py-4">
        <p className="text-lg font-semibold text-sky-950">
          Costo real de este caso: {formatoMxn(total)}
        </p>
        <p className="mt-1 text-sm text-sky-950">
          {minutos} minutos totales de personal, a tarifas cargadas (la tarifa
          capturada ya incluye prestaciones; sin multiplicadores ocultos). Cada
          entrada se redondea a centavos y el total es su suma.
        </p>
      </div>

      <div className="mt-6">
        <TimeEntryForm caseId={caso.id} />
      </div>

      <p className="mt-8 border-t border-zinc-200 pt-4 text-sm text-zinc-500">{SIMULADO_AVISO}</p>
    </main>
  );
}
