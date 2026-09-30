import { createClient } from "@/lib/supabase/server";
import {
  CASE_TYPES,
  CASE_TYPE_LABELS,
  ESCALAS,
  SIMULADO_AVISO,
  type CaseType,
} from "@/lib/casos";

interface VolumeRow {
  scale: number;
  case_type: CaseType;
  monthly_cases: number;
  is_simulated: boolean;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: volumen, error } = await supabase
    .from("case_volume_scenarios")
    .select("scale, case_type, monthly_cases, is_simulated")
    .returns<VolumeRow[]>();

  if (error) {
    console.error("DashboardPage: no se pudo leer case_volume_scenarios", error);
  }

  const casos = (escala: number, tipo: CaseType) =>
    volumen?.find((v) => v.scale === escala && v.case_type === tipo)?.monthly_cases;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-lg font-semibold text-zinc-900">Panel del piloto</h1>
      <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {SIMULADO_AVISO}
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
        Todavía no hay casos con tiempo registrado.
      </div>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">
          Volumen de casos por mes — distribución simulada
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Supuesto inventado para proyectar costo a escala (50% toma de
          cuenta, 30% suplantación, 20% colecta falsa). No proviene de casos
          reales.
        </p>

        {error || !volumen || volumen.length === 0 ? (
          <p className="mt-4 text-sm text-red-600">
            No se pudo cargar la distribución de volumen simulado.
          </p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-2 font-medium">Tipo de caso</th>
                {ESCALAS.map((e) => (
                  <th key={e} className="py-2 text-right font-medium">
                    {e.toLocaleString("es-MX")} casos/mes
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-800">
              {CASE_TYPES.map((tipo) => (
                <tr key={tipo}>
                  <td className="py-2">{CASE_TYPE_LABELS[tipo]}</td>
                  {ESCALAS.map((e) => (
                    <td key={e} className="py-2 text-right tabular-nums">
                      {casos(e, tipo)?.toLocaleString("es-MX") ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
