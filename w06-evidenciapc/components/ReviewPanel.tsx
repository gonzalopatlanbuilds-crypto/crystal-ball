"use client";

import { useActionState } from "react";
import type { ReviewFormState } from "@/app/(app)/reviews/actions";
import { RECHAZO_MOTIVO_MAX_LARGO } from "@/lib/reviews";

interface Props {
  findingId: string;
  closureId: string;
  aprobarAction: (state: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
  rechazarAction: (state: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
}

export default function ReviewPanel({
  findingId,
  closureId,
  aprobarAction,
  rechazarAction,
}: Props) {
  const [aprobarState, aprobarFormAction, aprobarPending] = useActionState<
    ReviewFormState,
    FormData
  >(aprobarAction, undefined);
  const [rechazarState, rechazarFormAction, rechazarPending] = useActionState<
    ReviewFormState,
    FormData
  >(rechazarAction, undefined);

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-zinc-900">
        Revisión del verificador independiente
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Tú no cerraste este hallazgo — puedes aprobar o rechazar la
        evidencia de arriba. Al aprobar, el registro queda inmutable.
      </p>

      <form action={aprobarFormAction} className="mt-4">
        <input type="hidden" name="finding_id" value={findingId} />
        <input type="hidden" name="closure_id" value={closureId} />
        <button
          type="submit"
          disabled={aprobarPending}
          className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {aprobarPending ? "Aprobando…" : "Aprobar cierre"}
        </button>
        {aprobarState?.error && <p className="mt-2 text-sm text-red-600">{aprobarState.error}</p>}
      </form>

      <form action={rechazarFormAction} className="mt-4 border-t border-zinc-100 pt-4">
        <input type="hidden" name="finding_id" value={findingId} />
        <input type="hidden" name="closure_id" value={closureId} />
        <label className="block text-sm font-medium text-zinc-700" htmlFor="reason">
          Motivo del rechazo
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={2}
          maxLength={RECHAZO_MOTIVO_MAX_LARGO}
          placeholder="Ej. la foto no muestra la ruta de evacuación descrita."
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={rechazarPending}
          className="mt-2 rounded-lg border border-red-300 bg-white px-5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {rechazarPending ? "Rechazando…" : "Rechazar cierre"}
        </button>
        {rechazarState?.error && <p className="mt-2 text-sm text-red-600">{rechazarState.error}</p>}
      </form>
    </div>
  );
}
