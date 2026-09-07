"use client";

import { useActionState, useState } from "react";
import type { CandidateScoreFormState } from "@/app/(empleador)/criteria/[id]/candidates/actions";
import { NOMBRE_CANDIDATO_MAX_LARGO } from "@/lib/scoring";

interface Props {
  action: (state: CandidateScoreFormState, formData: FormData) => Promise<CandidateScoreFormState>;
  roleName: string;
  criterios: { label: string; weight: number }[];
}

function errorScore(valor: string): string | null {
  if (valor.trim() === "") return "Escribe un score.";
  if (!/^-?\d+$/.test(valor.trim())) return "El score debe ser un número entero, sin letras ni símbolos.";
  const num = Number(valor);
  if (num < 0 || num > 100) return "El score debe estar entre 0 y 100.";
  return null;
}

export default function CandidateScoreForm({ action, roleName, criterios }: Props) {
  const [candidateName, setCandidateName] = useState("");
  const [scores, setScores] = useState<string[]>(() => criterios.map(() => "50"));
  const [state, formAction, pending] = useActionState<CandidateScoreFormState, FormData>(
    action,
    undefined
  );

  const payloadScores = JSON.stringify(scores.map((s) => Number(s)));

  return (
    <form action={formAction} className="mx-auto max-w-2xl p-6">
      <input type="hidden" name="scores" value={payloadScores} />

      <p className="text-sm text-zinc-500">Calificando contra el rol: {roleName}</p>
      <label className="mt-1 block text-sm font-medium text-zinc-700" htmlFor="candidate_name">
        Nombre o alias de la persona candidata
      </label>
      <input
        id="candidate_name"
        name="candidate_name"
        value={candidateName}
        onChange={(e) => setCandidateName(e.target.value)}
        maxLength={NOMBRE_CANDIDATO_MAX_LARGO}
        placeholder="Ej. Mariana R."
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-lg font-semibold text-zinc-900"
      />
      <p className="mt-1 text-xs text-zinc-400">
        Usa un nombre de persona (ficticio), no el nombre del rol — en el scorecard, el rol y la
        persona candidata se muestran juntos y deben distinguirse a simple vista.
      </p>
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Datos simulados — este flujo no evalúa habilidades reales de nadie. Ingresa un score
        0–100 por criterio como si viniera de una evaluación de habilidades ya hecha.
      </p>

      <div className="mt-6 space-y-3">
        {criterios.map((c, idx) => {
          const valor = scores[idx];
          const invalido = errorScore(valor);
          return (
            <div key={idx} className="rounded-xl bg-zinc-100 p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-800">{c.label}</p>
                  <p className="text-xs text-zinc-500">peso {c.weight}%</p>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={/^\d+$/.test(valor.trim()) ? Math.min(100, Math.max(0, Number(valor))) : 0}
                  onChange={(e) =>
                    setScores((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))
                  }
                  aria-label={`Deslizador de score de ${c.label}`}
                  className="w-40"
                />
                <input
                  value={valor}
                  onChange={(e) =>
                    setScores((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))
                  }
                  inputMode="numeric"
                  aria-label={`Score de ${c.label}`}
                  className="w-16 rounded-lg border border-zinc-300 px-2 py-1 text-right text-sm"
                />
                <span className="text-sm text-zinc-500">/100</span>
              </div>
              {invalido && <p className="mt-1.5 text-sm text-red-600">{invalido}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? "Calculando…" : "Ver scorecard"}
        </button>
      </div>

      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
