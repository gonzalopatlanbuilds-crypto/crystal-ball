"use client";

import { useActionState } from "react";
import { pedirObservacionesIA, type AuditorState } from "@/app/modelo/auditor-actions";
import type { HallazgoReglas } from "@/lib/chequeo-reglas";
import { NOTA_UTILIDAD_IA } from "@/lib/avisos";

// La etiqueta "sin validar" y "La IA no calcula ni decide la viabilidad"
// las pone la página, nunca el modelo.
export default function CajaAuditor({ reglas }: { reglas: HallazgoReglas[] }) {
  const [state, action, pending] = useActionState<AuditorState, FormData>(pedirObservacionesIA, undefined);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-300 bg-white p-4">
        <h2 className="text-base font-bold text-zinc-900">Revisión por reglas</h2>
        <p className="mt-1 text-xs text-zinc-500">Determinista: supuestos que faltan o que no tienen fuente.</p>
        {reglas.length === 0 ? (
          <p className="mt-2 text-[15px] text-emerald-800">[OK] Todos los supuestos existen y tienen fuente.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-[15px] text-zinc-800">
            {reglas.map((h) => (
              <li key={h.clave}>[!] {h.texto}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-sky-300 bg-sky-50 p-4">
        <h2 className="text-base font-bold text-sky-900">Observaciones de IA (sin validar)</h2>
        <p className="mt-1 text-xs text-zinc-600">{NOTA_UTILIDAD_IA}</p>
        {state && "observaciones" in state && (
          state.observaciones.length === 0 ? (
            <p className="mt-2 text-[15px] text-zinc-800">La IA no señaló nada.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-[15px] text-zinc-800">
              {state.observaciones.map((o, i) => (
                <li key={i}>[!] {o.texto}</li>
              ))}
            </ul>
          )
        )}
        {state && "error" in state && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
        <form action={action} className="mt-3">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg border border-sky-700 bg-white px-4 py-2.5 text-sm font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50"
          >
            {pending ? "Consultando a la IA… (unos segundos)" : "Pedir observaciones de IA"}
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-600">La IA no calcula ni decide la viabilidad.</p>
      </section>
    </div>
  );
}
