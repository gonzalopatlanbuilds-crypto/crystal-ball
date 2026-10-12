"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// /auth/callback manda aquí con ?error=auth cuando el login falla. Antes no
// se mostraba nada y el fallo se veía como "no pasó nada". El Suspense
// deja que /login siga siendo estática aunque lea la query string.
function ErrorDelCallback() {
  const params = useSearchParams();
  if (params.get("error") !== "auth") return null;
  return (
    <p className="mt-3 text-sm text-red-600">
      No se pudo completar el inicio de sesión. Intenta de nuevo.
    </p>
  );
}

export default function LoginPage() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function iniciarSesionConGoogle() {
    setError(null);
    setCargando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Sin esto, Google entra solo con la cuenta que ya tiene abierta
          // en el navegador: después de "Cerrar sesión" no había forma de
          // elegir otra (candidato y revisor son cuentas distintas).
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch {
      setError("No se pudo iniciar sesión con Google. Intenta de nuevo.");
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">First-Proof Finance MX</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Resuelve un caso financiero ficticio, recibe una revisión humana
          a ciegas y obtén un expediente que muestra tu trabajo. Práctica:
          no es trabajo real ni garantiza empleo. Datos simulados.
        </p>
        <button
          type="button"
          onClick={iniciarSesionConGoogle}
          disabled={cargando}
          className="mt-6 w-full rounded-lg bg-teal-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-50"
        >
          {cargando ? "Redirigiendo…" : "Iniciar sesión con Google"}
        </button>
        {error ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : (
          !cargando && (
            <Suspense fallback={null}>
              <ErrorDelCallback />
            </Suspense>
          )
        )}
      </div>
    </main>
  );
}
