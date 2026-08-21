import type { AvisoSimulado } from "@/lib/fixtures";

type Props = {
  aviso: AvisoSimulado;
  datosObjetados: string[];
};

export default function PantallaConfirmacion({ datosObjetados }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">Confirmación</h1>
      <p className="text-base text-zinc-600">
        Objetaste {datosObjetados.length} dato(s). El envío real a Supabase se
        construye en el siguiente paso.
      </p>
    </div>
  );
}
