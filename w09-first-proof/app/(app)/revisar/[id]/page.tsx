import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chequear } from "@/lib/caso";
import { leerDecisiones, leerObservaciones, nombreRevisor, type Recomendacion } from "@/lib/expediente";
import TablaCaso from "@/components/TablaCaso";
import ChequeoCalculos from "@/components/ChequeoCalculos";
import FormularioRevision from "@/components/FormularioRevision";
import Expediente from "@/components/Expediente";

// Exactamente lo que devuelve blind_submission(): sin candidate_id, nombre,
// correo, escuela, fecha ni número de intento.
interface Ciega {
  id: string;
  pseudonym: string;
  answer_growth: number | string | null;
  answer_margin: number | string | null;
  answer_dso: number | string | null;
  explanation: string;
  ai_observations: unknown;
  status: "pending_review" | "reviewed";
}

export default async function RevisarEntregaPage({ params }: PageProps<"/revisar/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const volver = (
    <Link href="/revisar" className="text-sm text-teal-800 hover:underline">
      ← Revisar entregas
    </Link>
  );

  // RLS: si esta consulta la encuentra, la entrega es tuya.
  const { data: propia } = await supabase.from("submissions").select("id").eq("id", id).maybeSingle();
  if (propia) {
    return (
      <main className="space-y-3">
        {volver}
        <p className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
          No puedes revisar tu propia entrega. Pide a otra persona del piloto que la revise.
        </p>
      </main>
    );
  }

  const { data, error } = await supabase.rpc("blind_submission", { p_id: id });
  if (error) console.error("RevisarEntregaPage: blind_submission falló", error);
  const entrega = (data as unknown as Ciega[] | null)?.[0];
  if (!entrega) notFound();

  const resultados = chequear({
    growth: entrega.answer_growth,
    margin: entrega.answer_margin,
    dso: entrega.answer_dso,
  });
  const observaciones = leerObservaciones(entrega.ai_observations);

  if (entrega.status === "reviewed") {
    const { data: rev } = await supabase
      .from("reviews")
      .select("created_at, conflict_declaration, recommendation, note, observation_decisions")
      .eq("submission_id", id)
      .eq("reviewer_id", user!.id)
      .maybeSingle<{
        created_at: string;
        conflict_declaration: string;
        recommendation: Recomendacion;
        note: string;
        observation_decisions: unknown;
      }>();
    if (!rev) notFound();
    const { data: perfil } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user!.id)
      .maybeSingle<{ display_name: string | null }>();

    return (
      <main className="space-y-3">
        {volver}
        <Expediente
          seudonimo={entrega.pseudonym}
          resultados={resultados}
          explicacion={entrega.explanation}
          observaciones={observaciones}
          vista="revisor"
          revision={{
            revisor: nombreRevisor(perfil?.display_name),
            creadaEn: rev.created_at,
            conflicto: rev.conflict_declaration,
            recomendacion: rev.recommendation,
            nota: rev.note,
            decisiones: leerDecisiones(rev.observation_decisions),
          }}
        />
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <div>
        {volver}
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">Revisión de {entrega.pseudonym}</h1>
        <p className="text-sm text-zinc-600">
          Juzgas C2 (explica qué cambió con sus palabras) y C3 (propone qué revisar primero). C1 ya lo revisó el
          sistema.
        </p>
      </div>
      <TablaCaso />
      <ChequeoCalculos resultados={resultados} />
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Explicación del candidato</h2>
        <p className="text-xs text-zinc-500">
          Si el texto revela quién es (un nombre, una escuela), no lo uses en tu revisión y decláralo como conflicto si
          conoces a la persona.
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{entrega.explanation}</p>
      </section>
      <FormularioRevision submissionId={entrega.id} observaciones={observaciones ?? []} />
    </main>
  );
}
