import Link from "next/link";
import EstadoBadge from "@/components/EstadoBadge";
import { CATALOGO, esClave, formatearValor } from "@/lib/supuestos";
import type { FilaSupuesto } from "@/lib/leer-supuestos";

// Tabla del mockup del operador: Supuesto · Valor · Estado. Con
// `editable`, cada fila enlaza a su edición y muestra la fuente.
export default function TablaSupuestos({ filas, editable = false }: { filas: FilaSupuesto[]; editable?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-zinc-500">
            <th className="px-4 pt-3 pb-2 font-semibold">Supuesto</th>
            <th className="px-2 pt-3 pb-2 font-semibold">Valor</th>
            <th className="px-4 pt-3 pb-2 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-t border-zinc-100 align-top">
              <td className="px-4 py-3 text-zinc-900">
                {editable ? (
                  <Link href={`/modelo/supuestos/${f.id}`} className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-700">
                    {esClave(f.key) ? CATALOGO[f.key].etiqueta : f.key}
                  </Link>
                ) : esClave(f.key) ? (
                  CATALOGO[f.key].etiqueta
                ) : (
                  f.key
                )}
                {editable && (
                  <p className="mt-1 text-xs break-all text-zinc-500">
                    {f.source_url ? (
                      <>
                        Fuente:{" "}
                        <a href={f.source_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                          {f.source_url}
                        </a>
                        {f.source_date ? ` (${f.source_date})` : ""}
                      </>
                    ) : (
                      "Sin fuente"
                    )}
                  </p>
                )}
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-zinc-900">{formatearValor(f.key, f.value_num)}</td>
              <td className="px-4 py-3">
                <EstadoBadge estado={f.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
