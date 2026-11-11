"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { enlacesNav } from "@/lib/nav";

// Fila de navegación del encabezado compartido. Es de cliente solo para
// marcar la página actual (usePathname); los enlaces salen de lib/nav.ts.
export default function NavSitio({ conSesion }: { conSesion: boolean }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Sitio" className="mx-auto flex max-w-3xl flex-wrap gap-x-1 gap-y-1 px-2 pb-2">
      {enlacesNav(conSesion).map((e) => {
        const actual = e.href === "/validador" ? ruta.startsWith("/validador") : ruta === e.href;
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={actual ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium ${
              actual ? "bg-white text-[#0b5e52]" : "text-teal-50 hover:bg-[#094c43]"
            }`}
          >
            {e.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
