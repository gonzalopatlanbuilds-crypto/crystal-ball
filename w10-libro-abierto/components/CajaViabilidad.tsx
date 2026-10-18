import { ETIQUETA_VIABILIDAD, type Viabilidad } from "@/lib/viabilidad";

const ESTILO: Record<Viabilidad, { caja: string; titulo: string }> = {
  NOT_DEMONSTRATED: { caja: "border-red-700 bg-red-50", titulo: "text-red-800" },
  EVIDENCE_RECORDED_NOT_SUPPORTED: { caja: "border-amber-600 bg-amber-50", titulo: "text-amber-900" },
  SUPPORTED: { caja: "border-emerald-700 bg-emerald-50", titulo: "text-emerald-900" },
};

// La usan /modelo (con lo que falta) y /financiamiento (con la explicación
// pública). El texto es fijo, en código; nunca lo escribe la IA.
export default function CajaViabilidad({ estado, lineas }: { estado: Viabilidad; lineas: string[] }) {
  const e = ESTILO[estado];
  return (
    <section className={`rounded-xl border-2 p-4 ${e.caja}`}>
      <h2 className={`text-xl font-bold ${e.titulo}`}>Viabilidad: {ETIQUETA_VIABILIDAD[estado]}</h2>
      {lineas.map((l) => (
        <p key={l} className="mt-1 text-[15px] text-zinc-700">
          {l}
        </p>
      ))}
    </section>
  );
}
