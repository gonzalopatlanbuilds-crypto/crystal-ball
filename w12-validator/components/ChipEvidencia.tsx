import type { TonoChip } from "@/lib/precios";

const ESTILO: Record<TonoChip, string> = {
  evidencia: "border-[#0b5e52] bg-teal-50 text-[#0b5e52]",
  "no-probado": "border-amber-700 bg-amber-50 text-amber-800",
  hipotesis: "border-zinc-500 bg-zinc-100 text-zinc-700",
};

// Chip del estado de evidencia. El texto siempre va escrito: el color solo
// acompaña, nunca es la única señal.
export default function ChipEvidencia({ texto, tono }: { texto: string; tono: TonoChip }) {
  return (
    <span className={`inline-block rounded-full border px-3 py-0.5 text-sm font-semibold ${ESTILO[tono]}`}>
      {texto}
    </span>
  );
}
