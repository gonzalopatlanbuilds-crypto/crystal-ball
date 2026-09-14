"use client";

import { useActionState } from "react";
import type { ConsultaFormState } from "@/app/consulta/actions";
import { FOLIO_MAX_LARGO } from "@/lib/consulta";

interface Props {
  action: (state: ConsultaFormState, formData: FormData) => Promise<ConsultaFormState>;
}

export default function ConsultaForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<ConsultaFormState, FormData>(
    action,
    undefined
  );

  if (state?.status === "encontrado") {
    const { resultado } = state;
    const fecha = new Date(resultado.createdAt).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return (
      <main className="flex min-h-screen flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-zinc-500">Resultado — Datos simulados</p>
          <p className="mt-2 text-2xl font-bold tracking-widest text-zinc-900">
            {resultado.folio}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {resultado.patientFirstName} · {fecha}
          </p>

          <span
            className={
              resultado.riesgo.nivel === "alto"
                ? "mt-6 inline-block rounded-full bg-red-100 px-4 py-1.5 text-sm font-medium text-red-700"
                : "mt-6 inline-block rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-700"
            }
          >
            Riesgo {resultado.riesgo.nivel === "alto" ? "alto" : "bajo"}
          </span>

          <p className="mt-4 text-sm text-zinc-600">
            Lectura de glucosa: {resultado.glucoseMgdl} mg/dL
          </p>

          <p className="mt-6 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-500">
            La explicación en lenguaje simple y el siguiente paso concreto llegan en la
            siguiente feature.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-6">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold text-zinc-900">Consultar mi resultado</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Sin login, sin cuenta, sin app. Ingresa tu folio y tu apellido para ver tu resultado.
        </p>

        <div className="mt-6 space-y-3 text-left">
          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="folio">
              Folio
            </label>
            <input
              id="folio"
              name="folio"
              maxLength={FOLIO_MAX_LARGO}
              placeholder="MX-XXXX-XXX"
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700" htmlFor="apellido">
              Apellido
            </label>
            <input
              id="apellido"
              name="apellido"
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Buscando…" : "Buscar"}
        </button>

        {state?.status === "error" && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      </form>
    </main>
  );
}
