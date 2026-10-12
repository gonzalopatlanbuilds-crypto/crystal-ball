"use client";

import { useActionState } from "react";
import { enviarEntrega, type EntregaState } from "@/app/(app)/caso/actions";
import { CALCULOS, PREGUNTA_EXPLICACION } from "@/lib/caso";
import { EXPLICACION_MAX, EXPLICACION_MIN } from "@/lib/validacion";

const campo =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-stone-50 px-3 py-2.5 text-base text-zinc-900";

export default function FormularioCaso() {
  const [state, action, pending] = useActionState<EntregaState, FormData>(enviarEntrega, undefined);
  const errores = state?.errores ?? {};
  const valores = state?.valores;

  return (
    // `key` cambia con cada respuesta del servidor: React 19 resetea un
    // <form> con action después de enviarlo, así que sin esto los
    // defaultValue no volverían a aplicarse y se perdería lo escrito.
    <form action={action} key={JSON.stringify(valores ?? {})} className="mt-5" noValidate>
      <h2 className="text-base font-semibold text-zinc-900">Cálculos (el sistema los revisa solo)</h2>
      {CALCULOS.map((c, i) => (
        <div key={c.clave} className="mt-3">
          <label htmlFor={c.clave} className="block text-sm text-zinc-700">
            {i + 1}. {c.etiqueta}
          </label>
          <input
            id={c.clave}
            name={c.clave}
            inputMode="decimal"
            autoComplete="off"
            defaultValue={valores?.[c.clave] ?? ""}
            aria-invalid={!!errores[c.clave]}
            aria-describedby={errores[c.clave] ? `${c.clave}-error` : undefined}
            className={`${campo} ${errores[c.clave] ? "border-red-500" : ""}`}
          />
          {errores[c.clave] && (
            <p id={`${c.clave}-error`} className="mt-1 text-sm text-red-600">
              {errores[c.clave]}
            </p>
          )}
        </div>
      ))}

      <label htmlFor="explanation" className="mt-6 block text-base font-semibold text-zinc-900">
        Tu explicación (3 a 5 oraciones, en tus palabras)
      </label>
      <p className="mt-0.5 text-sm text-zinc-600">{PREGUNTA_EXPLICACION}</p>
      <textarea
        id="explanation"
        name="explanation"
        rows={6}
        maxLength={EXPLICACION_MAX + 200}
        defaultValue={valores?.explanation ?? ""}
        aria-invalid={!!errores.explanation}
        aria-describedby="explanation-ayuda"
        className={`${campo} ${errores.explanation ? "border-red-500" : ""}`}
      />
      <p id="explanation-ayuda" className={`mt-1 text-sm ${errores.explanation ? "text-red-600" : "text-zinc-500"}`}>
        {errores.explanation ?? `Entre ${EXPLICACION_MIN} y ${EXPLICACION_MAX} caracteres.`}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-xl bg-teal-800 px-4 py-3.5 text-base font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Enviar a revisión humana"}
      </button>
      {state?.mensaje && <p className="mt-3 text-sm text-red-600">{state.mensaje}</p>}

      <p className="mt-4 text-sm text-zinc-500">
        Tu nombre no se muestra a quien revisa. Puedes eliminar tu expediente cuando quieras.
      </p>
    </form>
  );
}
