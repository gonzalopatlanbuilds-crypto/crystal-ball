import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TablaSupuestos from "@/components/TablaSupuestos";
import BloqueResultado from "@/components/BloqueResultado";
import CajaViabilidad from "@/components/CajaViabilidad";
import BotonPublicar from "@/components/BotonPublicar";
import CajaAuditor from "@/components/CajaAuditor";
import { chequeoPorReglas } from "@/lib/chequeo-reglas";
import { leerSupuestos } from "@/lib/leer-supuestos";
import { calcularModelo, pruebaIndependencia } from "@/lib/modelo";
import { calcularViabilidad, queFalta } from "@/lib/viabilidad";

export default async function ModeloPage() {
  const supabase = await createClient();
  const [{ data: org }, { filas, error }, { count: evidencias, error: errorEvidencia }, { data: ultimo }] =
    await Promise.all([
      supabase.from("organizations").select("name, join_code, es_oficial").maybeSingle(),
      leerSupuestos(),
      supabase.from("payer_evidence").select("id", { count: "exact", head: true }),
      supabase
        .from("published_ledger")
        .select("version, published_at")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle<{ version: number; published_at: string }>(),
    ]);
  if (errorEvidencia) console.error("ModeloPage: conteo de evidencia falló", errorEvidencia);

  // El modelo y la viabilidad corren en el servidor con lo que hay en la
  // base. La base vuelve a calcular la viabilidad al publicar.
  const resultado = calcularModelo(filas);
  const independiente = pruebaIndependencia(filas);
  const hayEvidencia = (evidencias ?? 0) > 0;
  const viabilidad = calcularViabilidad(hayEvidencia, filas);
  const faltas = queFalta(hayEvidencia, filas);
  const fallaLectura = !!error || !!errorEvidencia;

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

      {!fallaLectura && (
        <div>
          <CajaViabilidad
            estado={viabilidad}
            lineas={faltas.length > 0 ? faltas : ["Evidencia de pagador, todos los supuestos sustentados y 10:1 cumplido."]}
          />
          <p className="mt-2 text-sm">
            <Link href="/modelo/pagador" className="font-medium text-[#0b5e52] underline">
              {hayEvidencia ? `Ver evidencia de pagador (${evidencias})` : "Registrar evidencia de un pagador"}
            </Link>
          </p>
        </div>
      )}

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
            Demostración en vivo con estos insumos (la prueba completa está en test:logica).
          </p>
        </section>
      )}

      {!error && <CajaAuditor reglas={chequeoPorReglas(filas)} />}

      {!fallaLectura && (
        <section>
          <BotonPublicar esOficial={!!org?.es_oficial} />
          <p className="mt-2 text-xs text-zinc-500">
            {ultimo
              ? `Última versión publicada: v${ultimo.version}. Cada publicación es una versión nueva; las anteriores no se borran.`
              : "Todavía no se ha publicado ninguna versión."}
          </p>
        </section>
      )}

      {org && (
        <p className="text-xs text-zinc-500">
          Organización: {org.name}
          {org.es_oficial ? " (oficial)" : ""} · código para tu equipo:{" "}
          <span className="font-mono">{org.join_code}</span>
        </p>
      )}
    </div>
  );
}
