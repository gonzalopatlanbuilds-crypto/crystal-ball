"use client";

import { useActionState } from "react";
import { publicarLibro, type PublicarState } from "@/app/modelo/actions";

export default function BotonPublicar({ esOficial }: { esOficial: boolean }) {
  const [state, action, pending] = useActionState<PublicarState, FormData>(publicarLibro, undefined);

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending || !esOficial}
        className="w-full rounded-xl bg-[#0b5e52] px-4 py-3.5 text-base font-bold text-white hover:bg-[#094c43] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Publicando…" : "Publicar libro"}
      </button>
      {!esOficial && (
        <p className="mt-2 text-sm text-zinc-600">
          Solo la organización oficial puede publicar. Esta organización no lo es.
        </p>
      )}
      {state && "error" in state && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
      {state && "version" in state && (
        <p className="mt-2 text-sm text-emerald-800">
          Publicada la versión v{state.version}.{" "}
          <a href="/financiamiento" className="underline">
            Ver la página pública
          </a>
          .
        </p>
      )}
    </form>
  );
}
