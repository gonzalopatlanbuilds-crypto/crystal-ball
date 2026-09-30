interface Props {
  email?: string | null;
  orgName: string;
}

export default function AppHeader({ email, orgName }: Props) {
  return (
    <header className="bg-sky-900 text-white print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <div>
          <span className="text-lg font-semibold">CostoReal</span>
          <span className="ml-3 text-sm text-sky-200">{orgName}</span>
        </div>
        {email && (
          <div className="flex items-center gap-3 text-sm text-sky-100">
            <span>{email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-sky-700 px-2.5 py-1 hover:bg-sky-800"
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
