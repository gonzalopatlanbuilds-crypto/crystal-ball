"use client";

import { useActionState } from "react";
import type { TripFormState } from "@/app/(app)/trips/actions";
import { TELEMETRY_LABELS } from "@/lib/trips";

interface Props {
  action: (state: TripFormState, formData: FormData) => Promise<TripFormState>;
}

export default function TripForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<TripFormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">Registrar viaje</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Inicio/fin simulan el ping de GPS del viaje; la telemetría simula
        el resumen del sensor del teléfono. Nada de esto es captura real
        de GPS o acelerómetro todavía.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="start_time">
            Inicio
          </label>
          <input
            id="start_time"
            name="start_time"
            type="datetime-local"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="end_time">
            Fin
          </label>
          <input
            id="end_time"
            name="end_time"
            type="datetime-local"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label
            className="block text-sm font-medium text-zinc-700"
            htmlFor="telemetry_avg_speed_kmh"
          >
            Velocidad promedio de telemetría (km/h)
          </label>
          <input
            id="telemetry_avg_speed_kmh"
            name="telemetry_avg_speed_kmh"
            type="number"
            step="0.1"
            min="0.1"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="telemetry_label">
            Resultado de telemetría (simulado)
          </label>
          <select
            id="telemetry_label"
            name="telemetry_label"
            required
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Elige…
            </option>
            {TELEMETRY_LABELS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Registrar viaje"}
        </button>
      </div>

      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
