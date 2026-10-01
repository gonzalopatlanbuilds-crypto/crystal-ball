"use client";

import { useActionState } from "react";
import { generarResumen, type ResumenState } from "@/app/(app)/scenarios/actions";
import { TITULO_BORRADOR as TITULO } from "@/lib/etiquetas";

// El contenido del .txt lo arma el servidor (armarDescarga): cada cifra
// lleva su etiqueta pegada para que no se pierda al copiar un fragmento.
function descargar(contenido: string, casosMes: number) {
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `borrador-sin-validar-${casosMes}-casos.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SponsorSummary({ escala, tarifa }: { escala: number; tarifa: number }) {
  const [state, action, pending] = useActionState<ResumenState, FormData>(generarResumen, undefined);

  return (
    <section className="mt-6 rounded-xl border border-sky-600 bg-sky-50 px-5 py-4">
      <h2 className="font-semibold text-sky-950">{TITULO}</h2>

      {state?.estado === "ok" && (
        <>
          <p className="mt-1 text-xs text-sky-900">
            Escala: {state.casosMes.toLocaleString("es-MX")} casos/mes · Generado: {state.generado}
          </p>
          <div className="mt-3 whitespace-pre-line text-sm text-sky-950">{state.texto}</div>
          <p className="mt-3 text-xs font-semibold text-orange-700">
            No confirmado: borrador para discusión. No representa una alianza ni una oferta.
          </p>
        </>
      )}

      {state?.estado === "rechazado" && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          El borrador generado no pasó la revisión automática y no se muestra:
          <ul className="mt-1 list-disc pl-5">
            {state.problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          Genera otro.
        </div>
      )}

      {state?.estado === "error" && (
        <p className="mt-3 text-sm text-red-600">{state.mensaje}</p>
      )}

      {!state && (
        <p className="mt-1 text-sm text-sky-900">
          La IA redacta a partir de los números de esta pantalla, sin calcular ni
          agregar cifras propias.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="escala" value={escala} />
          <input type="hidden" name="tarifa" value={tarifa} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-sky-800 px-4 py-2 text-sm text-white hover:bg-sky-900 disabled:opacity-60"
          >
            {pending ? "Generando…" : state?.estado === "ok" ? "Generar otro borrador" : "Generar borrador"}
          </button>
        </form>
        {state?.estado === "ok" && (
          <button
            type="button"
            onClick={() => descargar(state.descarga, state.casosMes)}
            className="rounded-lg border border-sky-800 bg-white px-4 py-2 text-sm text-sky-900 hover:bg-sky-100"
          >
            Descargar resumen
          </button>
        )}
      </div>
    </section>
  );
}
