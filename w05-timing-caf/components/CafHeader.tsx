interface Props {
  email?: string | null;
}

export default function CafHeader({ email }: Props) {
  return (
    <header className="bg-zinc-900 text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold">Folio CAF — Consola del operador</span>
        {email && (
          <div className="flex items-center gap-3 text-sm text-zinc-300">
            <span>{email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-zinc-600 px-2.5 py-1 hover:bg-zinc-800"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
