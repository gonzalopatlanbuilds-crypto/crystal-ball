"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decisionSchema } from "@/lib/decisiones";

export type DecisionState = undefined | { error: string } | { ok: true; guardadaEn: string };

// La nota se valida aquí (servidor) y otra vez en la base
// (registrar_decision y el check de la tabla). Nada en el cliente basta.
export async function guardarDecision(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const parsed = decisionSchema.safeParse({
    findingId: formData.get("finding_id"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? undefined,
  });
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

  const { error } = await supabase.rpc("registrar_decision", {
    p_finding_id: parsed.data.findingId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note,
  });
  if (error) {
    console.error("guardarDecision: registrar_decision falló", error);
    // Los mensajes de la base (P0001) están escritos para mostrarse.
    const mensaje = error.code === "P0001" ? error.message : "No se pudo guardar la decisión. Intenta de nuevo.";
    return { error: mensaje };
  }

  revalidatePath("/validador/hallazgos");
  revalidatePath(`/validador/hallazgos/${parsed.data.findingId}`);
  revalidatePath("/validador");
  return { ok: true, guardadaEn: new Date().toISOString() };
}
