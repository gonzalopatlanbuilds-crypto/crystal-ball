"use client";

import { startTransition, useActionState, useState } from "react";
import { guardarDecision, type DecisionState } from "@/app/validador/hallazgos/actions";
import { ETIQUETA_DECISION, NOTA_MAX, SIGNIFICADO_DECISION, type Decision } from "@/lib/decisiones";

// Confirmar o descartar con nota obligatoria. El servidor y la base vuelven
// a exigir la nota: `required` aquí es solo comodidad.
export default function FormularioDecision({ findingId }: { findingId: string }) {
  const [estado, accion, guardando] = useActionState<DecisionState, FormData>(guardarDecision, undefined);
  // Tras guardar, los campos se montan de nuevo (vacíos): la siguiente
  // decisión es otra fila del historial, no una edición de esta.
  const clave = estado && "ok" in estado ? estado.guardadaEn : "inicial";

  // onSubmit + startTransition en vez de <form action>: con `action`, React
  // 19 resetea el formulario al terminar CUALQUIER acción, también con
  // error. El radio quedaba desmarcado en el DOM mientras el estado de React
  // lo seguía mostrando elegido, y el `required` bloqueaba el siguiente
  // envío sin aviso visible (bug real de la prueba en el navegador). Así, un
  // error conserva la decisión y la nota.
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => accion(datos));
  }

  return (
    <form onSubmit={enviar} className="mt-2">
      <input type="hidden" name="finding_id" value={findingId} />
      <Campos key={clave} guardando={guardando} />
      <div aria-live="polite">
        {estado && "error" in estado && <p className="mt-2 text-sm text-red-700">{estado.error}</p>}
        {estado && "ok" in estado && <p className="mt-2 text-sm text-teal-800">Decisión guardada en el historial.</p>}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Esta decisión queda en el historial. No se puede borrar, solo corregir con una nueva nota.
      </p>
    </form>
  );
}

function Campos({ guardando }: { guardando: boolean }) {
  const [decision, setDecision] = useState<Decision | null>(null);

  // Sin `required` en el radio: es invisible (sr-only) y el aviso del
  // navegador no se vería. Si no se elige nada, el servidor responde
  // "Elige confirmar o descartar." en un mensaje visible.
  const boton = (d: Decision, estilo: string) => (
    <label
      className={`flex cursor-pointer items-center justify-center rounded-lg border-2 px-3 py-3 text-center text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#0b5e52] ${
        decision === d ? estilo : "border-zinc-300 text-zinc-600"
      }`}
    >
      <input type="radio" name="decision" value={d} className="sr-only" checked={decision === d} onChange={() => setDecision(d)} />
      {ETIQUETA_DECISION[d]}
    </label>
  );

  return (
    <>
      <fieldset>
        <legend className="sr-only">Decisión</legend>
        <div className="grid grid-cols-2 gap-3">
          {boton("confirmed", "border-[#0b5e52] bg-teal-50 text-[#0b5e52]")}
          {boton("discarded", "border-zinc-500 bg-zinc-100 text-zinc-800")}
        </div>
      </fieldset>
      {decision && <p className="mt-2 text-xs text-zinc-600">{SIGNIFICADO_DECISION[decision]}</p>}
      <label htmlFor="note" className="mt-4 block text-sm font-semibold text-zinc-900">
        Nota (obligatoria)
      </label>
      <textarea
        id="note"
        name="note"
        required
        maxLength={NOTA_MAX}
        rows={3}
        placeholder="Escribe por qué confirmas o descartas…"
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={guardando}
        className="mt-3 w-full rounded-lg bg-[#0b5e52] px-4 py-3 text-sm font-semibold text-white hover:bg-[#094c43] disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Guardar decisión"}
      </button>
    </>
  );
}
