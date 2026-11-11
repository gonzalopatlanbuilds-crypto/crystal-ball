import type { Metadata } from "next";
import Link from "next/link";
import Aviso from "@/components/Aviso";
import ChipEvidencia from "@/components/ChipEvidencia";
import { leerEvidenciaPrecio } from "@/lib/evidencia-precio";
import {
  chipDeNivel,
  ETIQUETA_ESTADO_PRECIO,
  formatoMxn,
  NIVELES,
  pagosReales,
  type FilaPrecio,
  type Nivel,
} from "@/lib/precios";

export const metadata: Metadata = {
  title: "Precios — Validator",
  description: "Tres niveles de precio, cada uno con el estado real de su evidencia.",
};

// Página pública (mockup assets/w14-mockup-pricing.png). No pide sesión y
// no redirige a nadie: con o sin sesión se ve igual.
export default async function PricingPage() {
  const filas = await leerEvidenciaPrecio();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="bg-[#0b5e52] text-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <p className="text-2xl font-bold">
            <Link href="/" className="hover:underline">Validator</Link> — Precios
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Aviso />
        <h1 className="mt-6 text-xl font-bold text-zinc-900">Un precio, con la evidencia detrás</h1>
        <p className="mt-1 text-zinc-600">Esto es una hipótesis de precio, no un hecho probado.</p>

        {filas === null && (
          <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            No se pudo leer la evidencia de precio. Mientras tanto, ningún
            nivel se muestra como respaldado por evidencia.
          </p>
        )}

        <div className="mt-6 grid gap-4">
          {NIVELES.map((n) => (
            <TarjetaNivel key={n.id} nivel={n} filas={filas} />
          ))}
        </div>

        <p className="mt-6 text-sm text-zinc-600">
          Los precios son mensuales, en pesos mexicanos. Validator todavía no
          cobra: no hay pagos en línea.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/simulador" className="font-semibold text-[#0b5e52] underline">Simular ingresos con tus supuestos</Link>
        </p>
      </main>
    </div>
  );
}

function TarjetaNivel({ nivel, filas }: { nivel: Nivel; filas: FilaPrecio[] | null }) {
  const chip = chipDeNivel(nivel, filas);
  const conEvidencia = chip.tono === "evidencia";
  const filasNivel = nivel.usaEvidencia && filas ? filas : [];

  return (
    <section
      aria-labelledby={`nivel-${nivel.id}`}
      className={`rounded-2xl bg-white px-5 py-4 ${conEvidencia ? "border-2 border-[#0b5e52] shadow-sm" : "border border-zinc-300"}`}
    >
      <h2 id={`nivel-${nivel.id}`} className="text-xl font-bold text-zinc-900">
        {nivel.nombre}
        {conEvidencia && <span className="sr-only"> (el único nivel con evidencia real)</span>}
      </h2>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-4">
        {nivel.precioListaMxn !== null ? (
          <>
            <span className="text-3xl font-bold text-[#0b5e52]">{formatoMxn(nivel.precioListaMxn)}</span>
            <span className="text-zinc-600">MXN/mes</span>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold text-[#0b5e52]">Cotización</span>
            <span className="text-zinc-600">a medida</span>
          </>
        )}
      </p>
      <p className="mt-2 text-zinc-800">{nivel.segmento}</p>
      <p className="mt-3">
        <ChipEvidencia texto={chip.texto} tono={chip.tono} />
      </p>
      <p className="mt-3 text-sm text-zinc-600">
        {nivel.precioFundador
          ? `Precio fundador: ${formatoMxn(nivel.precioFundador.mxn)}/mes × ${nivel.precioFundador.meses} meses (precio de lista: ${formatoMxn(nivel.precioListaMxn ?? 0)}/mes)`
          : nivel.detalle}
      </p>

      <details className="group mt-4">
        <summary
          className={`cursor-pointer list-none rounded-lg border px-4 py-2 text-center font-semibold [&::-webkit-details-marker]:hidden ${
            conEvidencia ? "border-[#0b5e52] text-[#0b5e52]" : "border-zinc-300 text-zinc-600"
          }`}
        >
          <span className="group-open:hidden">Ver detalle</span>
          <span className="hidden group-open:inline">Ocultar detalle</span>
        </summary>
        <div className="mt-3 text-sm text-zinc-700">
          {nivel.usaEvidencia ? (
            <DetalleEvidencia detalle={nivel.detalle} filas={filasNivel} leidas={filas !== null} />
          ) : (
            <p>
              Nadie de este segmento ha dado una cifra todavía: el precio es
              una hipótesis de quien funda.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

function DetalleEvidencia({ detalle, filas, leidas }: { detalle: string; filas: FilaPrecio[]; leidas: boolean }) {
  if (!leidas) return <p>No se pudo leer la evidencia de este nivel.</p>;
  if (filas.length === 0) return <p>Todavía no hay evidencia registrada para este nivel.</p>;
  const pagos = pagosReales(filas);
  return (
    <>
      <p>{detalle}</p>
      <ul className="mt-2 grid gap-2">
        {filas.map((f) => (
          <li key={f.id} className="rounded-lg border border-zinc-200 px-3 py-2">
            <span className="font-semibold text-zinc-900">{formatoMxn(f.amount_mxn)}/mes</span>{" "}
            <span className="text-zinc-600">· {ETIQUETA_ESTADO_PRECIO[f.state]}</span>
            <span className="block text-zinc-600">{f.source}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-semibold text-zinc-900">
        Pagos reales: {pagos}. {pagos === 0 ? "Ninguna de estas cifras es una venta." : ""}
      </p>
      <p className="mt-1">Cada cifra se muestra por separado, con su estado. No se promedian.</p>
      <p className="mt-2">
        <Link href="/about" className="font-semibold text-[#0b5e52] underline">Ver el caso 10:1</Link>
      </p>
    </>
  );
}
