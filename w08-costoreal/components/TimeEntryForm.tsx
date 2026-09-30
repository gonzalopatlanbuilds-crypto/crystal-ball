"use client";

import { useActionState } from "react";
import { registrarTiempo, type RegistroTiempoState } from "@/app/(app)/cases/actions";
import { PHASES, PHASE_LABELS, TARIFA_MAX_MXN, TARIFA_MIN_MXN } from "@/lib/tiempo";

function ErrorCampo({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null;
  return <p className="mt-1 text-xs text-red-600">{mensaje}</p>;
}

export default function TimeEntryForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState<RegistroTiempoState, FormData>(
    registrarTiempo,
    undefined
  );

  const errores = state && "fieldErrors" in state ? state.fieldErrors : {};
  const valores = state && "valores" in state ? state.valores : undefined;
  const inputBase = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
  const borde = (campo: keyof typeof errores) =>
    errores[campo] ? "border-red-400 bg-red-50" : "border-zinc-300";

  return (
    // noValidate a propósito: la validación que cuenta es la del server
    // action (lib/tiempo.ts), y así sus errores son los que se ven inline
    // — no un tooltip del navegador que se puede saltar con un request
    // directo. `key` remonta el form para que los defaultValue devueltos
    // por el servidor sí se apliquen después del reset automático.
    <form
      key={JSON.stringify(state ?? null)}
      action={action}
      noValidate
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-zinc-900">Registrar tiempo</h2>
      <input type="hidden" name="case_id" value={caseId} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="phase">
            Fase
          </label>
          <select
            id="phase"
            name="phase"
            defaultValue={valores?.phase ?? ""}
            className={`${inputBase} ${borde("phase")} bg-white`}
          >
            <option value="" disabled>
              Elige una fase…
            </option>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABELS[p]}
              </option>
            ))}
          </select>
          <ErrorCampo mensaje={errores.phase} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="staff_name">
            Personal (nombre inventado)
          </label>
          <input
            id="staff_name"
            name="staff_name"
            maxLength={60}
            defaultValue={valores?.staffName ?? ""}
            placeholder="Elisa R."
            className={`${inputBase} ${borde("staffName")}`}
          />
          <ErrorCampo mensaje={errores.staffName} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="minutes">
            Minutos invertidos
          </label>
          <input
            id="minutes"
            name="minutes"
            inputMode="numeric"
            defaultValue={valores?.minutes ?? ""}
            placeholder="12"
            className={`${inputBase} ${borde("minutes")}`}
          />
          <ErrorCampo mensaje={errores.minutes} />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="hourly_rate">
            Tarifa cargada (MXN/hora)
          </label>
          <input
            id="hourly_rate"
            name="hourly_rate"
            inputMode="decimal"
            defaultValue={valores?.hourlyRate ?? ""}
            placeholder="180"
            className={`${inputBase} ${borde("hourlyRate")}`}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Sueldo + prestaciones, ya incluidas. Entre ${TARIFA_MIN_MXN} y $
            {TARIFA_MAX_MXN.toLocaleString("es-MX")}.
          </p>
          <ErrorCampo mensaje={errores.hourlyRate} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-lg bg-sky-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar registro"}
      </button>
      {state && "error" in state && state.error && (
        <p className="mt-3 text-sm text-red-600">{state.error}</p>
      )}
      {state && "ok" in state && <p className="mt-3 text-sm text-emerald-700">Registro guardado.</p>}
    </form>
  );
}
