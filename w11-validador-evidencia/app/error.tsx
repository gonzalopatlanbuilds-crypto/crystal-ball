"use client";

import { AVISO_SIMULADO } from "@/lib/avisos";

// Error inesperado en cualquier página: un mensaje en español y un botón
// para reintentar, en vez de la pantalla de error del framework.
export default function ErrorGeneral({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-1 flex-col justify-center p-4">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{AVISO_SIMULADO}</p>
      <h1 className="mt-6 text-xl font-bold text-zinc-900">Algo salió mal</h1>
      <p className="mt-2 text-sm text-zinc-600">No se pudo cargar esta página. Intenta de nuevo en unos segundos.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-[#0b5e52] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#094c43]"
      >
        Intentar de nuevo
      </button>
    </main>
  );
}
