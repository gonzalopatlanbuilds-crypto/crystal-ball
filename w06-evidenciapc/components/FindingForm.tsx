"use client";

import { useActionState } from "react";
import type { FindingFormState } from "@/app/(app)/findings/actions";
import { ACCION_MAX_LARGO, DESCRIPCION_MAX_LARGO, ESCENARIOS } from "@/lib/findings";

interface Member {
  id: string;
  label: string;
}

interface Props {
  action: (state: FindingFormState, formData: FormData) => Promise<FindingFormState>;
  members: Member[];
}

export default function FindingForm({ action, members }: Props) {
  const [state, formAction, pending] = useActionState<FindingFormState, FormData>(
    action,
    undefined
  );

  return (
    <form action={formAction} className="mx-auto max-w-2xl p-6">
      <h1 className="text-lg font-semibold text-zinc-900">Loguear hallazgo crítico</h1>
      <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Datos simulados — este flujo no registra un incidente real.
      </p>

      <div className="mt-6">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="scenario_label">
          Escenario de simulacro
        </label>
        <select
          id="scenario_label"
          name="scenario_label"
          required
          defaultValue=""
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Elige un escenario…
          </option>
          {ESCENARIOS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="description">
          Descripción del hallazgo crítico
        </label>
        <textarea
          id="description"
          name="description"
          required
          maxLength={DESCRIPCION_MAX_LARGO}
          rows={4}
          placeholder="Ej. la ruta de evacuación del ala norte estaba bloqueada por mobiliario."
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="corrective_action">
          Acción correctiva requerida
        </label>
        <textarea
          id="corrective_action"
          name="corrective_action"
          required
          maxLength={ACCION_MAX_LARGO}
          rows={3}
          placeholder="Ej. despejar y señalizar la ruta antes del próximo simulacro."
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="owner_id">
            Owner (responsable de cerrarlo)
          </label>
          <select
            id="owner_id"
            name="owner_id"
            required
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Elige un owner…
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="deadline">
            Fecha límite
          </label>
          <input
            id="deadline"
            name="deadline"
            type="date"
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar hallazgo"}
        </button>
      </div>

      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
