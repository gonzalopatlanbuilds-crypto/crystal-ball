"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Aviso from "@/components/Aviso";
import BotonGoogle from "@/components/BotonGoogle";

// /auth/callback manda aquí con ?error=auth cuando el login falla. El
// Suspense deja que /login siga siendo estática aunque lea la query string.
function ErrorDelCallback() {
  const params = useSearchParams();
  if (params.get("error") !== "auth") return null;
  return (
    <p className="mt-3 text-sm text-red-700">
      No se pudo completar el inicio de sesión. Intenta de nuevo.
    </p>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Aviso className="mb-4" />
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-zinc-900">Validator</h1>
          <p className="mt-2 mb-6 text-sm text-zinc-600">
            Entra para cargar los CSV de tus proveedores y revisar los
            hallazgos. Datos simulados.
          </p>
          <BotonGoogle />
          <Suspense fallback={null}>
            <ErrorDelCallback />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
