import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ListaHallazgos, { type HallazgoFila } from "@/components/ListaHallazgos";
import { ETIQUETA_ESTADO, type EstadoHallazgo } from "@/lib/validador";

const FILTROS: { valor: EstadoHallazgo | "todos"; etiqueta: string }[] = [
  { valor: "pending", etiqueta: ETIQUETA_ESTADO.pending },
  { valor: "confirmed", etiqueta: ETIQUETA_ESTADO.confirmed },
  { valor: "discarded", etiqueta: ETIQUETA_ESTADO.discarded },
  { valor: "todos", etiqueta: "Todos" },
];
const LIMITE = 200;

export default async function HallazgosPage({ searchParams }: PageProps<"/validador/hallazgos">) {
  const { estado: crudo } = await searchParams;
  // Solo valores conocidos; cualquier otra cosa cae en "pendientes".
  const estado = FILTROS.some((f) => f.valor === crudo) ? (crudo as EstadoHallazgo | "todos") : "pending";

  const supabase = await createClient();
  let consulta = supabase
    .from("findings")
    .select("id, type, sku, supplier, status, details")
    .order("created_at", { ascending: false })
    .order("sku")
    .limit(LIMITE);
  if (estado !== "todos") consulta = consulta.eq("status", estado);
  const [{ data: hallazgos, error }, { data: estados, error: errorConteo }] = await Promise.all([
    consulta.returns<HallazgoFila[]>(),
    supabase.from("findings").select("status").returns<{ status: EstadoHallazgo }[]>(),
  ]);
  if (error || errorConteo) {
    console.error("HallazgosPage: no se pudieron leer los hallazgos", error ?? errorConteo);
  }
  const conteo = (v: EstadoHallazgo | "todos") => (estados ?? []).filter((x) => v === "todos" || x.status === v).length;

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Hallazgos</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Cada hallazgo espera una decisión humana con nota. El validador no decide cumplimiento.
      </p>

      <nav aria-label="Filtrar por estado" className="mt-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={`/validador/hallazgos?estado=${f.valor}`}
            aria-current={estado === f.valor ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              estado === f.valor ? "border-[#0b5e52] bg-[#0b5e52] text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {f.etiqueta} ({conteo(f.valor)})
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {error ? (
          <p className="text-sm text-red-700">No se pudieron cargar los hallazgos. Recarga la página.</p>
        ) : !hallazgos?.length ? (
          <p className="text-sm text-zinc-600">
            {estado === "pending"
              ? "No hay hallazgos pendientes de revisión."
              : estado === "todos"
                ? "Todavía no hay hallazgos. Aparecen cuando una carga difiere de la evidencia aceptada."
                : `No hay hallazgos con estado “${ETIQUETA_ESTADO[estado]}”.`}
          </p>
        ) : (
          <>
            <ListaHallazgos hallazgos={hallazgos} />
            {hallazgos.length === LIMITE && (
              <p className="mt-3 text-xs text-zinc-500">Se muestran los {LIMITE} más recientes.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
