import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TablaSupuestos from "@/components/TablaSupuestos";
import { leerSupuestos } from "@/lib/leer-supuestos";

export default async function ModeloPage() {
  const supabase = await createClient();
  const [{ data: org }, { filas, error }] = await Promise.all([
    supabase.from("organizations").select("name, join_code").maybeSingle(),
    leerSupuestos(),
  ]);

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold text-zinc-900">Supuestos</h1>
        <Link href="/modelo/supuestos" className="text-sm font-medium text-[#0b5e52] underline">
          Editar supuestos
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          No se pudieron leer los supuestos. Recarga la página.
        </p>
      ) : filas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600">
          Todavía no hay supuestos.{" "}
          <Link href="/modelo/supuestos" className="underline">
            Agrégalos o carga los de ejemplo
          </Link>
          .
        </p>
      ) : (
        <TablaSupuestos filas={filas} />
      )}

      {org && (
        <p className="pt-4 text-xs text-zinc-500">
          Organización: {org.name} · código para tu equipo: <span className="font-mono">{org.join_code}</span>
        </p>
      )}
    </section>
  );
}
