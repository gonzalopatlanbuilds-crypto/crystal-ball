import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chequear } from "@/lib/caso";
import { etiquetaIntento } from "@/lib/intentos";
import { leerDecisiones, leerObservaciones, nombreRevisor, type Recomendacion } from "@/lib/expediente";
import ChequeoCalculos from "@/components/ChequeoCalculos";
import ObservacionesIA from "@/components/ObservacionesIA";
import Expediente, { type DatosRevision } from "@/components/Expediente";
import BotonEliminar from "@/components/BotonEliminar";

interface Entrega {
  id: string;
  pseudonym: string;
  attempt_number: number;
  answer_growth: number | string | null;
  answer_margin: number | string | null;
  answer_dso: number | string | null;
  explanation: string;
  ai_observations: unknown;
  status: "pending_review" | "reviewed";
}

interface Revision {
  reviewer_id: string;
  created_at: string;
  conflict_declaration: string;
  recommendation: Recomendacion;
  note: string;
  observation_decisions: unknown;
}

// Vista del candidato sobre SU entrega (RLS: solo filas propias; el id de
// otra persona da 404). El intento 1 es la evidencia y se muestra como
// expediente (mockup 2); los reenvíos son práctica.
export default async function EntregaPage({ params }: PageProps<"/entregas/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: entrega, error } = await supabase
    .from("submissions")
    .select("id, pseudonym, attempt_number, answer_growth, answer_margin, answer_dso, explanation, ai_observations, status")
    .eq("id", id)
    .maybeSingle<Entrega>();

  if (error) console.error("EntregaPage: no se pudo leer la entrega", error);
  if (!entrega) notFound();

  const resultados = chequear({
    growth: entrega.answer_growth,
    margin: entrega.answer_margin,
    dso: entrega.answer_dso,
  });

  const volver = (
    <Link href="/dashboard" className="text-sm text-teal-800 hover:underline">
      ← Inicio
    </Link>
  );

  if (entrega.attempt_number !== 1) {
    return (
      <main className="space-y-4">
        <div>
          {volver}
          <h1 className="mt-2 text-lg font-semibold text-zinc-900">Tu entrega {entrega.pseudonym}</h1>
          <p className="text-sm font-medium text-zinc-700">{etiquetaIntento(entrega.attempt_number)}</p>
          <p className="text-sm text-zinc-600">
            Los reenvíos son práctica: no pasan a revisión humana. Tu expediente usa solo tu primer intento.
          </p>
        </div>
        <ChequeoCalculos resultados={resultados} />
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Tu explicación</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{entrega.explanation}</p>
        </section>
        <ObservacionesIA observaciones={entrega.ai_observations} />
      </main>
    );
  }

  // RLS de reviews: el candidato ve la revisión de su propia entrega, y el
  // perfil de quien revisó porque es de su misma org.
  const { data: rev, error: errRev } = await supabase
    .from("reviews")
    .select("reviewer_id, created_at, conflict_declaration, recommendation, note, observation_decisions")
    .eq("submission_id", entrega.id)
    .maybeSingle<Revision>();
  if (errRev) console.error("EntregaPage: no se pudo leer la revisión", errRev);

  let revision: DatosRevision | null = null;
  if (rev) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", rev.reviewer_id)
      .maybeSingle<{ display_name: string | null }>();
    revision = {
      revisor: nombreRevisor(perfil?.display_name),
      creadaEn: rev.created_at,
      conflicto: rev.conflict_declaration,
      recomendacion: rev.recommendation,
      nota: rev.note,
      decisiones: leerDecisiones(rev.observation_decisions),
    };
  }

  return (
    <main className="space-y-3">
      {volver}
      <Expediente
        seudonimo={entrega.pseudonym}
        resultados={resultados}
        explicacion={entrega.explanation}
        observaciones={leerObservaciones(entrega.ai_observations)}
        revision={revision}
        accion={<BotonEliminar />}
      />
    </main>
  );
}
