"use client";

import { useActionState } from "react";
import { registrarEvidencia, type EvidenciaState } from "@/app/modelo/pagador/actions";
import { DESCRIPCION_MAX, REFERENCIA_MAX, TIPOS_EVIDENCIA, type ValoresEvidencia } from "@/lib/pagador";

const campo = "mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900";
const INICIAL: ValoresEvidencia = { kind: "", description: "", document_ref: "", recorded_on: "" };

export default function FormularioEvidencia({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState<EvidenciaState, FormData>(registrarEvidencia, undefined);
  const errores = state?.errores ?? {};
  const valores = state?.valores ?? INICIAL;

  const borde = (k: keyof ValoresEvidencia) => (errores[k] ? "border-red-600" : "border-zinc-300");
  const aria = (k: keyof ValoresEvidencia) => ({
    "aria-invalid": !!errores[k],
    "aria-describedby": errores[k] ? `${k}-error` : undefined,
  });
  const error = (k: keyof ValoresEvidencia) =>
    errores[k] ? (
      <p id={`${k}-error`} className="mt-1 text-sm text-red-700">
        {errores[k]}
      </p>
    ) : null;

  return (
    // `key`: React 19 resetea el <form> tras enviarlo; sin esto se
    // perdería lo escrito cuando hay un error (patrón de w09).
    <form action={action} key={JSON.stringify(state ?? {})} noValidate className="space-y-4">
      <div>
        <label htmlFor="kind" className="block text-sm font-medium text-zinc-700">
          Tipo de evidencia
        </label>
        <select id="kind" name="kind" defaultValue={valores.kind} {...aria("kind")} className={`${campo} ${borde("kind")}`}>
          <option value="">Elige uno…</option>
          {Object.entries(TIPOS_EVIDENCIA).map(([k, etiqueta]) => (
            <option key={k} value={k}>
              {etiqueta}
            </option>
          ))}
        </select>
        {error("kind")}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-zinc-700">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={valores.description}
          placeholder="Quién pagaría, cuánto y por cuánto tiempo (simulado)."
          {...aria("description")}
          className={`${campo} ${borde("description")}`}
        />
        {error("description") ?? (
          <p className="mt-1 text-xs text-zinc-500">Máximo {DESCRIPCION_MAX} caracteres. No se publica.</p>
        )}
      </div>

      <div>
        <label htmlFor="document_ref" className="block text-sm font-medium text-zinc-700">
          Referencia del documento
        </label>
        <input
          id="document_ref"
          name="document_ref"
          autoComplete="off"
          defaultValue={valores.document_ref}
          placeholder="Folio, nombre del archivo o enlace"
          {...aria("document_ref")}
          className={`${campo} ${borde("document_ref")}`}
        />
        {error("document_ref") ?? (
          <p className="mt-1 text-xs text-zinc-500">Máximo {REFERENCIA_MAX} caracteres. No se publica.</p>
        )}
      </div>

      <div>
        <label htmlFor="recorded_on" className="block text-sm font-medium text-zinc-700">
          Fecha del documento
        </label>
        <input
          id="recorded_on"
          name="recorded_on"
          type="date"
          defaultValue={valores.recorded_on}
          {...aria("recorded_on")}
          className={`${campo} ${borde("recorded_on")}`}
        />
        {error("recorded_on")}
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-700">Quién la registra</p>
        <p className="mt-1 text-base break-all text-zinc-900">{email ?? "Tu cuenta"}</p>
        <p className="mt-0.5 text-xs text-zinc-500">Lo pone el sistema con tu sesión; no se puede cambiar.</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#0b5e52] px-4 py-3 text-base font-semibold text-white hover:bg-[#094c43] disabled:opacity-50"
      >
        {pending ? "Registrando…" : "Registrar evidencia"}
      </button>
      {state?.mensaje && <p className="text-sm text-red-700">{state.mensaje}</p>}
      {state?.ok && <p className="text-sm text-emerald-800">Evidencia registrada.</p>}
    </form>
  );
}
