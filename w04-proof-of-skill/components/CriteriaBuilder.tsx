"use client";

import { useActionState, useState } from "react";
import type { CriteriaFormState } from "@/app/(empleador)/criteria/actions";
import { ETIQUETA_MAX_LARGO, MINIMO_CRITERIOS, ROL_MAX_LARGO } from "@/lib/criteria";

interface FilaCriterio {
  id: string;
  label: string;
  weight: string;
}

interface Props {
  action: (state: CriteriaFormState, formData: FormData) => Promise<CriteriaFormState>;
  valoresIniciales?: { roleName: string; criteria: { label: string; weight: number }[] };
  textoBoton: string;
}

function nuevaFila(label = "", weight = "50"): FilaCriterio {
  return { id: crypto.randomUUID(), label, weight };
}

function errorPeso(valor: string): string | null {
  if (valor.trim() === "") return "Escribe un peso.";
  if (!/^-?\d+$/.test(valor.trim())) return "El peso debe ser un número entero, sin letras ni símbolos.";
  const num = Number(valor);
  if (num < 0 || num > 100) return "El peso debe estar entre 0 y 100.";
  return null;
}

export default function CriteriaBuilder({ action, valoresIniciales, textoBoton }: Props) {
  const [roleName, setRoleName] = useState(valoresIniciales?.roleName ?? "");
  const [filas, setFilas] = useState<FilaCriterio[]>(() =>
    valoresIniciales?.criteria.length
      ? valoresIniciales.criteria.map((c) => nuevaFila(c.label, String(c.weight)))
      : [nuevaFila(), nuevaFila(), nuevaFila()]
  );
  const [state, formAction, pending] = useActionState<CriteriaFormState, FormData>(
    action,
    undefined
  );

  function actualizarFila(id: string, cambios: Partial<Pick<FilaCriterio, "label" | "weight">>) {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  function agregarFila() {
    setFilas((prev) => [...prev, nuevaFila()]);
  }

  function eliminarFila(id: string) {
    setFilas((prev) => prev.filter((f) => f.id !== id));
  }

  const payloadCriterios = JSON.stringify(
    filas.map((f) => ({ label: f.label, weight: Number(f.weight) }))
  );

  return (
    <form action={formAction} className="mx-auto max-w-2xl p-6">
      <input type="hidden" name="criteria" value={payloadCriterios} />

      <label className="block text-sm font-medium text-zinc-700" htmlFor="role_name">
        Nombre del rol
      </label>
      <input
        id="role_name"
        name="role_name"
        value={roleName}
        onChange={(e) => setRoleName(e.target.value)}
        maxLength={ROL_MAX_LARGO}
        placeholder="Ej. Backend Developer (Jr.)"
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-lg font-semibold text-zinc-900"
      />
      <p className="mt-2 text-sm text-zinc-500">
        Pondera cada criterio. Los candidatos se califican contra TUS pesos, no un score genérico.
      </p>

      <div className="mt-6 space-y-3">
        {filas.map((fila, idx) => {
          const pesoInvalido = errorPeso(fila.weight);
          const pesoParaSlider = /^\d+$/.test(fila.weight.trim())
            ? Math.min(100, Math.max(0, Number(fila.weight)))
            : 0;
          return (
            <div key={fila.id} className="rounded-xl bg-zinc-100 p-4">
              <div className="flex items-center gap-3">
                <input
                  value={fila.label}
                  onChange={(e) => actualizarFila(fila.id, { label: e.target.value })}
                  maxLength={ETIQUETA_MAX_LARGO}
                  placeholder={`Criterio ${idx + 1}`}
                  aria-label={`Etiqueta del criterio ${idx + 1}`}
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pesoParaSlider}
                  onChange={(e) => actualizarFila(fila.id, { weight: e.target.value })}
                  aria-label={`Deslizador de peso del criterio ${idx + 1}`}
                  className="w-40"
                />
                <input
                  value={fila.weight}
                  onChange={(e) => actualizarFila(fila.id, { weight: e.target.value })}
                  inputMode="numeric"
                  aria-label={`Peso del criterio ${idx + 1}`}
                  className="w-16 rounded-lg border border-zinc-300 px-2 py-1 text-right text-sm"
                />
                <span className="text-sm text-zinc-500">%</span>
                <button
                  type="button"
                  onClick={() => eliminarFila(fila.id)}
                  aria-label={`Eliminar criterio ${idx + 1}`}
                  className="text-lg leading-none text-zinc-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
              {pesoInvalido && <p className="mt-1.5 text-sm text-red-600">{pesoInvalido}</p>}
            </div>
          );
        })}
      </div>

      {filas.length < MINIMO_CRITERIOS && (
        <p className="mt-2 text-sm text-amber-600">
          Necesitas al menos {MINIMO_CRITERIOS} criterios para guardar.
        </p>
      )}

      <button
        type="button"
        onClick={agregarFila}
        className="mt-3 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
      >
        + Agregar criterio
      </button>

      <div className="mt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Guardando…" : textoBoton}
        </button>
      </div>

      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

      <hr className="mt-8 border-zinc-200" />
      <p className="mt-4 text-sm text-zinc-500">
        Estos pesos vienen de ti, no de ProofLayer. El score de cada candidato se calcula contra
        esta configuración exacta.
      </p>
    </form>
  );
}
