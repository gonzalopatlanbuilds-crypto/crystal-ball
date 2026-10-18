import type { Metadata } from "next";
import CajaViabilidad from "@/components/CajaViabilidad";
import EstadoBadge from "@/components/EstadoBadge";
import { createPublicClient } from "@/lib/supabase/publico";
import { AVISO_PUBLICO } from "@/lib/avisos";
import { CONSULTA_LIBRO_PUBLICO as Q } from "@/lib/libro-publico";
import { DATOS_GUARDADOS } from "@/lib/datos-guardados";
import { leerLibro, NINGUN_PATROCINADOR_PUEDE_CAMBIAR, QUE_DATOS_GUARDAMOS } from "@/lib/libro";
import type { Cifra } from "@/lib/modelo";
import { EXPLICACION_PUBLICA, VIABILIDADES, type Viabilidad } from "@/lib/viabilidad";

export const metadata: Metadata = {
  title: "¿Quién paga esto? | Libro Abierto",
  description: "Cómo se financia el verificador de compatibilidad y qué no puede cambiar quien lo financie. Datos simulados.",
};

// Siempre lo último publicado; sin caché de página.
export const dynamic = "force-dynamic";

const mxn = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

function LineaCosto({ etiqueta, cifra, total }: { etiqueta: string; cifra: Cifra; total?: boolean }) {
  return (
    <li className={`flex items-center justify-between gap-3 py-2.5 ${total ? "font-bold" : "border-b border-zinc-200"}`}>
      <span>{etiqueta}</span>
      <span className="flex items-center gap-2 text-right">
        {cifra.calculable ? `MXN ${mxn.format(cifra.valor)} / mes` : <span className="font-normal text-zinc-600">no calculable</span>}
        {cifra.calculable && !total && <EstadoBadge estado={cifra.estado} />}
      </span>
    </li>
  );
}

async function leerUltimo() {
  const supabase = createPublicClient();
  if (!supabase) return { error: true as const };
  // La consulta vive en lib/libro-publico.ts (la misma que prueba
  // test:schema): último snapshot de la org oficial.
  let consulta = supabase.from(Q.tabla).select(Q.columnas.join(", ")).eq(Q.filtro.columna, Q.filtro.valor);
  for (const o of Q.orden) consulta = consulta.order(o.columna, { ascending: o.ascendente });
  const { data, error } = await consulta
    .limit(Q.limite)
    .maybeSingle<{ version: number; viability: string; content: unknown; published_at: string }>();
  if (error) {
    console.error("financiamiento: lectura falló", error);
    return { error: true as const };
  }
  return { fila: data };
}

export default async function FinanciamientoPage() {
  const r = await leerUltimo();
  const fila = "fila" in r ? r.fila : null;
  const libro = fila ? leerLibro(fila.content) : null;
  const viabilidad = fila && (VIABILIDADES as string[]).includes(fila.viability) ? (fila.viability as Viabilidad) : null;

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="bg-[#0b5e52] text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <p className="text-xl font-bold">Libro Abierto</p>
          <p className="text-sm text-teal-100">Financiamiento</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-4">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{AVISO_PUBLICO}</p>

        <div>
          <h1 className="text-2xl font-bold text-zinc-900">¿Quién paga esto?</h1>
          <p className="mt-1 text-[15px] text-zinc-600">
            Cómo se financia el verificador de compatibilidad y qué no puede cambiar quien lo financie.
          </p>
        </div>

        {"error" in r ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            No se pudo cargar el libro en este momento. Intenta de nuevo en unos minutos.
          </p>
        ) : !fila ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-[15px] text-zinc-700">
            Aún no hay libro publicado.
          </p>
        ) : !libro || !viabilidad ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            La versión publicada no se puede mostrar. Se revisará y se corregirá.
          </p>
        ) : (
          <>
            <CajaViabilidad
              estado={viabilidad}
              lineas={[
                ...EXPLICACION_PUBLICA[viabilidad],
                ...((libro.evidencia_pagador.simuladas ?? 0) > 0
                  ? [
                      `La evidencia registrada es simulada (${libro.evidencia_pagador.simuladas} de ${libro.evidencia_pagador.registros}): no hay un pagador real.`,
                    ]
                  : []),
              ]}
            />

            <section>
              <h2 className="text-lg font-bold text-zinc-900">Cuánto cuesta operarlo (simulado)</h2>
              <ul className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-1 text-[15px] text-zinc-900">
                <LineaCosto etiqueta="Mantenimiento de evidencia" cifra={libro.costos.mantenimiento} />
                <LineaCosto etiqueta="Atención a correcciones" cifra={libro.costos.correcciones} />
                <LineaCosto etiqueta="Infraestructura" cifra={libro.costos.infraestructura} />
                <LineaCosto etiqueta="Total" cifra={libro.costos.total} total />
              </ul>
            </section>
          </>
        )}

        <section>
          <h2 className="text-lg font-bold text-zinc-900">Lo que ningún patrocinador puede cambiar</h2>
          <ul className="mt-2 space-y-2 rounded-xl border border-[#0b5e52] bg-teal-50/50 p-4 text-[15px] text-[#0b5e52]">
            {NINGUN_PATROCINADOR_PUEDE_CAMBIAR.map((t) => (
              <li key={t}>[OK] {t}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900">Qué datos guardamos</h2>
          <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[15px] text-zinc-900">
            <ul className="space-y-2">
              {QUE_DATOS_GUARDAMOS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <details className="mt-3 text-sm text-zinc-700">
              <summary className="cursor-pointer text-[#0b5e52] underline">Ver todas las tablas y columnas</summary>
              <ul className="mt-2 space-y-2">
                {DATOS_GUARDADOS.map((t) => (
                  <li key={t.tabla}>
                    <span className="font-mono text-xs">{t.tabla}</span>: {t.queEs}
                    <br />
                    <span className="font-mono text-xs break-all text-zinc-500">{t.columnas.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </section>

        <footer className="pb-6 text-sm text-zinc-500">
          {fila && <p>Versión publicada: v{fila.version} - simulada</p>}
          <p>Si algo aquí está mal, escríbenos: se corrige y se anota.</p>
        </footer>
      </main>
    </div>
  );
}
