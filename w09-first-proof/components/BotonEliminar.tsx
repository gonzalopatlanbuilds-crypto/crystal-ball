"use client";

import { useActionState, useState } from "react";
import { eliminarExpediente, type EliminarState } from "@/app/(app)/entregas/actions";

// Dos pasos dentro de la página, sin confirm() del navegador.
export default function BotonEliminar() {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pending] = useActionState<EliminarState, FormData>(eliminarExpediente, undefined);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full rounded-xl border border-orange-700 bg-white px-4 py-3 text-base text-orange-800 hover:bg-orange-50"
      >
        Solicitar eliminación de mi expediente
      </button>
    );
  }

  return (
    <form action={action} className="rounded-xl border border-orange-700 bg-orange-50 p-4">
      <input type="hidden" name="confirmo" value="si" />
      <p className="text-sm text-orange-950">
        Se borrarán <strong>todas</strong> tus entregas, sus revisiones y este expediente. No se puede deshacer.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-lg bg-orange-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {pending ? "Borrando…" : "Sí, borrar todo"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-700"
        >
          Cancelar
        </button>
      </div>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
