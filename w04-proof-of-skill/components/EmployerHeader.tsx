interface Props {
  email?: string | null;
}

export default function EmployerHeader({ email }: Props) {
  return (
    <header className="bg-blue-900 text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold">ProofLayer — Consola del empleador</span>
        {email && (
          <div className="flex items-center gap-3 text-sm text-blue-100">
            <span>{email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-blue-300/50 px-2.5 py-1 hover:bg-blue-800"
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
