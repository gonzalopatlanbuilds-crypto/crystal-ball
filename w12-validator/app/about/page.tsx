import type { Metadata } from "next";
import Link from "next/link";
import Aviso from "@/components/Aviso";
import ChipEvidencia from "@/components/ChipEvidencia";
import { leerEvidenciaPrecio } from "@/lib/evidencia-precio";
import {
  ahorroMensual,
  costoTiempoMes,
  cumpleRegla20,
  ESTIMACION_FUNDADOR,
  HOY,
  precioMaximo,
  razonValorPrecio,
  REGLA_20,
} from "@/lib/memo";
import { ETIQUETA_ESTADO_PRECIO, formatoMxn, NIVELES, pagosReales, tonoEstado } from "@/lib/precios";

export const metadata: Metadata = {
  title: "El caso 10:1 — Validator",
  description: "El memo 10:1: lo que cuesta hoy, el precio y cada cifra de evidencia con su estado.",
};

const PRO = NIVELES.find((n) => n.id === "pro")!;
const PRECIO_LISTA = PRO.precioListaMxn ?? 0;
const PRECIO_FUNDADOR = PRO.precioFundador?.mxn ?? 0;

// Página pública (mockup assets/w14-mockup-about.png). Cada cifra de
// evidencia va en su propia tarjeta, con su estado y su fuente: nunca se
// promedian ni se elige una sola. Lee las mismas filas que /pricing.
export default async function AboutPage() {
  const filas = await leerEvidenciaPrecio();
  const e = ESTIMACION_FUNDADOR;

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="bg-[#0b5e52] text-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <p className="text-2xl font-bold">
            <Link href="/" className="hover:underline">Validator</Link> — El caso 10:1
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Una sola empresa de evidencia. Trato esto como hipótesis.
        </p>
        <Aviso className="mt-2" />

        <h1 className="mt-6 text-xl font-bold text-zinc-900">Estados de la evidencia de precio</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Cada cifra con su estado y su fuente, por separado. No se promedian
          ni se elige una sola.
        </p>

        {filas === null ? (
          <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            No se pudo leer la evidencia de precio. No se muestra ninguna cifra
            en su lugar.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {filas.map((f) => (
              <li key={f.id} className="rounded-xl border border-zinc-200 px-5 py-4">
                <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="text-xl font-bold text-zinc-900">{formatoMxn(f.amount_mxn)}/mes</span>
                  <ChipEvidencia texto={ETIQUETA_ESTADO_PRECIO[f.state]} tono={tonoEstado(f.state)} />
                </p>
                {f.note && <p className="mt-2 text-zinc-700">{f.note}</p>}
                <p className="mt-1 text-sm text-zinc-500">Fuente: {f.source}</p>
              </li>
            ))}
            {pagosReales(filas) === 0 && (
              <li className="rounded-xl border border-zinc-200 px-5 py-4">
                <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="text-xl font-bold text-zinc-900">$0</span>
                  <ChipEvidencia texto={ETIQUETA_ESTADO_PRECIO.paid} tono="hipotesis" />
                </p>
                <p className="mt-2 text-zinc-700">Ningún pago real todavía.</p>
              </li>
            )}
          </ul>
        )}

        <h2 className="mt-8 text-lg font-bold text-zinc-900">Hoy: horas a mano + riesgo de multa</h2>
        <p className="mt-2 text-zinc-700">{HOY}</p>

        {e ? (
          <div className="mt-3 rounded-xl border border-zinc-200 px-5 py-4 text-sm text-zinc-700">
            <p className="font-semibold text-zinc-900">Estimación propia de quien funda, no una medición</p>
            <dl className="mt-2 grid gap-1">
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt>Tiempo: {e.horasMes} h/mes × {formatoMxn(e.costoHoraMxn)}/h</dt>
                <dd className="font-semibold">{formatoMxn(costoTiempoMes(e))}/mes</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt>Riesgo de multa, prorrateado</dt>
                <dd className="font-semibold">{formatoMxn(e.riesgoMultaMesMxn)}/mes</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 border-t border-zinc-200 pt-1">
                <dt>Ahorro estimado</dt>
                <dd className="font-semibold">{formatoMxn(ahorroMensual(e))}/mes</dd>
              </div>
            </dl>
            <p className="mt-2 text-zinc-500">Base: {e.base}</p>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-zinc-200 px-5 py-4 text-sm text-zinc-700">
            La estimación del costo de hoy (tiempo + riesgo de multa) todavía no
            está publicada. Sin ella, esta página no calcula ningún ahorro.
          </p>
        )}

        <h2 className="mt-8 text-lg font-bold text-zinc-900">El precio</h2>
        <p className="mt-2 text-zinc-700">
          Pro: {formatoMxn(PRECIO_LISTA)}/mes de lista. Precio fundador:{" "}
          {formatoMxn(PRECIO_FUNDADOR)}/mes × {PRO.precioFundador?.meses} meses.{" "}
          <Link href="/pricing" className="font-semibold text-[#0b5e52] underline">Ver los 3 niveles</Link>
        </p>

        <div className="mt-4 rounded-xl border border-[#0b5e52] bg-teal-50/50 px-5 py-4 text-[#0b5e52]">
          <p>{REGLA_20}</p>
          {e && (
            <ul className="mt-2 space-y-1 text-sm">
              {[["De lista", PRECIO_LISTA], ["Fundador", PRECIO_FUNDADOR]].map(([nombre, precio]) => (
                <li key={nombre}>
                  {nombre} {formatoMxn(Number(precio))}/mes: tope {formatoMxn(precioMaximo(ahorroMensual(e)))}/mes →{" "}
                  {cumpleRegla20(Number(precio), ahorroMensual(e)) ? "cumple" : "NO cumple"} la regla (razón{" "}
                  {razonValorPrecio(ahorroMensual(e), Number(precio))}:1).
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
