"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EliminarState = { error: string } | undefined;

// "Solicitar eliminación de mi expediente": borra todas las entregas del
// candidato (sus revisiones caen por cascada) y reinicia su contador de
// intentos. Ver borrar_mis_entregas() en sql/schema.sql.
export async function eliminarExpediente(_prev: EliminarState, formData: FormData): Promise<EliminarState> {
  if (formData.get("confirmo") !== "si") {
    return { error: "Confirma que quieres borrar todo." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("borrar_mis_entregas");
  if (error) {
    console.error("eliminarExpediente: borrar_mis_entregas falló", error);
    return { error: "No se pudo borrar. Intenta de nuevo." };
  }
  redirect("/dashboard?borrado=1");
}
