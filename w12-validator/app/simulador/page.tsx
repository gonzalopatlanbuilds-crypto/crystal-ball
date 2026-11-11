import type { Metadata } from "next";
import Link from "next/link";
import Aviso from "@/components/Aviso";
import SimuladorCliente from "@/components/SimuladorCliente";
import { leerEvidenciaPrecio } from "@/lib/evidencia-precio";
import { pagosReales } from "@/lib/precios";

export const metadata: Metadata = {
  title: "Simulador de ingresos — Validator",
  description: "Proyección de ingresos con supuestos editables. No es evidencia.",
};

// Página pública. El simulador es del lado del cliente y nunca escribe en
// la base; esta página solo lee cuántos pagos reales hay para recordarlo
// arriba, separado de los supuestos.
export default async function SimuladorPage() {
  const filas = await leerEvidenciaPrecio();

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Aviso />
        <h1 className="mt-6 text-xl font-bold text-zinc-900">Simulador de ingresos</h1>
        <p className="mt-1 text-zinc-600">
          Una proyección con supuestos, no un hecho. Ningún número de esta
          página cambia un precio ni la evidencia.
        </p>
        <p className="mt-4 rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm text-zinc-800">
          <span className="font-semibold">Evidencia real hoy: </span>
          {filas === null
            ? "no se pudo leer."
            : `${pagosReales(filas)} ${pagosReales(filas) === 1 ? "pago" : "pagos"}. Esto es una proyección.`}{" "}
          <Link href="/about" className="font-semibold text-[#0b5e52] underline">Ver la evidencia</Link>
        </p>
        <SimuladorCliente />
      </main>
    </div>
  );
}
