// La consulta de /financiamiento, en UN solo lugar. La página la ejecuta con
// supabase-js (rol anon); test:schema la traduce a SQL con
// sqlLibroPublico() y la corre como anon en Postgres. Si alguien cambia el
// filtro o el orden aquí, la prueba prueba la versión nueva.

export const CONSULTA_LIBRO_PUBLICO = {
  tabla: "published_ledger",
  columnas: ["version", "viability", "content", "published_at"],
  // Solo organizaciones oficiales (RLS ya lo limita para anon; el filtro lo
  // hace explícito y no depende de la policy).
  filtro: { columna: "oficial", valor: true },
  // Lo más reciente primero; empate improbable → la versión más alta.
  orden: [
    { columna: "published_at", ascendente: false },
    { columna: "version", ascendente: false },
  ],
  limite: 1,
} as const;

export function sqlLibroPublico(): string {
  const c = CONSULTA_LIBRO_PUBLICO;
  const orden = c.orden.map((o) => `${o.columna} ${o.ascendente ? "asc" : "desc"}`).join(", ");
  return `select ${c.columnas.join(", ")} from public.${c.tabla} where ${c.filtro.columna} = ${c.filtro.valor} order by ${orden} limit ${c.limite}`;
}
