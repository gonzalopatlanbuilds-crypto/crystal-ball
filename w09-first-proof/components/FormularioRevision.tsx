"use client";

import { useActionState, useState } from "react";
import { enviarRevision, type RevisionState } from "@/app/(app)/revisar/actions";
import { CONFLICTO_MAX, MOTIVO_MAX, NOTA_MAX } from "@/lib/validacion-revision";
import { RECOMENDACIONES } from "@/lib/expediente";
import { ETIQUETA_IA } from "@/components/ObservacionesIA";

interface Props {
  submissionId: string;
  observaciones: { id: string; texto: string }[];
}

const campo = "mt-1 w-full rounded-lg border border-zinc-300 bg-stone-50 px-3 py-2 text-sm text-zinc-900";

export default function FormularioRevision({ submissionId, observaciones }: Props) {
  const [state, action, pending] = useActionState<RevisionState, FormData>(
    enviarRevision.bind(null, submissionId),
    undefined
  );
  // Estado controlado: React 19 resetea el <form> tras enviarlo y, si hay
  // un error de validación, la persona no debe perder lo que eligió.
  const [decisiones, setDecisiones] = useState<Record<string, string>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [conflictoTipo, setConflictoTipo] = useState("");
  const [conflictoTexto, setConflictoTexto] = useState("");
  const [recomendacion, setRecomendacion] = useState("");
  const [nota, setNota] = useState("");
  const e = state?.errores ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {observaciones.length > 0 && (
        <fieldset className="rounded-xl border border-sky-600/40 bg-sky-50/60 p-4">
          <legend className="px-1 text-sm font-semibold text-zinc-900">Observaciones preparadas por IA</legend>
          <p className="text-xs text-zinc-600">{ETIQUETA_IA} Confirma o descarta cada una.</p>
          {observaciones.map((o) => (
            <div key={o.id} className="mt-3 border-t border-sky-100 pt-3 first:border-0 first:pt-0">
              <p className="text-sm text-zinc-800">{o.texto}</p>
              <div className="mt-1 flex gap-4 text-sm">
                {(["confirmada", "descartada"] as const).map((d) => (
                  <label key={d} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={`decision_${o.id}`}
                      value={d}
                      checked={decisiones[o.id] === d}
                      onChange={() => setDecisiones({ ...decisiones, [o.id]: d })}
                    />
                    {d === "confirmada" ? "Confirmar" : "Descartar"}
                  </label>
                ))}
              </div>
              {decisiones[o.id] === "descartada" && (
                <input
                  name={`motivo_${o.id}`}
                  value={motivos[o.id] ?? ""}
                  onChange={(ev) => setMotivos({ ...motivos, [o.id]: ev.target.value })}
                  maxLength={MOTIVO_MAX}
                  placeholder="Motivo (opcional), p. ej. no aparece en el texto"
                  className={campo}
                />
              )}
            </div>
          ))}
          {e.observaciones && <p className="mt-2 text-sm text-red-600">{e.observaciones}</p>}
        </fieldset>
      )}

      <fieldset className="rounded-xl border border-zinc-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-zinc-900">Conflicto de interés (obligatorio)</legend>
        <label className="mt-1 flex items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="conflicto_tipo"
            value="ninguno"
            checked={conflictoTipo === "ninguno"}
            onChange={() => setConflictoTipo("ninguno")}
          />
          Ninguno
        </label>
        <label className="mt-1 flex items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="conflicto_tipo"
            value="si"
            checked={conflictoTipo === "si"}
            onChange={() => setConflictoTipo("si")}
          />
          Sí, lo declaro:
        </label>
        {conflictoTipo === "si" && (
          <input
            name="conflicto_texto"
            value={conflictoTexto}
            onChange={(ev) => setConflictoTexto(ev.target.value)}
            maxLength={CONFLICTO_MAX}
            placeholder="Describe el conflicto"
            className={campo}
          />
        )}
        {e.conflicto && <p className="mt-2 text-sm text-red-600">{e.conflicto}</p>}
      </fieldset>

      <fieldset className="rounded-xl border border-zinc-200 bg-white p-4">
        <legend className="px-1 text-sm font-semibold text-zinc-900">Recomendación</legend>
        {(Object.keys(RECOMENDACIONES) as (keyof typeof RECOMENDACIONES)[]).map((k) => (
          <label key={k} className="mt-1 flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="recomendacion"
              value={k}
              checked={recomendacion === k}
              onChange={() => setRecomendacion(k)}
            />
            {RECOMENDACIONES[k]}
          </label>
        ))}
        <p className="mt-2 text-xs text-zinc-500">No hay opción de rechazar: esta revisión nunca cierra una puerta.</p>
        {e.recomendacion && <p className="mt-2 text-sm text-red-600">{e.recomendacion}</p>}
      </fieldset>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <label htmlFor="nota" className="text-sm font-semibold text-zinc-900">
          Nota (obligatoria)
        </label>
        <textarea
          id="nota"
          name="nota"
          rows={4}
          maxLength={NOTA_MAX + 50}
          value={nota}
          onChange={(ev) => setNota(ev.target.value)}
          className={campo}
        />
        <p className={`mt-1 text-xs ${e.nota ? "text-red-600" : "text-zinc-500"}`}>
          {e.nota ?? `Hasta ${NOTA_MAX} caracteres. Describe lo que viste en la explicación.`}
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-teal-800 px-4 py-3.5 text-base font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Firmar revisión"}
      </button>
      {state?.mensaje && <p className="text-sm text-red-600">{state.mensaje}</p>}
    </form>
  );
}
