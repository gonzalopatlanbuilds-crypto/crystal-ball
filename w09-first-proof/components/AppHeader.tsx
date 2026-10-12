interface Props {
  email?: string | null;
  orgName: string;
}

// Phone-first: en 375px el correo y el botón no caben junto al nombre, así
// que van en una segunda línea.
export default function AppHeader({ email, orgName }: Props) {
  return (
    <header className="bg-teal-900 text-white print:hidden">
      <div className="mx-auto max-w-md px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-semibold">First Proof</span>
          <span className="truncate text-sm text-teal-200">{orgName}</span>
        </div>
        {email && (
          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-teal-100">
            <span className="truncate">{email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="shrink-0 rounded-md border border-teal-700 px-2.5 py-1 hover:bg-teal-800"
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
