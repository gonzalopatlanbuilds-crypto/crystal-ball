export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-lg font-semibold text-zinc-900">Hallazgos de tu organización</h1>
      <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Datos simulados — ninguna escuela ni persona aquí es real.
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
        Todavía no hay hallazgos registrados. La captura de un hallazgo
        crítico llega en la siguiente feature.
      </div>
    </main>
  );
}
