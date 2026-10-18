"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
          // elegir otra (w09).
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
    <main className="flex min-h-screen flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">Libro Abierto</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Acceso para el equipo que edita el modelo de costos y
          financiamiento. Datos simulados.
        </p>
        <button
          type="button"
          onClick={iniciarSesionConGoogle}
          disabled={cargando}
          className="mt-6 w-full rounded-lg bg-[#0b5e52] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#094c43] disabled:opacity-50"
        >
          {cargando ? "Redirigiendo…" : "Iniciar sesión con Google"}
        </button>
        {error ? (
          <p className="mt-3 text-sm text-red-700">{error}</p>
        ) : (
          !cargando && (
            <Suspense fallback={null}>
              <ErrorDelCallback />
            </Suspense>
          )
        )}
        <p className="mt-6 text-xs text-zinc-500">
          ¿Eres estudiante? No necesitas cuenta:{" "}
          <Link href="/financiamiento" className="underline">
            ve quién paga esto
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
