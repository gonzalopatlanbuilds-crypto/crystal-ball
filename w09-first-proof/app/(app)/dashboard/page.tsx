import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { etiquetaIntento } from "@/lib/intentos";

interface MiEntrega {
  id: string;
  pseudonym: string;
  attempt_number: number;
  status: "pending_review" | "reviewed";
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { borrado } = await searchParams;
  const supabase = await createClient();
  // RLS: solo las propias.
  const { data: entregas, error } = await supabase
    .from("submissions")
    .select("id, pseudonym, attempt_number, status")
    .order("created_at", { ascending: false })
    .returns<MiEntrega[]>();
  if (error) console.error("DashboardPage: no se pudieron leer las entregas", error);

  // Bug reportado: el código solo se mostraba una vez, al crear la org, y
  // una segunda cuenta terminó creando otra org en vez de unirse. RLS deja
  // a cada miembro leer solo su propia org.
  const { data: org } = await supabase.from("orgs").select("join_code").maybeSingle<{ join_code: string }>();

  return (
    <main className="space-y-4">
      <h1 className="text-lg font-semibold text-zinc-900">Inicio</h1>
      {borrado === "1" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Se borraron todas tus entregas, sus revisiones y tu expediente.
        </p>
      )}

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

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Revisar a otras personas</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Revisa a ciegas la entrega de alguien más del piloto. Nunca verás su nombre ni tus propias entregas.
        </p>
        <Link
          href="/revisar"
          className="mt-3 block rounded-xl border border-teal-800 px-4 py-2.5 text-center text-sm font-medium text-teal-800 hover:bg-teal-50"
        >
          Ver entregas por revisar
        </Link>
      </section>

      {org && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Código de tu organización</h2>
          <p className="mt-1 font-mono text-xl font-semibold tracking-wider text-zinc-900">{org.join_code}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Compártelo para que otra persona (candidata o revisora) se una a este mismo piloto. Quien entre sin
            código y cree una organización nueva no podrá ver ni revisar estas entregas.
          </p>
        </section>
      )}

      {entregas && entregas.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Tus entregas</h2>
          <ul className="mt-2 divide-y divide-zinc-100">
            {entregas.map((e) => (
              <li key={e.id}>
                <Link href={`/entregas/${e.id}`} className="flex justify-between gap-3 py-2 text-sm hover:text-teal-800">
                  <span>
                    <span className="font-medium">{e.pseudonym}</span>
                    {etiquetaIntento(e.attempt_number) && (
                      <span className="ml-2 text-xs text-zinc-500">{etiquetaIntento(e.attempt_number)}</span>
                    )}
                  </span>
                  <span className="text-zinc-500">
                    {e.attempt_number !== 1
                      ? "práctica, no se revisa"
                      : e.status === "pending_review"
                        ? "expediente · pendiente de revisión"
                        : "expediente · revisado"}
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
