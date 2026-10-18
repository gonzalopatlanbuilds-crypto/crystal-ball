import { ETIQUETA_ESTADO, type EstadoSupuesto } from "@/lib/supuestos";

const ESTILO: Record<EstadoSupuesto, string> = {
  invented: "border-red-700 bg-red-50 text-red-800",
  weak: "border-amber-600 bg-amber-50 text-amber-900",
  sustained: "border-emerald-700 bg-emerald-50 text-emerald-800",
};

export default function EstadoBadge({ estado }: { estado: EstadoSupuesto }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${ESTILO[estado]}`}>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
