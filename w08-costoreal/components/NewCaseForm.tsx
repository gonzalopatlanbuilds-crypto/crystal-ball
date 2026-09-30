"use client";

import { useActionState } from "react";
import { crearCaso, type CrearCasoState } from "@/app/(app)/cases/actions";
import { CASE_TYPES, CASE_TYPE_LABELS } from "@/lib/casos";

export default function NewCaseForm() {
  const [state, action, pending] = useActionState<CrearCasoState, FormData>(crearCaso, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-zinc-600" htmlFor="case_type">
          Tipo de caso
        </label>
        <select
          id="case_type"
          name="case_type"
          defaultValue={CASE_TYPES[0]}
          className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          {CASE_TYPES.map((t) => (
            <option key={t} value={t}>
              {CASE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sky-900 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
      >
        {pending ? "Creando…" : "+ Nuevo caso simulado"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
