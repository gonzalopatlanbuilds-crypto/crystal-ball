import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularRiesgo } from "@/lib/scoring";
import { RANGOS_EDAD, SINTOMAS, type RangoEdadValue, type SintomaValue } from "@/lib/screenings";
import PrintButton from "@/components/PrintButton";

interface ScreeningRow {
  id: string;
  folio: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_phone: string | null;
  glucose_mgdl: number;
  family_history: boolean;
  symptoms: SintomaValue[];
  age_band: RangoEdadValue;
  created_at: string;
}

export default async function ScreeningDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // La policy "operators select own screenings" ya garantiza que esta
  // query solo puede devolver una fila si operator_id = auth.uid() —
  // si la fila es de otro operador, Supabase la trata como inexistente.
  const { data: screening, error } = await supabase
    .from("screenings")
    .select(
      "id, folio, patient_first_name, patient_last_name, patient_phone, glucose_mgdl, family_history, symptoms, age_band, created_at"
    )
    .eq("id", id)
    .single<ScreeningRow>();

  if (error || !screening) {
    notFound();
  }

  const riesgo = calcularRiesgo({
    glucoseMgdl: screening.glucose_mgdl,
    familyHistory: screening.family_history,
    symptoms: screening.symptoms,
    ageBand: screening.age_band,
  });

  const etiquetaEdad = RANGOS_EDAD.find((r) => r.value === screening.age_band)?.label;
  const etiquetasSintomas = screening.symptoms.map(
    (s) => SINTOMAS.find((item) => item.value === s)?.label ?? s
  );

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Volver
        </Link>
        <PrintButton />
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-zinc-500">Comprobante de tamizaje — Datos simulados</p>
        <p className="mt-3 text-3xl font-bold tracking-widest text-zinc-900">{screening.folio}</p>
        <p className="mt-2 text-sm text-zinc-500">
          {screening.patient_first_name} {screening.patient_last_name}
        </p>

        <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Guarda este folio junto con tu apellido — es lo único que necesitas para consultar tu
          resultado después, sin cuenta ni celular.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Resultado (vista operador)</h2>
        <p className="mt-2 text-sm text-zinc-700">
          Nivel de riesgo:{" "}
          <span className={riesgo.nivel === "alto" ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
            {riesgo.nivel === "alto" ? "Alto" : "Bajo"}
          </span>{" "}
          (score {riesgo.score})
        </p>
        <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600">
          {riesgo.motivos.length === 0 && <li>Sin factores de riesgo detectados por las reglas.</li>}
          {riesgo.motivos.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>

        <div className="mt-4 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
          <p>Glucosa: {screening.glucose_mgdl} mg/dL</p>
          <p>Antecedente familiar: {screening.family_history ? "Sí" : "No"}</p>
          <p>Síntomas: {etiquetasSintomas.length > 0 ? etiquetasSintomas.join(", ") : "Ninguno"}</p>
          <p>Edad: {etiquetaEdad}</p>
          {screening.patient_phone && <p>Teléfono: {screening.patient_phone}</p>}
        </div>
      </div>
    </main>
  );
}
