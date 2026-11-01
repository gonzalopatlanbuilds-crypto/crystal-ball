import type { FilaRechazada } from "@/lib/csv";

// Filas rechazadas: cada una con su número de línea en el archivo y el
// motivo. Nunca se tiran en silencio.
export default function TablaRechazadas({ filas }: { filas: FilaRechazada[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Fila</th>
            <th className="px-3 py-2 font-medium">Motivo del rechazo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.fila} className="border-t border-zinc-100 align-top">
              <td className="px-3 py-2 font-mono text-zinc-700">{f.fila}</td>
              <td className="px-3 py-2 break-words text-zinc-700">{f.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
