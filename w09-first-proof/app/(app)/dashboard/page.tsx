import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface MiEntrega {
  id: string;
  pseudonym: string;
  status: "pending_review" | "reviewed";
}

// La Feature 4 agrega aquí la lista de entregas pendientes de revisión.
export default async function DashboardPage() {
  const supabase = await createClient();
  // RLS: solo las propias.
  const { data: entregas, error } = await supabase
    .from("submissions")
    .select("id, pseudonym, status")
    .order("created_at", { ascending: false })
    .returns<MiEntrega[]>();
  if (error) console.error("DashboardPage: no se pudieron leer las entregas", error);

  return (
    <main className="space-y-4">
      <h1 className="text-lg font-semibold text-zinc-900">Inicio</h1>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Cómo funciona</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
          <li>Resuelves un caso financiero ficticio desde tu teléfono (menos de 15 minutos).</li>
          <li>Otra persona del piloto lo revisa sin saber quién eres.</li>
          <li>Recibes un expediente con tu trabajo, quién lo revisó y lo que no prueba.</li>
        </ol>
        <Link
          href="/caso"
          className="mt-4 block rounded-xl bg-teal-800 px-4 py-3 text-center text-base font-medium text-white hover:bg-teal-700"
        >
          Resolver el caso
        </Link>
        <p className="mt-3 text-xs text-zinc-500">
          Puedes borrar tu entrega y tu expediente cuando quieras.
        </p>
      </section>

      {entregas && entregas.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Tus entregas</h2>
          <ul className="mt-2 divide-y divide-zinc-100">
            {entregas.map((e) => (
              <li key={e.id}>
                <Link href={`/entregas/${e.id}`} className="flex justify-between py-2 text-sm hover:text-teal-800">
                  <span className="font-medium">{e.pseudonym}</span>
                  <span className="text-zinc-500">
                    {e.status === "pending_review" ? "pendiente de revisión" : "revisada"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
