"use client";

import { useActionState } from "react";
import Link from "next/link";
import { guardarSupuesto, type SupuestoState } from "@/app/modelo/supuestos/actions";
import {
  CATALOGO,
  ESTADOS,
  ETIQUETA_ESTADO,
  NOTA_MAX,
  type ClaveSupuesto,
  type ValoresSupuesto,
} from "@/lib/supuestos";

interface Props {
  // Editar: id + clave fija. Crear: las claves que todavía no existen.
  id?: string;
  inicial: ValoresSupuesto;
  clavesDisponibles?: ClaveSupuesto[];
}

const campo = "mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900";

export default function FormularioSupuesto({ id, inicial, clavesDisponibles }: Props) {
  const [state, action, pending] = useActionState<SupuestoState, FormData>(guardarSupuesto, undefined);
  const errores = state?.errores ?? {};
  const valores = state?.valores ?? inicial;
  const claveFija = id ? (valores.key as ClaveSupuesto) : null;
  const unidad = claveFija && CATALOGO[claveFija] ? CATALOGO[claveFija].unidad : null;

  const borde = (k: keyof ValoresSupuesto) => (errores[k] ? "border-red-600" : "border-zinc-300");
  const error = (k: keyof ValoresSupuesto) =>
    errores[k] ? (
      <p id={`${k}-error`} className="mt-1 text-sm text-red-700">
        {errores[k]}
      </p>
    ) : null;
  const aria = (k: keyof ValoresSupuesto) => ({
    "aria-invalid": !!errores[k],
    "aria-describedby": errores[k] ? `${k}-error` : undefined,
  });

  return (
    // `key` cambia con cada respuesta del servidor: React 19 resetea un
    // <form> con action después de enviarlo; sin esto se perdería lo
    // escrito (mismo patrón que w09).
    <form action={action} key={JSON.stringify(state ?? {})} noValidate className="space-y-4">
      {id && <input type="hidden" name="id" value={id} />}

      {claveFija ? (
        <div>
          <p className="text-sm font-medium text-zinc-700">Supuesto</p>
          <p className="mt-1 text-base text-zinc-900">{CATALOGO[claveFija]?.etiqueta ?? claveFija}</p>
          <input type="hidden" name="key" value={claveFija} />
        </div>
      ) : (
        <div>
          <label htmlFor="key" className="block text-sm font-medium text-zinc-700">
            Supuesto
          </label>
          <select id="key" name="key" defaultValue={valores.key} {...aria("key")} className={`${campo} ${borde("key")}`}>
            <option value="">Elige uno…</option>
            {(clavesDisponibles ?? []).map((k) => (
              <option key={k} value={k}>
                {CATALOGO[k].etiqueta} ({CATALOGO[k].unidad})
              </option>
            ))}
          </select>
          {error("key")}
        </div>
      )}

      <div>
        <label htmlFor="value_num" className="block text-sm font-medium text-zinc-700">
          Valor{unidad ? ` (${unidad})` : ""}
        </label>
        <input
          id="value_num"
          name="value_num"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={valores.value_num}
          placeholder="Ej. 150 o 2,5"
          {...aria("value_num")}
          className={`${campo} ${borde("value_num")}`}
        />
        {error("value_num") ?? <p className="mt-1 text-xs text-zinc-500">Sin separador de miles: 2000, no 2,000.</p>}
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-700">Estado</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {ESTADOS.map((e) => (
            <label key={e} className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm">
              <input type="radio" name="status" value={e} defaultChecked={valores.status === e} />
              {ETIQUETA_ESTADO[e]}
            </label>
          ))}
        </div>
        {error("status") ?? (
          <p className="mt-1 text-xs text-zinc-500">
            &ldquo;Sustentado&rdquo; exige URL y fecha de la fuente. &ldquo;Débil&rdquo; e &ldquo;inventado&rdquo; pueden ir sin fuente.
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor="source_url" className="block text-sm font-medium text-zinc-700">
          URL de la fuente
        </label>
        <input
          id="source_url"
          name="source_url"
          type="url"
          inputMode="url"
          autoComplete="off"
          defaultValue={valores.source_url}
          placeholder="https://…"
          {...aria("source_url")}
          className={`${campo} ${borde("source_url")}`}
        />
        {error("source_url")}
      </div>

      <div>
        <label htmlFor="source_date" className="block text-sm font-medium text-zinc-700">
          Fecha de la fuente
        </label>
        <input
          id="source_date"
          name="source_date"
          type="date"
          defaultValue={valores.source_date}
          {...aria("source_date")}
          className={`${campo} ${borde("source_date")}`}
        />
        {error("source_date")}
      </div>

      <div>
        <label htmlFor="note" className="block text-sm font-medium text-zinc-700">
          Nota (opcional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={valores.note}
          {...aria("note")}
          className={`${campo} ${borde("note")}`}
        />
        {error("note") ?? <p className="mt-1 text-xs text-zinc-500">Máximo {NOTA_MAX} caracteres.</p>}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-[#0b5e52] px-4 py-3 text-base font-semibold text-white hover:bg-[#094c43] disabled:opacity-50"
        >
          {pending ? "Guardando…" : id ? "Guardar cambios" : "Agregar supuesto"}
        </button>
        {id && (
          <Link
            href="/modelo/supuestos"
            className="rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-700 hover:bg-zinc-50"
          >
            Cancelar
          </Link>
        )}
      </div>
      {state?.mensaje && <p className="text-sm text-red-700">{state.mensaje}</p>}
    </form>
  );
}
