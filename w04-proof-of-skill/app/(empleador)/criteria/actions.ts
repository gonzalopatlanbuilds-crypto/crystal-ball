"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCriteriaSetForm } from "@/lib/criteria";

export type CriteriaFormState = { error: string } | undefined;

export async function createCriteriaSet(
  _prevState: CriteriaFormState,
  formData: FormData
): Promise<CriteriaFormState> {
  const parsed = parseCriteriaSetForm(formData);
  if (!parsed.success) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const { error } = await supabase.from("criteria_sets").insert({
    employer_id: user.id,
    role_name: parsed.data.roleName,
    criteria: parsed.data.criteria,
  });

  if (error) return { error: "No se pudo guardar el set de criterios. Intenta de nuevo." };

  redirect("/dashboard");
}

export async function updateCriteriaSet(
  id: string,
  _prevState: CriteriaFormState,
  formData: FormData
): Promise<CriteriaFormState> {
  const parsed = parseCriteriaSetForm(formData);
  if (!parsed.success) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const { error } = await supabase
    .from("criteria_sets")
    .update({
      role_name: parsed.data.roleName,
      criteria: parsed.data.criteria,
    })
    .eq("id", id)
    .eq("employer_id", user.id);

  if (error) return { error: "No se pudo guardar el set de criterios. Intenta de nuevo." };

  redirect("/dashboard");
}
