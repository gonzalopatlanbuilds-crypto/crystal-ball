import { AVISO_SIMULADO } from "@/lib/avisos";

export default function Inicio() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{AVISO_SIMULADO}</p>
        <h1 className="text-center text-xl font-bold text-zinc-900">Validator — en construcción</h1>
      </div>
    </main>
  );
}
