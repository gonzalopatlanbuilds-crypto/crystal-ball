"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validarSupuesto, type ErroresSupuesto, type ValoresSupuesto } from "@/lib/supuestos";

export type SupuestoState =
  | { errores: ErroresSupuesto; valores: ValoresSupuesto; mensaje?: string }
  | undefined;

export type AccionSimpleState = { error: string } | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sesionConOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle<{ org_id: string }>();
  if (!profile) redirect("/onboarding");
  return { supabase, orgId: profile.org_id };
}

// Crear (sin id) o editar (con id). Si algo falla, los valores regresan
// tal cual al formulario: quien edita no pierde lo que escribió.
export async function guardarSupuesto(_prev: SupuestoState, formData: FormData): Promise<SupuestoState> {
  const leer = (k: string) => String(formData.get(k) ?? "");
  const id = leer("id");
  const valores: ValoresSupuesto = {
    key: leer("key"),
    value_num: leer("value_num"),
    status: leer("status"),
    source_url: leer("source_url"),
    source_date: leer("source_date"),
    note: leer("note"),
  };

  const { supabase, orgId } = await sesionConOrg();

  // Al editar, la clave sale de la base, no del formulario: el rango que
  // se valida es el del supuesto real aunque alguien altere el campo oculto.
  if (id) {
    if (!UUID.test(id)) return { errores: {}, valores, mensaje: "Supuesto no encontrado." };
    const { data: actual } = await supabase.from("assumptions").select("key").eq("id", id).maybeSingle<{ key: string }>();
    if (!actual) return { errores: {}, valores, mensaje: "Supuesto no encontrado." };
    valores.key = actual.key;
  }

  const resultado = validarSupuesto(valores);
  if (!resultado.ok) return { errores: resultado.errores, valores };
  const d = resultado.datos;

  if (id) {
    const { data, error } = await supabase
      .from("assumptions")
      .update({
        value_num: d.value_num,
        unit: d.unit,
        status: d.status,
        source_url: d.source_url,
        source_date: d.source_date,
        note: d.note,
      })
      .eq("id", id)
      .select("id");
    if (error || !data?.length) {
      console.error("guardarSupuesto: update falló", error);
      return { errores: {}, valores, mensaje: "No se pudo guardar. Intenta de nuevo." };
    }
  } else {
    const { error } = await supabase.from("assumptions").insert({ org_id: orgId, ...d });
    if (error) {
      if (error.code === "23505") {
        return { errores: { key: "Ese supuesto ya existe: edítalo desde la lista." }, valores };
      }
      console.error("guardarSupuesto: insert falló", error);
      return { errores: {}, valores, mensaje: "No se pudo guardar. Intenta de nuevo." };
    }
  }

  revalidatePath("/modelo", "layout");
  redirect("/modelo/supuestos");
}

export async function eliminarSupuesto(_prev: AccionSimpleState, formData: FormData): Promise<AccionSimpleState> {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { error: "Supuesto no encontrado." };
  const { supabase } = await sesionConOrg();
  const { data, error } = await supabase.from("assumptions").delete().eq("id", id).select("id");
  if (error || !data?.length) {
    console.error("eliminarSupuesto: delete falló", error);
    return { error: "No se pudo eliminar. Intenta de nuevo." };
  }
  revalidatePath("/modelo", "layout");
  redirect("/modelo/supuestos");
}

export async function sembrarEjemplo(): Promise<AccionSimpleState> {
  const { supabase } = await sesionConOrg();
  const { error } = await supabase.rpc("sembrar_supuestos_ejemplo");
  if (error) {
    console.error("sembrarEjemplo: rpc falló", error);
    return { error: "No se pudieron cargar los valores de ejemplo. Intenta de nuevo." };
  }
  revalidatePath("/modelo", "layout");
  return undefined;
}
