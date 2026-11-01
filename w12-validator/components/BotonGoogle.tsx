"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// El mismo botón en la home pública y en /login.
export default function BotonGoogle() {
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
    <>
      <button
        type="button"
        onClick={iniciarSesionConGoogle}
        disabled={cargando}
        className="w-full rounded-lg bg-[#0b5e52] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#094c43] disabled:opacity-50"
      >
        {cargando ? "Redirigiendo…" : "Iniciar sesión con Google"}
      </button>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </>
  );
}
