import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface Pendiente {
  id: string;
  pseudonym: string;
}

// Lista ciega: solo seudónimos, vía blind_pending_submissions() (nunca
// nombre, correo, id del candidato ni fecha). Excluye las propias y los
// reenvíos.
export default async function RevisarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pendientesRaw, error } = await supabase.rpc("blind_pending_submissions");
  if (error) console.error("RevisarPage: blind_pending_submissions falló", error);
  const pendientes = (pendientesRaw as unknown as Pendiente[] | null) ?? [];

  // Las que esta persona ya firmó (RLS: reviewer_id = auth.uid()).
  const { data: mias } = await supabase
    .from("reviews")
    .select("submission_id")
    .eq("reviewer_id", user!.id)
    .returns<{ submission_id: string }[]>();
  const revisadas: Pendiente[] = [];
  for (const r of mias ?? []) {
    const { data } = await supabase.rpc("blind_submission", { p_id: r.submission_id });
    const fila = (data as unknown as Pendiente[] | null)?.[0];
    if (fila) revisadas.push({ id: fila.id, pseudonym: fila.pseudonym });
  }

  return (
    <main className="space-y-4">
      <div>
        <Link href="/dashboard" className="text-sm text-teal-800 hover:underline">
          ← Inicio
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">Revisar entregas</h1>
        <p className="text-sm text-zinc-600">
          Solo ves un seudónimo. Nunca sabrás quién es, y nunca verás tus propias entregas aquí.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Pendientes</h2>
        {pendientes.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No hay entregas pendientes de revisión.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            {pendientes.map((p) => (
              <li key={p.id}>
                <Link href={`/revisar/${p.id}`} className="flex justify-between py-2 text-sm hover:text-teal-800">
                  <span className="font-medium">{p.pseudonym}</span>
                  <span className="text-zinc-500">revisar →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revisadas.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Revisadas por ti</h2>
          <ul className="mt-2 divide-y divide-zinc-100">
            {revisadas.map((p) => (
              <li key={p.id}>
                <Link href={`/revisar/${p.id}`} className="flex justify-between py-2 text-sm hover:text-teal-800">
                  <span className="font-medium">{p.pseudonym}</span>
                  <span className="text-zinc-500">ver expediente →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
