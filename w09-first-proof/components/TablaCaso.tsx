import { EMPRESA, FILAS_CASO, formatoMiles } from "@/lib/caso";

export default function TablaCaso() {
  return (
    <section>
      <h2 className="text-base font-semibold text-zinc-900">Caso: {EMPRESA} (ficticio)</h2>
      <table className="mt-2 w-full rounded-xl bg-stone-100 text-sm">
        <thead>
          <tr className="text-left text-zinc-900">
            <th className="px-3 pt-3 pb-1 font-semibold">Concepto</th>
            <th className="px-3 pt-3 pb-1 text-right font-semibold">T1</th>
            <th className="px-3 pt-3 pb-1 text-right font-semibold">T2</th>
          </tr>
        </thead>
        <tbody className="text-zinc-700">
          {FILAS_CASO.map((f) => (
            <tr key={f.concepto}>
              <td className="px-3 py-1 last:pb-3">{f.concepto}</td>
              <td className="px-3 py-1 text-right tabular-nums">{formatoMiles(f.t1)}</td>
              <td className="px-3 py-1 text-right tabular-nums">{formatoMiles(f.t2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-zinc-500">Cifras en pesos, inventadas.</p>
    </section>
  );
}
