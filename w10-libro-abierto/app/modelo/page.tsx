import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TablaSupuestos from "@/components/TablaSupuestos";
import BloqueResultado from "@/components/BloqueResultado";
import { leerSupuestos } from "@/lib/leer-supuestos";
import { calcularModelo, pruebaIndependencia } from "@/lib/modelo";

export default async function ModeloPage() {
  const supabase = await createClient();
  const [{ data: org }, { filas, error }] = await Promise.all([
    supabase.from("organizations").select("name, join_code").maybeSingle(),
    leerSupuestos(),
  ]);

  // El modelo corre en el servidor con lo que hay en la base. Sin sponsor:
  // y la prueba de abajo muestra que darle uno no cambia nada.
  const resultado = calcularModelo(filas);
  const independiente = pruebaIndependencia(filas);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
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
      </section>

      {!error && <BloqueResultado r={resultado} />}

      {!error && (
        <section
          className={`rounded-xl border p-4 ${independiente ? "border-[#0b5e52] bg-teal-50/50" : "border-red-700 bg-red-50"}`}
        >
          <h2 className={`text-base font-bold ${independiente ? "text-[#0b5e52]" : "text-red-800"}`}>
            Prueba de independencia
          </h2>
          <p className={`mt-1 text-[15px] ${independiente ? "text-[#0b5e52]" : "text-red-800"}`}>
            {independiente
              ? "[OK] Sin patrocinador / A / B: resultados idénticos"
              : "[FALLA] El resultado cambia según el patrocinador. No publiques hasta corregirlo."}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Se calcula ahora mismo con estos supuestos y tres patrocinadores simulados.
          </p>
        </section>
      )}

      {org && (
        <p className="text-xs text-zinc-500">
          Organización: {org.name} · código para tu equipo: <span className="font-mono">{org.join_code}</span>
        </p>
      )}
    </div>
  );
}
