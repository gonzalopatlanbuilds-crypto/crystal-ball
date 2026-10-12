import type { Observacion } from "@/lib/observaciones";

// La etiqueta viene de aquí, nunca del modelo (Condición 3). Bloque propio,
// separado del chequeo automático y de lo que juzga la persona que revisa.
export const ETIQUETA_IA = "Preparadas por IA, no son una calificación ni una decisión.";

function esListaDeObservaciones(v: unknown): v is Observacion[] {
  return (
    Array.isArray(v) &&
    v.every((o) => o && typeof o === "object" && typeof o.id === "string" && typeof o.texto === "string")
  );
}

export default function ObservacionesIA({ observaciones }: { observaciones: unknown }) {
  const lista = esListaDeObservaciones(observaciones) ? observaciones : null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Observaciones sobre tu explicación</h2>
      <p className="text-xs text-zinc-500">
        {ETIQUETA_IA} Una persona las confirma o las descarta al revisar.
      </p>
      {lista && lista.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-zinc-700">
          {lista.map((o) => (
            <li key={o.id}>{o.texto}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">
          No hay observaciones de IA para esta entrega. La revisión humana sigue igual.
        </p>
      )}
    </section>
  );
}
