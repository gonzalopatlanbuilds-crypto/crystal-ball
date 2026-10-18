import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FormularioEvidencia from "@/components/FormularioEvidencia";
import { esTipo, TIPOS_EVIDENCIA } from "@/lib/pagador";

interface FilaEvidencia {
  id: string;
  kind: string;
  description: string;
  document_ref: string;
  recorded_by: string;
  recorded_on: string;
}

export default async function PagadorPage() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: filas, error },
    { data: perfiles },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("payer_evidence")
      .select("id, kind, description, document_ref, recorded_by, recorded_on")
      .order("created_at", { ascending: false })
      .returns<FilaEvidencia[]>(),
    // Para mostrar quién registró cada una (perfiles de la misma org; RLS).
    supabase.from("profiles").select("id, email").returns<{ id: string; email: string }[]>(),
  ]);
  if (error) console.error("PagadorPage: select falló", error);
  const correo = new Map((perfiles ?? []).map((p) => [p.id, p.email]));

  return (
    <section className="space-y-6">
      <div>
        <Link href="/modelo" className="text-sm text-[#0b5e52] underline">
          ← Volver al modelo
        </Link>
        <h1 className="mt-2 text-xl font-bold text-zinc-900">Evidencia de pagador</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Sin evidencia de un pagador, la viabilidad es &ldquo;NO DEMOSTRADA&rdquo;. La evidencia no se edita ni se
          borra: una corrección es un registro nuevo. La descripción y la referencia no se publican.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          No se pudo leer la evidencia. Recarga la página.
        </p>
      ) : !filas?.length ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600">
          Todavía no hay evidencia registrada de ningún pagador.
        </p>
      ) : (
        <ul className="space-y-3">
          {filas.map((f) => (
            <li key={f.id} className="rounded-xl border border-zinc-200 p-4 text-sm">
              <p className="font-semibold text-zinc-900">{esTipo(f.kind) ? TIPOS_EVIDENCIA[f.kind] : f.kind}</p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-800">{f.description}</p>
              <p className="mt-2 text-xs break-all text-zinc-500">
                Documento: {f.document_ref} · fecha {f.recorded_on} · registró{" "}
                {correo.get(f.recorded_by) ?? "otra persona del equipo"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-zinc-200 p-4">
        <h2 className="text-base font-bold text-zinc-900">Registrar evidencia</h2>
        <div className="mt-3">
          <FormularioEvidencia email={user?.email ?? null} />
        </div>
      </div>
    </section>
  );
}
