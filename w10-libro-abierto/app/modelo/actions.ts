"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { leerSupuestos } from "@/lib/leer-supuestos";
import { construirLibro } from "@/lib/libro";
import { calcularViabilidad } from "@/lib/viabilidad";

export type PublicarState = { error: string } | { version: number } | undefined;

// "Publicar libro": snapshot inmutable en published_ledger. El servidor
// calcula la viabilidad y arma el contenido (sin datos personales); la base
// vuelve a revisar que la org sea oficial y que el estado sea el que ella
// calcula, y pone la versión.
export async function publicarLibro(): Promise<PublicarState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, organizations(es_oficial)")
    .eq("id", user.id)
    .maybeSingle<{ org_id: string; organizations: { es_oficial: boolean } | null }>();
  if (!profile) redirect("/onboarding");

  // Primer filtro en el servidor; la base lo vuelve a revisar.
  if (!profile.organizations?.es_oficial) {
    return { error: "Solo la organización oficial puede publicar el libro." };
  }

  const [{ filas, error: errorSupuestos }, { data: evidencia, error: errorEvidencia }] = await Promise.all([
    leerSupuestos(),
    supabase.from("payer_evidence").select("kind").returns<{ kind: string }[]>(),
  ]);
  if (errorSupuestos || errorEvidencia) {
    console.error("publicarLibro: lectura falló", errorEvidencia);
    return { error: "No se pudo leer el modelo. Intenta de nuevo." };
  }

  const tipos = (evidencia ?? []).map((e) => e.kind);
  const viabilidad = calcularViabilidad(tipos.length > 0, filas);
  const libro = construirLibro(filas, tipos, viabilidad);
  if (!libro.independencia_verificada) {
    return { error: "La prueba de independencia falló: el resultado cambia según el patrocinador. No se publicó." };
  }

  const { data, error } = await supabase
    .from("published_ledger")
    .insert({ org_id: profile.org_id, viability: viabilidad, content: libro })
    .select("version")
    .single<{ version: number }>();
  if (error || !data) {
    console.error("publicarLibro: insert falló", error);
    if (error?.message?.includes("Solo la organización oficial")) {
      return { error: "Solo la organización oficial puede publicar el libro." };
    }
    if (error?.message?.includes("Estado de viabilidad inválido")) {
      return { error: "Los datos cambiaron mientras publicabas. Recarga la página y vuelve a intentar." };
    }
    return { error: "No se pudo publicar. Intenta de nuevo." };
  }

  revalidatePath("/modelo");
  revalidatePath("/financiamiento");
  return { version: data.version };
}
