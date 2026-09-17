import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { etiquetaEscenario, STATUS_LABELS } from "@/lib/findings";
import { urlFirmadaEvidencia } from "@/lib/storage";
import ClosureForm from "@/components/ClosureForm";
import { enviarCierre } from "@/app/(app)/closures/actions";

interface FindingRow {
  id: string;
  scenario_label: string;
  description: string;
  corrective_action: string;
  deadline: string;
  status: string;
  created_at: string;
  reporter_id: string;
  owner_id: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  email: string;
}

interface ClosureRow {
  id: string;
  closed_by: string;
  photo_path: string;
  description: string;
  same_day_flag: boolean;
  ai_note: string | null;
  ai_label: string | null;
  verifier_id: string | null;
  decision: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

function nombrePerfil(p: ProfileRow | undefined): string {
  if (!p) return "—";
  return p.display_name ? `${p.display_name} (${p.email})` : p.email;
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-zinc-100 text-zinc-700",
  pending_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: finding } = await supabase
    .from("findings")
    .select(
      "id, scenario_label, description, corrective_action, deadline, status, created_at, reporter_id, owner_id"
    )
    .eq("id", id)
    .maybeSingle<FindingRow>();

  if (!finding) {
    notFound();
  }

  const { data: people } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", [finding.reporter_id, finding.owner_id])
    .returns<ProfileRow[]>();

  const reporter = people?.find((p) => p.id === finding.reporter_id);
  const owner = people?.find((p) => p.id === finding.owner_id);

  const { data: closures } = await supabase
    .from("closures")
    .select(
      "id, closed_by, photo_path, description, same_day_flag, ai_note, ai_label, verifier_id, decision, rejection_reason, reviewed_at, created_at"
    )
    .eq("finding_id", finding.id)
    .order("created_at", { ascending: false })
    .returns<ClosureRow[]>();

  const closuresConFoto = await Promise.all(
    (closures ?? []).map(async (c) => ({
      ...c,
      photoUrl: await urlFirmadaEvidencia(supabase, c.photo_path),
    }))
  );

  const esOwner = user.id === finding.owner_id;
  const puedeCerrar = esOwner && (finding.status === "open" || finding.status === "rejected");

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">
          {etiquetaEscenario(finding.scenario_label)}
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            STATUS_BADGE[finding.status] ?? "bg-zinc-100 text-zinc-700"
          }`}
        >
          {STATUS_LABELS[finding.status] ?? finding.status}
        </span>
      </div>

      <dl className="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-5 text-sm">
        <div>
          <dt className="font-medium text-zinc-500">Descripción del hallazgo</dt>
          <dd className="mt-1 whitespace-pre-wrap text-zinc-900">{finding.description}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">Acción correctiva requerida</dt>
          <dd className="mt-1 whitespace-pre-wrap text-zinc-900">{finding.corrective_action}</dd>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="font-medium text-zinc-500">Owner</dt>
            <dd className="mt-1 text-zinc-900">{nombrePerfil(owner)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">Fecha límite</dt>
            <dd className="mt-1 text-zinc-900">{finding.deadline}</dd>
          </div>
        </div>
      </dl>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500">
        <p>Registrado por {nombrePerfil(reporter)}</p>
        <p className="mt-1">{new Date(finding.created_at).toLocaleString("es-MX")}</p>
      </div>

      {puedeCerrar && <ClosureForm findingId={finding.id} action={enviarCierre} />}

      {closuresConFoto.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-900">Historial de cierres</h2>
          <ul className="mt-3 space-y-4">
            {closuresConFoto.map((c) => (
              <li key={c.id} className="rounded-xl border border-zinc-200 bg-white p-5 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-zinc-900">
                    Cierre de {nombrePerfil(people?.find((p) => p.id === c.closed_by))}
                  </p>
                  {c.same_day_flag && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                      Cerrado el mismo día del hallazgo
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-zinc-700">{c.description}</p>

                {c.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.photoUrl}
                    alt="Evidencia de cierre"
                    className="mt-3 max-h-72 rounded-lg border border-zinc-200 object-contain"
                  />
                )}

                {c.ai_note && (
                  <div className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    <p className="font-medium">{c.ai_label ?? "Análisis asistido por IA"}</p>
                    <p className="mt-0.5">{c.ai_note}</p>
                  </div>
                )}

                {c.decision && (
                  <div
                    className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                      c.decision === "approved"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-red-800"
                    }`}
                  >
                    <p className="font-medium">
                      {c.decision === "approved" ? "Aprobado" : "Rechazado"} por{" "}
                      {nombrePerfil(people?.find((p) => p.id === c.verifier_id))}
                    </p>
                    {c.rejection_reason && <p className="mt-0.5">Motivo: {c.rejection_reason}</p>}
                  </div>
                )}

                <p className="mt-3 text-xs text-zinc-400">
                  {new Date(c.created_at).toLocaleString("es-MX")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
