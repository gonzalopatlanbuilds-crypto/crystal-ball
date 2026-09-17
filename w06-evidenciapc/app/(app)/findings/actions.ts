"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseFindingForm } from "@/lib/findings";

export type FindingFormState = { error: string } | undefined;

export async function crearHallazgo(
  _prevState: FindingFormState,
  formData: FormData
): Promise<FindingFormState> {
  const parsed = parseFindingForm(formData);
  if (!parsed.success) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle<{ org_id: string }>();
  if (!profile) {
    redirect("/onboarding");
  }

  const { data, error } = await supabase
    .from("findings")
    .insert({
      org_id: profile.org_id,
      reporter_id: user.id,
      owner_id: parsed.data.ownerId,
      scenario_label: parsed.data.scenarioLabel,
      description: parsed.data.description,
      corrective_action: parsed.data.correctiveAction,
      deadline: parsed.data.deadline,
    })
    .select("id")
    .single();

  if (error) {
    console.error("crearHallazgo: insert en findings falló", error);
    return { error: "No se pudo guardar el hallazgo. Confirma que el owner sea de tu organización." };
  }

  redirect(`/findings/${data.id}`);
}
