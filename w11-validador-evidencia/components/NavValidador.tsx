"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/validador", etiqueta: "Cargar evidencia" },
  { href: "/validador/hallazgos", etiqueta: "Hallazgos" },
];

export default function NavValidador() {
  const ruta = usePathname();
  const activo = (href: string) => (href === "/validador" ? ruta === href : ruta.startsWith(href));
  return (
    <nav aria-label="Secciones" className="mx-auto flex w-full max-w-3xl gap-1 px-4 pt-3">
      {ENLACES.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          aria-current={activo(e.href) ? "page" : undefined}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            activo(e.href) ? "bg-teal-50 text-[#0b5e52]" : "text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          {e.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
