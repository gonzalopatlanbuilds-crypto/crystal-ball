import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormularioDecision from "@/components/FormularioDecision";
import { fechaHora } from "@/lib/formato";
import { diferenciaPorcentual, HISTORIAL_DECISION, type Decision } from "@/lib/decisiones";
import { ETIQUETA_ESTADO, ETIQUETA_TIPO, type EstadoHallazgo, type TipoHallazgo } from "@/lib/validador";

interface Hallazgo {
  id: string;
  type: TipoHallazgo;
  sku: string;
  supplier: string | null;
  status: EstadoHallazgo;
  details: Record<string, unknown>;
  created_at: string;
  evidence_version_id: string;
}
interface Procedencia {
  version_id?: string | null;
  archivo: string;
  fila: number;
  uploaded_at?: string | null;
  uploaded_by?: string;
  weight_g?: number;
  material?: string;
  packaging_revision_date?: string;
  evidence_folio?: string;
  sku?: string;
  supplier?: string;
}
interface DecisionFila {
  id: string;
  decision: Decision;
  note: string;
  decided_by: string;
  decided_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));

function Caja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-base font-semibold text-zinc-900">{titulo}</h2>
      <div className="mt-2 space-y-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">{children}</div>
    </section>
  );
}

export default async function HallazgoPage({ params }: PageProps<"/validador/hallazgos/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: h, error } = await supabase
    .from("findings")
    .select("id, type, sku, supplier, status, details, created_at, evidence_version_id")
    .eq("id", id)
    .maybeSingle<Hallazgo>();
  if (error) {
    console.error("HallazgoPage: no se pudo leer el hallazgo", error);
    throw new Error("No se pudo leer el hallazgo");
  }
  // RLS: un hallazgo de otra organización simplemente no existe aquí.
  if (!h) notFound();

  const [{ data: version }, { data: decisiones, error: errorDecisiones }, { data: perfiles }] = await Promise.all([
    supabase.from("evidence_versions").select("source_filename, uploaded_at, uploaded_by").eq("id", h.evidence_version_id).maybeSingle(),
    supabase
      .from("decisions")
      .select("id, decision, note, decided_by, decided_at")
      .eq("finding_id", h.id)
      .order("decided_at", { ascending: true })
      .order("id")
      .returns<DecisionFila[]>(),
    supabase.from("profiles").select("id, email"),
  ]);
  if (errorDecisiones) {
    console.error("HallazgoPage: no se pudieron leer las decisiones", errorDecisiones);
  }
  const correo = (uid?: string) => (perfiles ?? []).find((p) => p.id === uid)?.email ?? "persona de tu organización";
  const d = h.details;
  const anterior = (d.anterior ?? d.ultima_aceptada) as Procedencia | undefined;
  const nueva = d.nueva as Procedencia | undefined;
  const cargaNueva = version ? `${fechaHora(version.uploaded_at)}` : "";

  return (
    <div>
      <Link href="/validador/hallazgos" className="text-sm text-[#0b5e52] underline">
        ← Volver a hallazgos
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <h1 className="min-w-0 break-words text-xl font-bold text-zinc-900">
          {h.sku} — {ETIQUETA_TIPO[h.type]}
        </h1>
        <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700">{ETIQUETA_ESTADO[h.status]}</span>
      </div>
      {h.supplier && <p className="text-sm text-zinc-600">{h.supplier}</p>}

      <Caja titulo="Datos">
        {h.type === "value_conflict" &&
          (d.cambios as { campo: string; anterior: number | string; nuevo: number | string }[]).map((c) =>
            c.campo === "weight_g" ? (
              <div key={c.campo}>
                <p>
                  Peso declarado por {h.supplier} (carga {anterior?.uploaded_at ? fechaHora(anterior.uploaded_at) : "anterior"}): {c.anterior} g
                </p>
                <p>
                  Peso declarado por {h.supplier} (carga {cargaNueva || "nueva"}): {c.nuevo} g
                </p>
                {diferenciaPorcentual(Number(c.anterior), Number(c.nuevo)) && (
                  <p className="font-semibold text-red-700">
                    Diferencia: {diferenciaPorcentual(Number(c.anterior), Number(c.nuevo))} respecto al valor anterior
                  </p>
                )}
              </div>
            ) : (
              <div key={c.campo}>
                <p>Material anterior: {String(c.anterior)}</p>
                <p>Material nuevo: {String(c.nuevo)}</p>
              </div>
            ),
          )}
        {h.type === "late_revision" && (
          <>
            <p>Evidencia aceptada el {fechaCorta(d.fecha_evidencia_aceptada as string)}.</p>
            <p>Empaque revisado el {fechaCorta(d.fecha_revision as string)}: la evidencia aceptada puede describir el empaque anterior.</p>
          </>
        )}
        {h.type === "missing_supplier" && anterior && (
          <>
            <p>
              Última evidencia aceptada de {h.supplier}: {anterior.weight_g} g, {anterior.material}, folio {anterior.evidence_folio}.
            </p>
            <p>No aparece en {String(d.archivo_actual)}.</p>
          </>
        )}
        {h.type === "possible_duplicate" && (
          <>
            <p>
              El folio <span className="font-mono">{String(d.folio)}</span> se cita para más de un SKU o proveedor. Es un posible
              duplicado, sin verificar:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Esta carga: {nueva?.sku} ({nueva?.supplier}), fila {nueva?.fila}
              </li>
              {(d.otros_usos as Procedencia[]).map((u, i) => (
                <li key={i}>
                  {u.archivo}, fila {u.fila}: {u.sku} ({u.supplier}){u.uploaded_at ? ` · ${fechaHora(u.uploaded_at)}` : " · esta misma carga"}
                </li>
              ))}
            </ul>
          </>
        )}
      </Caja>

      <Caja titulo="Procedencia">
        {version && (
          <p>
            Carga que generó el hallazgo: {version.source_filename}
            {nueva?.fila ? `, fila ${nueva.fila}` : ""} · {correo(version.uploaded_by)}, {fechaHora(version.uploaded_at)}
          </p>
        )}
        {anterior && (
          <p>
            Evidencia aceptada anterior: {anterior.archivo}, fila {anterior.fila}
            {anterior.uploaded_by ? ` · ${correo(anterior.uploaded_by)}` : ""}
            {anterior.uploaded_at ? `, ${fechaHora(anterior.uploaded_at)}` : ""}
          </p>
        )}
        <p className="text-zinc-600">Versión anterior conservada, no sobrescrita.</p>
      </Caja>

      <section className="mt-5">
        <h2 className="text-base font-semibold text-zinc-900">Decisión del revisor</h2>
        <FormularioDecision findingId={h.id} />
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-zinc-900">Historial de decisiones</h2>
        {errorDecisiones ? (
          <p className="mt-2 text-sm text-red-700">No se pudo cargar el historial. Recarga la página.</p>
        ) : !decisiones?.length ? (
          <p className="mt-2 text-sm text-zinc-600">Todavía no hay decisiones. El hallazgo sigue pendiente.</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {decisiones.map((x, i) => (
              <li key={x.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                <p className="font-semibold text-zinc-900">
                  {i + 1}. {HISTORIAL_DECISION[x.decision]}
                  {i === decisiones.length - 1 && <span className="ml-2 text-xs font-normal text-zinc-500">(vigente)</span>}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-zinc-700">{x.note}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {correo(x.decided_by)} · {fechaHora(x.decided_at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
