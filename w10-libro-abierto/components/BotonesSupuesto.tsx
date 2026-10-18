"use client";

import { useActionState, useState } from "react";
import { eliminarSupuesto, sembrarEjemplo, type AccionSimpleState } from "@/app/modelo/supuestos/actions";

// Dos pasos dentro de la página, sin confirm() del navegador (w09).
export function BotonEliminarSupuesto({ id }: { id: string }) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pending] = useActionState<AccionSimpleState, FormData>(eliminarSupuesto, undefined);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full rounded-xl border border-red-700 bg-white px-4 py-3 text-base text-red-800 hover:bg-red-50"
      >
        Eliminar este supuesto
      </button>
    );
  }

  return (
    <form action={action} className="rounded-xl border border-red-700 bg-red-50 p-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-red-950">
        El modelo dejará de usar este valor; los resultados que dependan de él dirán &ldquo;no calculable&rdquo;.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-red-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Eliminando…" : "Sí, eliminar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-700"
        >
          Cancelar
        </button>
      </div>
      {state?.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function BotonSembrar({ faltan }: { faltan: number }) {
  const [state, action, pending] = useActionState<AccionSimpleState, FormData>(sembrarEjemplo, undefined);
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl border border-[#0b5e52] bg-white px-4 py-3 text-base text-[#0b5e52] hover:bg-teal-50 disabled:opacity-50"
      >
        {pending ? "Cargando…" : `Cargar ${faltan} valor${faltan === 1 ? "" : "es"} de ejemplo (inventados)`}
      </button>
      {state?.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
