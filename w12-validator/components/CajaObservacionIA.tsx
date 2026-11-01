"use client";

import { useState, useTransition } from "react";
import { pedirObservacionIA, type ObservacionState } from "@/app/validador/hallazgos/ia-actions";

// "Observación de IA (sin validar)": la etiqueta y la aclaración las pone
// la página, nunca el modelo. Se pide con un botón (cada consulta cuesta) y
// no se guarda: no es parte del historial ni de la decisión.
export default function CajaObservacionIA({ findingId }: { findingId: string }) {
  const [estado, setEstado] = useState<ObservacionState>(undefined);
  const [pidiendo, startTransition] = useTransition();

  return (
    <section className="mt-5">
      <h2 className="text-base font-semibold text-zinc-900">Observación de IA (sin validar)</h2>
      <div className="mt-2 rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm text-zinc-800" aria-live="polite">
        {estado && "observacion" in estado ? (
          <p>
            <span className="font-semibold">[!]</span> {estado.observacion}
          </p>
        ) : estado && "error" in estado ? (
          <p className="text-red-700">{estado.error}</p>
        ) : (
          <p className="text-zinc-600">Una IA puede sugerir qué podría explicar esta discrepancia. Es opcional.</p>
        )}
        <p className="mt-2 text-xs text-sky-900">
          No decide cuál valor es correcto, no resuelve el hallazgo y puede equivocarse. La decisión es tuya.
          {" "}En una prueba con causas sembradas nombró la causa en 9 de 10 casos, pero suele listar varias
          posibilidades y a veces omite la que importa: úsala como pista, no como filtro.
        </p>
        <button
          type="button"
          disabled={pidiendo}
          onClick={() => startTransition(async () => setEstado(await pedirObservacionIA(findingId)))}
          className="mt-3 rounded-lg border border-sky-400 bg-white px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50"
        >
          {pidiendo ? "Consultando…" : estado && "observacion" in estado ? "Pedir otra observación" : "Pedir observación de IA"}
        </button>
      </div>
    </section>
  );
}
