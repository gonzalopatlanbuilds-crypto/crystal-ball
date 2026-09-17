import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { etiquetaEscenario, STATUS_LABELS } from "@/lib/findings";

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
    </main>
  );
}
