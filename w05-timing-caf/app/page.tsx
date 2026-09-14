import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Folio CAF</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Un resultado de tamizaje capturado en un CAF, portátil y del
          paciente — sin smartphone, sin cuenta, sin login para consultarlo.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/consulta"
            className="block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Consultar mi resultado (folio + apellido)
          </Link>
          <Link
            href="/login"
            className="block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Soy operador de un CAF
          </Link>
        </div>
      </div>
    </main>
  );
}
