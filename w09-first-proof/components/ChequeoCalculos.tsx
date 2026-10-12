import { formatoDecimal, type ResultadoChequeo } from "@/lib/caso";

// Bloque propio, separado de todo lo que juzga una persona (Condición 4):
// el sistema solo compara contra el valor correcto. Una línea por cálculo,
// sin total ni puntaje.
export default function ChequeoCalculos({ resultados }: { resultados: ResultadoChequeo[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Cálculos</h2>
      <p className="text-xs text-zinc-500">Revisión automática: solo compara números, no es un juicio sobre la persona.</p>
      <ul className="mt-3 space-y-3">
        {resultados.map((r) => (
          <li key={r.clave} className="text-sm">
            <p className="text-zinc-700">{r.etiqueta}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="tabular-nums text-zinc-900">
                Respuesta: {r.respuesta === null ? "—" : formatoDecimal(r.respuesta)}
              </span>
              {r.estado === "correcto" ? (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
                  correcto
                </span>
              ) : (
                <>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700">
                    {r.estado === "sin_respuesta" ? "sin respuesta" : "no coincide"}
                  </span>
                  <span className="tabular-nums text-xs text-zinc-600">
                    valor correcto: {formatoDecimal(r.correcto)}
                  </span>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
