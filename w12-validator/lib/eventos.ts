// Registro de eventos (semana 13, stack floor). Hoy hay un solo tipo:
// alguien subió una carga y la app le mostró "tienes N hallazgos
// pendientes de cargas anteriores".
export const TIPOS_EVENTO = ["upload_seen_pending"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export interface EventoParams {
  p_tipo: TipoEvento;
  p_evidence_version_id: string;
  p_pendientes: number;
}

// Parámetros de registrar_evento() para una carga, o null si el mensaje de
// pendientes no se muestra (0 pendientes → no se registra nada). El mensaje
// sale en las dos ramas del resultado (idéntica a la anterior o no) siempre
// que haya pendientes, así que la regla es solo el número.
export function eventoDeCarga(versionId: string, pendientes: number): EventoParams | null {
  if (!Number.isInteger(pendientes) || pendientes <= 0) return null;
  return { p_tipo: "upload_seen_pending", p_evidence_version_id: versionId, p_pendientes: pendientes };
}
