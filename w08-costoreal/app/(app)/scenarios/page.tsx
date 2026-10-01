import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CASE_TYPE_LABELS, ESCALAS, SIMULADO_AVISO, type CaseType } from "@/lib/casos";
import { formatoMxn } from "@/lib/costos";
import {
  AVISO_NINGUN_PATROCINADOR,
  ETIQUETA_PATROCINIO,
  ETIQUETA_SIN_PATROCINIO,
  ETIQUETA_VICTIMA_PAGA,
} from "@/lib/etiquetas";
import { cargarModelo, leerParametros, TARIFA_PATROCINIO_MAX_MXN } from "@/lib/modelo";

function balance(centavos: number): string {
  if (centavos === 0) return "Equilibrio exacto: $0.00 MXN/mes";
  return centavos < 0
    ? `Déficit de ${formatoMxn(-centavos)}/mes`
    : `Superávit de ${formatoMxn(centavos)}/mes`;
}

function Etiqueta({ confirmado, texto }: { confirmado: boolean; texto: string }) {
  return (
    <p className={`mt-2 font-semibold ${confirmado ? "text-emerald-900" : "text-orange-700"}`}>
      {texto}
    </p>
  );
}

export default async function ScenariosPage({ searchParams }: PageProps<"/scenarios">) {
  const sp = await searchParams;
  const { escala, tarifaPatrocinioMxn, avisos } = leerParametros(sp.escala, sp.tarifa);

  const supabase = await createClient();
  const resultado = await cargarModelo(supabase, escala, tarifaPatrocinioMxn);

  const hrefEscala = (e: number) => `/scenarios?escala=${e}&tarifa=${tarifaPatrocinioMxn}`;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/dashboard" className="text-sm text-sky-800 hover:underline">
        ← Volver al panel
      </Link>
      <h1 className="mt-3 text-xl font-semibold text-zinc-900">Modelo de financiamiento</h1>

      {avisos.map((a) => (
        <p key={a} className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {a}
        </p>
      ))}

      <div className="mt-5 flex items-center gap-3">
        <span className="text-sm text-zinc-700">Escala:</span>
        {ESCALAS.map((e) => (
          <Link
            key={e}
            href={hrefEscala(e)}
            aria-current={e === escala ? "page" : undefined}
            className={`rounded-lg border px-4 py-2 text-sm tabular-nums ${
              e === escala
                ? "border-sky-800 bg-sky-800 text-white"
                : "border-zinc-300 bg-stone-100 text-zinc-700 hover:bg-stone-200"
            }`}
          >
            {e.toLocaleString("es-MX")} casos/mes
          </Link>
        ))}
      </div>

      {resultado.estado === "error" && (
        <p className="mt-6 text-sm text-red-600">
          No se pudieron cargar los datos del modelo. Intenta de nuevo.
        </p>
      )}

      {resultado.estado === "sin-datos" && (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          Todavía no hay ningún caso con tiempo registrado. Sin costo real no
          hay nada que proyectar — registra el tiempo de al menos un caso
          desde el panel.
        </div>
      )}

      {resultado.estado === "ok" &&
        (() => {
          const m = resultado.modelo;
          return (
            <>
              <p className="mt-6 text-lg font-semibold text-zinc-900">
                Costo mensual proyectado a {m.casosMes.toLocaleString("es-MX")} casos:{" "}
                {formatoMxn(m.costoMensualCentavos)}
              </p>

              {/* Desglose completo: el total de arriba se puede rehacer a
                  mano sumando esta tabla. */}
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr>
                    <th className="py-1.5 font-medium">Tipo de caso</th>
                    <th className="py-1.5 text-right font-medium">Casos/mes (simulado)</th>
                    <th className="py-1.5 text-right font-medium">Costo promedio real</th>
                    <th className="py-1.5 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 tabular-nums text-zinc-800">
                  {m.lineas.map((l) => (
                    <tr key={l.caseType}>
                      <td className="py-1.5">{CASE_TYPE_LABELS[l.caseType as CaseType] ?? l.caseType}</td>
                      <td className="py-1.5 text-right">{l.casosMes.toLocaleString("es-MX")}</td>
                      <td className="py-1.5 text-right">
                        {formatoMxn(l.costoPromedioCentavos)}
                        <span className="block text-xs text-zinc-500">
                          {l.estimadoConPromedioGeneral
                            ? "estimado: promedio general*"
                            : `de ${l.casosRegistrados} caso${l.casosRegistrados === 1 ? "" : "s"} registrado${l.casosRegistrados === 1 ? "" : "s"}`}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">{formatoMxn(l.subtotalCentavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-zinc-500">
                Costo promedio = promedio del costo real de los casos de ese
                tipo con tiempo registrado ({m.casosRegistrados} en total).
                Subtotal = casos/mes × costo promedio.
                {m.usaPromedioGeneral &&
                  ` *Este tipo no tiene todavía ningún caso registrado; se usa el promedio de todos los casos registrados (${formatoMxn(m.costoPromedioGeneralCentavos)}). Registrar un caso de ese tipo reemplaza la estimación.`}
              </p>

              <div className="mt-6 space-y-4">
                <section className="rounded-xl border border-zinc-400 bg-stone-100 px-5 py-4">
                  <h2 className="font-semibold text-zinc-900">Escenario A — Víctima paga</h2>
                  <p className="mt-1 text-zinc-600">
                    Ingreso $0 — el servicio se declara gratuito para la
                    víctima por Condición 4. {balance(m.victimaPaga.balanceCentavos)}.
                  </p>
                  <Etiqueta confirmado={false} texto={ETIQUETA_VICTIMA_PAGA} />
                </section>

                <section className="rounded-xl border border-amber-500 bg-orange-50 px-5 py-4">
                  <h2 className="font-semibold text-amber-950">
                    Escenario B — Patrocinador paga por caso (tipo IDCARE)
                  </h2>
                  <p className="mt-1 text-amber-900">
                    Tarifa hipotética de {formatoMxn(m.patrocinioPorCaso.tarifaCentavos)} por
                    caso × {m.casosMes.toLocaleString("es-MX")} casos ={" "}
                    {formatoMxn(m.patrocinioPorCaso.ingresoCentavos)}/mes.{" "}
                    {balance(m.patrocinioPorCaso.balanceCentavos)}.
                  </p>
                  <p className="mt-1 text-sm text-amber-900">
                    Punto de equilibrio: {formatoMxn(m.patrocinioPorCaso.tarifaEquilibrioCentavos)} por
                    caso cubriría el costo a esta escala.
                  </p>
                  <Etiqueta confirmado={false} texto={ETIQUETA_PATROCINIO} />

                  <form method="get" action="/scenarios" className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="escala" value={escala} />
                    <label className="text-xs text-amber-950" htmlFor="tarifa">
                      Probar otra tarifa hipotética (MXN por caso)
                      <input
                        id="tarifa"
                        name="tarifa"
                        inputMode="decimal"
                        defaultValue={tarifaPatrocinioMxn}
                        className="mt-1 block w-32 rounded-lg border border-amber-500 bg-white px-3 py-1.5 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-lg border border-amber-600 bg-white px-3 py-1.5 text-sm text-amber-950 hover:bg-orange-100"
                    >
                      Recalcular
                    </button>
                    <span className="w-full text-xs text-amber-900">
                      Mayor a $0 y hasta ${TARIFA_PATROCINIO_MAX_MXN.toLocaleString("es-MX")}. Cambiar
                      esta cifra no la vuelve más real: sigue sin confirmar.
                    </span>
                  </form>
                </section>

                <section className="rounded-xl border border-lime-600 bg-lime-50 px-5 py-4">
                  <h2 className="font-semibold text-lime-950">Escenario C — Sin patrocinador</h2>
                  <p className="mt-1 text-lime-950">
                    Déficit de {formatoMxn(m.sinPatrocinio.deficitCentavos)}/mes a{" "}
                    {m.casosMes.toLocaleString("es-MX")} casos (costo total − $0 de
                    ingreso) — insostenible sin financiamiento externo.
                  </p>
                  <Etiqueta confirmado texto={ETIQUETA_SIN_PATROCINIO} />
                  <p className="mt-1 text-xs text-lime-900">
                    Lo confirmado es el costo por caso (tiempo registrado). El
                    volumen de {m.casosMes.toLocaleString("es-MX")} casos/mes es simulado
                    {m.usaPromedioGeneral && ", y algún tipo de caso usa el promedio general"}.
                  </p>
                </section>
              </div>
            </>
          );
        })()}

      <p className="mt-8 border-t border-zinc-200 pt-4 text-sm text-zinc-500">
        {AVISO_NINGUN_PATROCINADOR} {SIMULADO_AVISO}
      </p>
    </main>
  );
}
