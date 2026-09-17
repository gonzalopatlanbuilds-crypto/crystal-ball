"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  crearOrganizacion,
  unirseOrganizacion,
  type CrearOrgState,
  type UnirseOrgState,
} from "@/app/onboarding/actions";

export default function OnboardingForms() {
  const [crearState, crearAction, crearPending] = useActionState<CrearOrgState, FormData>(
    crearOrganizacion,
    undefined
  );
  const [unirseState, unirseAction, unirsePending] = useActionState<UnirseOrgState, FormData>(
    unirseOrganizacion,
    undefined
  );

  if (crearState && "joinCode" in crearState) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          {crearState.orgName} está lista
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Comparte este código con el resto de tu equipo (owners y
          verificadores) para que se unan a la misma organización.
        </p>
        <p className="mt-4 font-mono text-2xl font-semibold tracking-wider text-zinc-900">
          {crearState.joinCode}
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Ir al panel
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <form
        action={crearAction}
        className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-zinc-900">Crear organización</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Si eres la primera persona de tu escuela en entrar.
        </p>
        <label className="mt-4 block text-sm font-medium text-zinc-700" htmlFor="name">
          Nombre de la escuela u organización
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          placeholder="Escuela Simulada Bosques de Aragón"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={crearPending}
          className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {crearPending ? "Creando…" : "Crear organización"}
        </button>
        {crearState && "error" in crearState && (
          <p className="mt-3 text-sm text-red-600">{crearState.error}</p>
        )}
      </form>

      <form
        action={unirseAction}
        className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-zinc-900">Unirme con código</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Si alguien de tu escuela ya creó la organización.
        </p>
        <label className="mt-4 block text-sm font-medium text-zinc-700" htmlFor="join_code">
          Código de la organización
        </label>
        <input
          id="join_code"
          name="join_code"
          required
          placeholder="ABC-234"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono uppercase"
        />
        <button
          type="submit"
          disabled={unirsePending}
          className="mt-4 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {unirsePending ? "Uniendo…" : "Unirme"}
        </button>
        {unirseState?.error && <p className="mt-3 text-sm text-red-600">{unirseState.error}</p>}
      </form>
    </div>
  );
}
