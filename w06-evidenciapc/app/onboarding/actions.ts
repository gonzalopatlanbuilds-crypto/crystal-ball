"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { crearOrgSchema, unirseOrgSchema } from "@/lib/orgs";

export type CrearOrgState =
  | { error: string }
  | { joinCode: string; orgName: string }
  | undefined;

export type UnirseOrgState = { error: string } | undefined;

interface CreateOrgRpcRow {
  org_id: string;
  join_code: string;
}

export async function crearOrganizacion(
  _prevState: CrearOrgState,
  formData: FormData
): Promise<CrearOrgState> {
  const parsed = crearOrgSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .rpc("create_org", { p_name: parsed.data.name })
    .returns<CreateOrgRpcRow[]>();

  if (error || !data?.[0]) {
    console.error("crearOrganizacion: create_org falló", error);
    return { error: "No se pudo crear la organización. Intenta de nuevo." };
  }

  return { joinCode: data[0].join_code, orgName: parsed.data.name };
}

export async function unirseOrganizacion(
  _prevState: UnirseOrgState,
  formData: FormData
): Promise<UnirseOrgState> {
  const parsed = unirseOrgSchema.safeParse({ joinCode: formData.get("join_code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Código inválido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("join_org", { p_join_code: parsed.data.joinCode });
  if (error) {
    console.error("unirseOrganizacion: join_org falló", error);
    return { error: "Código no encontrado. Verifica que esté bien escrito." };
  }

  redirect("/dashboard");
}
