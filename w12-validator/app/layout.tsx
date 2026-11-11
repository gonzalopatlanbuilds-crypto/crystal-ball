import type { Metadata } from "next";
import EncabezadoSitio from "@/components/EncabezadoSitio";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Validator",
  description: "Validator — en construcción. Datos simulados.",
};

// El encabezado compartido va aquí, una sola vez, para todo el sitio
// (semana 14). Lee la sesión para decidir si muestra el correo, "Cerrar
// sesión" y "Mi evidencia". Si la lectura falla, se muestra como sin
// sesión: la página sigue cargando y /validador sigue protegido por el
// proxy y por su propio layout.
// createClient() (que lee cookies) va FUERA del try: leer cookies lanza una
// señal interna con la que Next marca la página como dinámica, y atraparla
// la escondía (bug del build, 2026-11-11: «couldn't be rendered statically
// because it used cookies» en todas las rutas).
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  let email: string | null = null;
  let conSesion = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    // Sin sesión, Supabase devuelve un error "Auth session missing": no es
    // una falla, no se registra.
    if (error && error.name !== "AuthSessionMissingError") console.error("RootLayout: no se pudo leer la sesión", error);
    conSesion = !!data.user;
    email = data.user?.email ?? null;
  } catch (e) {
    console.error("RootLayout: no se pudo leer la sesión", e);
  }

  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white">
        <EncabezadoSitio conSesion={conSesion} email={email} />
        {children}
      </body>
    </html>
  );
}
