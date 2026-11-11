import Link from "next/link";
import Aviso from "@/components/Aviso";

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
      <Aviso />
      <h1 className="mt-6 text-xl font-bold text-zinc-900">Esta página no existe</h1>
      <p className="mt-2 text-sm text-zinc-600">Revisa la dirección o vuelve a una de estas:</p>
      <p className="mt-4 flex gap-4 text-sm">
        <Link href="/validador" className="text-[#0b5e52] underline">
          Validador
        </Link>
        <Link href="/login" className="text-[#0b5e52] underline">
          Iniciar sesión
        </Link>
      </p>
    </main>
  );
}
