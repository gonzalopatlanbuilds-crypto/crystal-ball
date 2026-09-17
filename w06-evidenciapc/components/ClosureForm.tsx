"use client";

import { useState } from "react";
import { useActionState } from "react";
import type { ClosureFormState } from "@/app/(app)/closures/actions";
import { CIERRE_DESCRIPCION_MAX_LARGO, FOTO_MAX_BYTES } from "@/lib/closures";

interface Props {
  findingId: string;
  action: (state: ClosureFormState, formData: FormData) => Promise<ClosureFormState>;
}

const FOTO_MAX_MB = FOTO_MAX_BYTES / (1024 * 1024);

export default function ClosureForm({ findingId, action }: Props) {
  const [state, formAction, pending] = useActionState<ClosureFormState, FormData>(
    action,
    undefined
  );
  // Avisa del límite de tamaño antes de intentar enviar — sin esto, una
  // foto grande fallaba con un 413 genérico de Next.js (el body de la
  // Server Action se rechaza antes de que corra `enviarCierre`), en vez
  // de un mensaje que explique qué pasó.
  const [photoError, setPhotoError] = useState<string | null>(null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (photoError) e.preventDefault();
      }}
      className="mt-6 rounded-xl border border-zinc-200 bg-white p-5"
    >
      <input type="hidden" name="finding_id" value={findingId} />
      <h2 className="text-sm font-semibold text-zinc-900">Enviar evidencia de cierre</h2>
      <p className="mt-1 text-xs text-zinc-500">
        La foto es obligatoria — un verificador independiente (nunca tú)
        revisará esta evidencia.
      </p>

      <div className="mt-4">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="photo">
          Foto de evidencia
        </label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          required
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && file.size > FOTO_MAX_BYTES) {
              setPhotoError(
                `Esta foto pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB — el máximo es ${FOTO_MAX_MB} MB. Elige otra o comprímela.`
              );
            } else {
              setPhotoError(null);
            }
          }}
          className="mt-1 w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        {photoError && <p className="mt-2 text-sm text-red-600">{photoError}</p>}
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="closure_description">
          Descripción del cierre
        </label>
        <textarea
          id="closure_description"
          name="description"
          required
          rows={3}
          maxLength={CIERRE_DESCRIPCION_MAX_LARGO}
          placeholder="Ej. se despejó la ruta y se instaló señalización nueva."
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending || Boolean(photoError)}
        className="mt-4 rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Enviar a revisión"}
      </button>

      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
