import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chequear } from "@/lib/caso";
import { etiquetaIntento } from "@/lib/intentos";
import ChequeoCalculos from "@/components/ChequeoCalculos";
import ObservacionesIA from "@/components/ObservacionesIA";

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

// Vista del candidato sobre SU entrega. RLS solo devuelve filas propias,
// así que el id de otra persona da 404 aunque exista. La Feature 4 convierte
// esta página en el expediente completo.
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

  const intento = etiquetaIntento(entrega.attempt_number);

  const resultados = chequear({
    growth: entrega.answer_growth,
    margin: entrega.answer_margin,
    dso: entrega.answer_dso,
  });

  return (
    <main className="space-y-4">
      <div>
        <Link href="/dashboard" className="text-sm text-teal-800 hover:underline">
          ← Inicio
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">Tu entrega {entrega.pseudonym}</h1>
        {intento && <p className="text-sm font-medium text-zinc-700">{intento}</p>}
        <p className="text-sm text-zinc-600">
          {entrega.status === "pending_review"
            ? "Pendiente de revisión humana. Quien la revise verá solo el seudónimo, no tu nombre."
            : "Revisada."}
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
