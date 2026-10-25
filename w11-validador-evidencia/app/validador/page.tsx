import { createClient } from "@/lib/supabase/server";
import FormularioCarga from "@/components/FormularioCarga";
import TablaRechazadas from "@/components/TablaRechazadas";
import { fechaHora } from "@/lib/formato";
import type { FilaEvidencia, FilaRechazada } from "@/lib/csv";

interface Version {
  id: string;
  uploaded_at: string;
  uploaded_by: string;
  source_filename: string;
  raw_rows: FilaEvidencia[];
  invalid_rows: FilaRechazada[];
  is_example: boolean;
}

export default async function ValidadorPage() {
  const supabase = await createClient();
  const [{ data: versiones, error }, { data: perfiles }] = await Promise.all([
    supabase
      .from("evidence_versions")
      .select("id, uploaded_at, uploaded_by, source_filename, raw_rows, invalid_rows, is_example")
      .order("uploaded_at", { ascending: false })
      .limit(20)
      .returns<Version[]>(),
    supabase.from("profiles").select("id, email"),
  ]);
  if (error) {
    console.error("ValidadorPage: no se pudieron leer las versiones", error);
  }
  const correo = new Map((perfiles ?? []).map((p) => [p.id as string, p.email as string]));

  return (
    <div>
      <section>
        <h1 className="text-xl font-bold text-zinc-900">Cargar evidencia de empaque</h1>
        <p className="mt-1 text-sm text-zinc-600">
          CSV por proveedor y SKU con las columnas sku, supplier, weight_g, material, packaging_revision_date y
          evidence_folio. Cada carga crea una versión nueva; nada se sobrescribe.
        </p>
        <div className="mt-4">
          <FormularioCarga />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Versiones guardadas</h2>
        {error ? (
          <p className="mt-2 text-sm text-red-700">No se pudieron cargar las versiones. Recarga la página.</p>
        ) : !versiones?.length ? (
          <p className="mt-2 text-sm text-zinc-600">
            Todavía no hay versiones. Sube un CSV o usa “Cargar ejemplo” para ver cómo funciona.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {versiones.map((v) => (
              <li key={v.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-all font-medium text-zinc-900">{v.source_filename}</p>
                  {v.is_example && (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">
                      Ejemplo simulado
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  {fechaHora(v.uploaded_at)} · {correo.get(v.uploaded_by) ?? "persona de tu organización"}
                </p>
                <p className="mt-1 text-sm text-zinc-700">
                  {v.raw_rows.length} {v.raw_rows.length === 1 ? "fila aceptada" : "filas aceptadas"}
                  {v.invalid_rows.length > 0 && ` · ${v.invalid_rows.length} rechazadas`}
                </p>
                {v.invalid_rows.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-[#0b5e52]">Ver filas rechazadas y su motivo</summary>
                    <TablaRechazadas filas={v.invalid_rows} />
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
