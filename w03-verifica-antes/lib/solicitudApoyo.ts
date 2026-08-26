import type { DatosOferta, ResultadoVerificacion } from "@/lib/verificacion";

export interface SolicitudApoyo {
  oferta: DatosOferta;
  resultado: ResultadoVerificacion;
  timestamp: string;
}

const LOCAL_STORAGE_KEY = "verificaciones_solicitudes";

export function guardarSolicitudApoyo(oferta: DatosOferta, resultado: ResultadoVerificacion): SolicitudApoyo {
  const solicitud: SolicitudApoyo = {
    oferta,
    resultado,
    timestamp: new Date().toISOString(),
  };

  const existentes = leerSolicitudes();
  const actualizadas = [...existentes, solicitud];
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(actualizadas));

  return solicitud;
}

export function leerSolicitudes(): SolicitudApoyo[] {
  if (typeof window === "undefined") return [];
  const crudo = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!crudo) return [];
  try {
    return JSON.parse(crudo) as SolicitudApoyo[];
  } catch {
    return [];
  }
}
