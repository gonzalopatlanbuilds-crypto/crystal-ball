"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cargarModelo, leerParametros } from "@/lib/modelo";
import { armarDescarga, redactarResumen } from "@/lib/resumen";

export type ResumenState =
  | { estado: "ok"; texto: string; casosMes: number; generado: string; descarga: string }
  | { estado: "rechazado"; problemas: string[] }
  | { estado: "error"; mensaje: string }
  | undefined;

// Del formulario solo llegan escala y tarifa hipotética, y se validan con
// las mismas reglas que la URL de la pantalla. Los números que ve la IA se
// recalculan aquí con la sesión de quien pide (RLS de su org): nunca se
// confía en cifras enviadas por el navegador.
export async function generarResumen(
  _prevState: ResumenState,
  formData: FormData
): Promise<ResumenState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { escala, tarifaPatrocinioMxn, avisos } = leerParametros(
    formData.get("escala"),
    formData.get("tarifa")
  );
  if (avisos.length > 0) {
    return { estado: "error", mensaje: avisos.join(" ") };
  }

  const resultado = await cargarModelo(supabase, escala, tarifaPatrocinioMxn);
  if (resultado.estado === "sin-datos") {
    return { estado: "error", mensaje: "No hay casos con tiempo registrado para resumir." };
  }
  if (resultado.estado === "error") {
    return { estado: "error", mensaje: "No se pudieron cargar los datos del modelo." };
  }

  const r = await redactarResumen(resultado.modelo);
  if (r.estado !== "ok") return r;

  const generado = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
  return {
    estado: "ok",
    texto: r.texto,
    casosMes: resultado.modelo.casosMes,
    generado,
    descarga: armarDescarga(r.texto, resultado.modelo, generado),
  };
}
