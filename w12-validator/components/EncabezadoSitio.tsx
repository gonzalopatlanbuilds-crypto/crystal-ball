import Link from "next/link";
import NavSitio from "@/components/NavSitio";

// El único encabezado del sitio (semana 14), puesto una vez en
// app/layout.tsx: aparece en todas las páginas, con o sin sesión. Con
// sesión muestra el correo, "Cerrar sesión" y el enlace a /validador.
// Reemplaza a los encabezados que cada página tenía por su cuenta y a
// AppHeader (/validador).
export default function EncabezadoSitio({ conSesion, email }: { conSesion: boolean; email: string | null }) {
  return (
    <header className="bg-[#0b5e52] text-white" data-encabezado-sitio>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0">
          <Link href="/" className="text-lg font-bold hover:underline">
            Validator
          </Link>
          {email && <p className="truncate text-sm text-teal-100">{email}</p>}
        </div>
        {conSesion && (
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="shrink-0 rounded-md border border-teal-200/60 px-3 py-1.5 text-sm text-teal-50 hover:bg-[#094c43]"
            >
              Cerrar sesión
            </button>
          </form>
        )}
      </div>
      <NavSitio conSesion={conSesion} />
    </header>
  );
}
