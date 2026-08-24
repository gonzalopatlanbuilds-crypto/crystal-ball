import { getSupabaseClient } from "./supabaseClient";
import type { AvisoSimulado } from "./fixtures";

export type SolicitudRevision = {
  aviso_simulado: AvisoSimulado;
  datos_objetados: string[];
  mensaje_generado: string;
};

const LOCAL_STORAGE_KEY = "solicitudes_revision";

/**
 * Flag temporal: el proyecto Supabase "semestre" está caído (password
 * authentication failed del lado del servidor, ya reportado a soporte).
 * Mientras tanto guardamos en localStorage con la misma estructura de datos.
 * En cuanto Supabase esté sano, sube NEXT_PUBLIC_USAR_SUPABASE=true en Vercel
 * y vuelve a desplegar — no hace falta tocar código.
 */
const USAR_SUPABASE = process.env.NEXT_PUBLIC_USAR_SUPABASE === "true";

export async function guardarSolicitud(
  solicitud: SolicitudRevision
): Promise<void> {
  if (USAR_SUPABASE) {
    const { error } = await getSupabaseClient()
      .from("solicitudes_revision")
      .insert(solicitud);

    if (error) throw error;
    return;
  }

  guardarSolicitudLocal(solicitud);
}

function guardarSolicitudLocal(solicitud: SolicitudRevision): void {
  const existentes = leerSolicitudesLocales();
  existentes.push({ ...solicitud, guardado_en: new Date().toISOString() });
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existentes));
}

function leerSolicitudesLocales(): Array<
  SolicitudRevision & { guardado_en: string }
> {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
