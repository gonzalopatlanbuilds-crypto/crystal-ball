export default function ConsultaPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">
          Consultar mi resultado
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Sin login, sin cuenta, sin app. Ingresa tu folio y tu apellido para
          ver tu resultado.
        </p>

        <div className="mt-6 space-y-3 text-left">
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Folio
            </label>
            <input
              type="text"
              disabled
              placeholder="MX-XXXX-XXX"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Apellido
            </label>
            <input
              type="text"
              disabled
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-400"
            />
          </div>
        </div>

        <button
          type="button"
          disabled
          className="mt-6 w-full rounded-lg bg-zinc-300 px-4 py-2.5 text-sm font-medium text-white"
        >
          Buscar (disponible próximamente)
        </button>
      </div>
    </main>
  );
}
