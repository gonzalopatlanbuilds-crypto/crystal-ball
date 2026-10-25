import Link from "next/link";
import { describirHallazgo, ETIQUETA_ESTADO, ETIQUETA_TIPO, type Detalles, type EstadoHallazgo, type TipoHallazgo } from "@/lib/validador";

export interface HallazgoFila {
  id: string;
  type: TipoHallazgo;
  sku: string;
  supplier: string | null;
  status: EstadoHallazgo;
  details: Detalles;
}

const ESTILO_ESTADO: Record<EstadoHallazgo, string> = {
  pending: "border-zinc-300 text-zinc-600",
  confirmed: "border-red-300 bg-red-50 text-red-800",
  discarded: "border-zinc-300 bg-zinc-100 text-zinc-500",
};

// Tarjetas como el mockup: SKU, tipo, descripción (la arma el código, no la
// IA) y el estado. Ningún hallazgo se resuelve solo.
// Cada tarjeta lleva a la revisión del hallazgo.
export default function ListaHallazgos({ hallazgos }: { hallazgos: HallazgoFila[] }) {
  return (
    <ul className="space-y-3">
      {hallazgos.map((h) => (
        <li key={h.id}>
          <Link
            href={`/validador/hallazgos/${h.id}`}
            className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-[#0b5e52] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b5e52]"
          >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-all font-semibold text-zinc-900">{h.sku}</p>
              {h.supplier && <p className="text-xs text-zinc-500">{h.supplier}</p>}
              <span className="mt-1 inline-block rounded-full border border-amber-700/40 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                {ETIQUETA_TIPO[h.type]}
              </span>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${ESTILO_ESTADO[h.status]}`}>{ETIQUETA_ESTADO[h.status]}</span>
          </div>
          <p className="mt-2 break-words text-sm text-zinc-700">{describirHallazgo(h)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
