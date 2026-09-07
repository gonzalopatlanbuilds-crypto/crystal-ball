"use client";

import { useState, useTransition } from "react";
import { deleteCandidateScore } from "@/app/(empleador)/criteria/[id]/candidates/actions";

interface Props {
  candidateScoreId: string;
  criteriaSetId: string;
  candidateName: string;
}

export default function DeleteCandidateButton({
  candidateScoreId,
  criteriaSetId,
  candidateName,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const confirmado = window.confirm(
      `¿Eliminar el scorecard de "${candidateName}"? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteCandidateScore(candidateScoreId, criteriaSetId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={`Eliminar candidato ${candidateName}`}
        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "Eliminando…" : "Eliminar"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
