// Enlaces del encabezado compartido (semana 14). Lógica pura: test:logica
// la cubre. Las páginas públicas siempre; "Mi evidencia" (/validador, que
// tiene sus pestañas Cargar evidencia / Hallazgos) solo con sesión.
export type EnlaceNav = { href: string; etiqueta: string };

export const ENLACES_PUBLICOS: readonly EnlaceNav[] = [
  { href: "/pricing", etiqueta: "Precios" },
  { href: "/about", etiqueta: "El caso 10:1" },
  { href: "/simulador", etiqueta: "Simulador" },
];

export const ENLACE_PANEL: EnlaceNav = { href: "/validador", etiqueta: "Mi evidencia" };

export function enlacesNav(conSesion: boolean): EnlaceNav[] {
  return conSesion ? [...ENLACES_PUBLICOS, ENLACE_PANEL] : [...ENLACES_PUBLICOS];
}
