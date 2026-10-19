// La lista de "Qué datos guardamos" de /financiamiento. test:schema la
// compara contra las tablas y columnas REALES de sql/schema.sql: si alguien
// agrega una columna sin declararla aquí, la prueba falla.

export interface TablaGuardada {
  tabla: string;
  queEs: string;
  columnas: string[];
}

export const DATOS_GUARDADOS: TablaGuardada[] = [
  {
    tabla: "organizations",
    queEs: "El equipo que edita el modelo: nombre, código para unirse y si es la organización oficial.",
    columnas: ["id", "name", "join_code", "created_at", "es_oficial"],
  },
  {
    tabla: "profiles",
    queEs: "Las personas del equipo que inician sesión con Google: correo y nombre. Nunca estudiantes.",
    columnas: ["id", "org_id", "email", "display_name", "created_at"],
  },
  {
    tabla: "assumptions",
    queEs: "Los supuestos del modelo: valor, unidad, estado, fuente y una nota.",
    columnas: ["id", "org_id", "key", "value_num", "unit", "status", "source_url", "source_date", "note", "created_at", "updated_at"],
  },
  {
    tabla: "payer_evidence",
    queEs: "Evidencia de un posible pagador: tipo, descripción, referencia del documento, quién la registró, fecha y si es simulada.",
    columnas: ["id", "org_id", "kind", "description", "document_ref", "recorded_by", "recorded_on", "created_at", "simulada"],
  },
  {
    tabla: "auditor_llamadas",
    queEs: "Cuándo pidió observaciones al auditor de IA cada persona del equipo, solo para limitar la frecuencia. Se borra después de un día.",
    columnas: ["id", "user_id", "org_id", "created_at"],
  },
  {
    tabla: "published_ledger",
    queEs: "Las versiones publicadas de este libro. Todas son públicas y no llevan datos personales.",
    columnas: ["id", "org_id", "version", "content", "published_at", "viability", "oficial"],
  },
];
