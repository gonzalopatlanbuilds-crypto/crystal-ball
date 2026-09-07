"use client";

import { useState, useTransition } from "react";
import { generateBorderlineExplanation } from "@/app/(empleador)/criteria/[id]/candidates/actions";

interface Props {
  candidateScoreId: string;
}

export default function BorderlineExplanation({ candidateScoreId }: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generar() {
    setError(null);
    startTransition(async () => {
      const result = await generateBorderlineExplanation(candidateScoreId);
      if (result.success) {
        setExplanation(result.explanation);
      } else {
        setError(result.error);
      }
    });
  }

  if (explanation) {
    return (
      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
          Explicación generada por IA — simulada, no es un veredicto
        </p>
        <p className="mt-2 text-sm text-violet-900">{explanation}</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={generar}
        disabled={pending}
        className="rounded-lg border border-violet-300 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
      >
        {pending ? "Generando…" : "✨ Generar explicación (IA)"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
