import Link from "next/link";
import FormularioSupuesto from "@/components/FormularioSupuesto";
import TablaSupuestos from "@/components/TablaSupuestos";
import { BotonSembrar } from "@/components/BotonesSupuesto";
import { leerSupuestos } from "@/lib/leer-supuestos";
import { CLAVES, SEMBRADOS } from "@/lib/supuestos";

export default async function SupuestosPage() {
  const { filas, error } = await leerSupuestos();
  const existentes = new Set(filas.map((f) => f.key));
  const disponibles = CLAVES.filter((k) => !existentes.has(k));
  const faltanEjemplo = SEMBRADOS.filter((s) => !existentes.has(s.key)).length;

  return (
    <section className="space-y-6">
      <div>
        <Link href="/modelo" className="text-sm text-[#0b5e52] underline">
          ← Volver al modelo
        </Link>
        <h1 className="mt-2 text-xl font-bold text-zinc-900">Supuestos</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Cada supuesto lleva un estado. Toca uno para editar su valor, estado o fuente.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          No se pudieron leer los supuestos. Recarga la página.
        </p>
      ) : filas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600">
          Todavía no hay supuestos. Sin ellos, el modelo no puede calcular nada: cada resultado dirá
          &ldquo;no calculable&rdquo;.
        </div>
      ) : (
        <TablaSupuestos filas={filas} editable />
      )}

      {!error && faltanEjemplo > 0 && <BotonSembrar faltan={faltanEjemplo} />}

      {!error && disponibles.length > 0 && (
        <div className="rounded-xl border border-zinc-200 p-4">
          <h2 className="text-base font-bold text-zinc-900">Agregar supuesto</h2>
          <div className="mt-3">
            <FormularioSupuesto
              clavesDisponibles={disponibles}
              inicial={{ key: "", value_num: "", status: "invented", source_url: "", source_date: "", note: "" }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
