interface Props {
  email?: string | null;
}

// Phone-first, como el mockup del operador: título y correo a la izquierda,
// "Cerrar sesión" a la derecha.
export default function AppHeader({ email }: Props) {
  return (
    <header className="bg-[#0b5e52] text-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-lg font-bold">Libro Abierto - Modelo</p>
          {email && <p className="truncate text-sm text-teal-100">{email}</p>}
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="shrink-0 rounded-md border border-teal-200/60 px-3 py-1.5 text-sm text-teal-50 hover:bg-[#094c43]"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </header>
  );
}
