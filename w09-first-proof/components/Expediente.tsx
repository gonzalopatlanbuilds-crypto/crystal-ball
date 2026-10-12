import { formatoDecimal, type ResultadoChequeo } from "@/lib/caso";
import {
  fechaRevision,
  mapaCriterios,
  NO_PRUEBA,
  QUIEN_PUEDE_VERLO,
  REAL_Y_SIMULADO,
  RECOMENDACIONES,
  type DecisionObservacion,
  type Recomendacion,
} from "@/lib/expediente";
import type { Observacion } from "@/lib/observaciones";
import { ETIQUETA_IA } from "@/components/ObservacionesIA";

export interface DatosRevision {
  revisor: string;
  creadaEn: string;
  conflicto: string;
  recomendacion: Recomendacion;
  nota: string;
  decisiones: Record<string, DecisionObservacion>;
}

interface Props {
  seudonimo: string;
  resultados: ResultadoChequeo[];
  explicacion: string;
  observaciones: Observacion[] | null;
  revision: DatosRevision | null;
  // Solo el candidato ve el botón de eliminar (lo pasa la página).
  accion?: React.ReactNode;
}

const caja = "rounded-xl border p-4";

// Expediente de evidencia (mockup 2). Todo el texto fijo sale de
// lib/expediente.ts; la IA solo aporta las observaciones del bloque 3, y
// ahí cada una muestra lo que decidió una persona.
export default function Expediente({ seudonimo, resultados, explicacion, observaciones, revision, accion }: Props) {
  const criterios = mapaCriterios(revision?.revisor ?? null);

  return (
    <article className="space-y-3">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-teal-800">Archivo de evidencia</p>
        <h1 className="text-xl font-semibold text-zinc-900">Candidato {seudonimo}</h1>
        <p className="text-sm text-zinc-600">Práctica con caso ficticio · identidad oculta en la revisión</p>
      </header>

      <section className={`${caja} border-emerald-600/50 bg-emerald-50/60`}>
        <h2 className="text-sm font-semibold text-zinc-900">1 · Cálculos (automático, no es un juicio)</h2>
        <ul className="mt-2 space-y-1 text-sm text-zinc-800">
          {resultados.map((r) => (
            <li key={r.clave}>
              {r.etiqueta}: respondió {r.respuesta === null ? "—" : formatoDecimal(r.respuesta)} · correcto{" "}
              {formatoDecimal(r.correcto)}{" "}
              <span className="font-medium">
                [{r.estado === "correcto" ? "coincide" : r.estado === "sin_respuesta" ? "sin respuesta" : "no coincide"}]
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-emerald-900">El sistema solo compara números; no evalúa a la persona.</p>
      </section>

      <section className={`${caja} border-zinc-300 bg-stone-50`}>
        <h2 className="text-sm font-semibold text-zinc-900">2 · Explicación del candidato (sus palabras)</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{explicacion}</p>
      </section>

      <section className={`${caja} border-sky-600/40 bg-sky-50/60`}>
        <h2 className="text-sm font-semibold text-zinc-900">3 · Observaciones preparadas por IA</h2>
        <p className="text-xs text-zinc-600">
          {ETIQUETA_IA} {revision ? "Las revisó una persona." : "Pendientes de que una persona las confirme o descarte."}
        </p>
        {observaciones && observaciones.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm text-zinc-800">
            {observaciones.map((o) => {
              const d = revision?.decisiones[o.id];
              return (
                <li key={o.id}>
                  <p className={d?.decision === "descartada" ? "text-zinc-500 line-through" : ""}>• {o.texto}</p>
                  {d && (
                    <p
                      className={`ml-3 text-xs font-semibold ${d.decision === "confirmada" ? "text-sky-900" : "text-orange-800"}`}
                    >
                      [{d.decision === "confirmada" ? "Confirmada por quien revisó" : "Descartada"}
                      {d.motivo ? `: ${d.motivo}` : ""}]
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">No hay observaciones de IA para esta entrega.</p>
        )}
      </section>

      <section className={`${caja} border-zinc-300 bg-stone-50`}>
        <h2 className="text-sm font-semibold text-zinc-900">4 · Revisión humana</h2>
        {revision ? (
          <dl className="mt-2 space-y-1 text-sm text-zinc-800">
            <div>
              {revision.revisor} · {fechaRevision(revision.creadaEn)}
            </div>
            <div>Conflicto de interés: {revision.conflicto === "Ninguno" ? "ninguno declarado" : revision.conflicto}</div>
            <div>Recomendación: {RECOMENDACIONES[revision.recomendacion]}</div>
            <div className="whitespace-pre-wrap">Nota: {revision.nota}</div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">Pendiente: ninguna persona la ha revisado todavía.</p>
        )}
      </section>

      <section className={`${caja} border-zinc-300 bg-stone-50`}>
        <h2 className="text-sm font-semibold text-zinc-900">5 · Criterios publicados y quién los evaluó</h2>
        <ul className="mt-2 space-y-2 text-sm text-zinc-800">
          {criterios.map((c) => (
            <li key={c.id}>
              <p>
                <span className="font-medium">{c.id}</span> {c.texto} →{" "}
                <span className={c.pendiente ? "text-zinc-500" : ""}>{c.juzgadoPor}</span>
              </p>
              <p className="text-xs text-zinc-500">Evidencia: {c.evidencia}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${caja} border-amber-500/60 bg-amber-50`}>
        <h2 className="text-sm font-semibold text-amber-950">Lo que este archivo NO prueba</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
          {NO_PRUEBA.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className={`${caja} border-zinc-300 bg-stone-50`}>
        <h2 className="text-sm font-semibold text-zinc-900">Quién puede verlo</h2>
        <p className="mt-1 text-sm text-zinc-800">{QUIEN_PUEDE_VERLO}</p>
        <h2 className="mt-3 text-sm font-semibold text-zinc-900">Real y simulado</h2>
        <p className="mt-1 text-sm text-zinc-800">{REAL_Y_SIMULADO}</p>
      </section>

      {accion}
    </article>
  );
}
