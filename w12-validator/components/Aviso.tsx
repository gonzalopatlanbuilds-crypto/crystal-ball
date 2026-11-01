import { AVISO_SIMULADO } from "@/lib/avisos";

// Banner de datos simulados + cláusula de sombra. Un solo componente para
// que ninguna pantalla lo escriba distinto.
export default function Aviso({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}>
      {AVISO_SIMULADO}
    </p>
  );
}
