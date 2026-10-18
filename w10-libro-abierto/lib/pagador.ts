// Evidencia de pagador: tipos y validación server-side. Sin imports de
// runtime para probarlo con `node` directo. Los tipos y límites son los
// mismos que los `check` de sql/schema.sql (Feature 4).

import { leerFecha } from "./supuestos.ts";

// Lista cerrada. Ningún tipo es comisión, afiliado ni referido.
export const TIPOS_EVIDENCIA = {
  carta_intencion: "Carta de intención",
  convenio_firmado: "Convenio firmado",
  pago_recibido: "Pago recibido",
  presupuesto_aprobado: "Presupuesto aprobado",
  otro: "Otro",
} as const;

export type TipoEvidencia = keyof typeof TIPOS_EVIDENCIA;

export function esTipo(v: string): v is TipoEvidencia {
  return Object.prototype.hasOwnProperty.call(TIPOS_EVIDENCIA, v);
}

export const DESCRIPCION_MAX = 1000;
export const REFERENCIA_MAX = 300;

export type CampoEvidencia = "kind" | "description" | "document_ref" | "recorded_on";
export type ValoresEvidencia = Record<CampoEvidencia, string>;
export type ErroresEvidencia = Partial<Record<CampoEvidencia, string>>;

export interface EvidenciaValida {
  kind: TipoEvidencia;
  description: string;
  document_ref: string;
  recorded_on: string;
}

// "Quién la registró" no es un campo: lo pone la base con la sesión
// (recorded_by default auth.uid()); el cliente no puede escribirlo.
export function validarEvidencia(
  valores: ValoresEvidencia,
  hoy: Date = new Date()
): { ok: true; datos: EvidenciaValida } | { ok: false; errores: ErroresEvidencia } {
  const errores: ErroresEvidencia = {};

  const kind = valores.kind.trim();
  if (!esTipo(kind)) errores.kind = "Elige un tipo de evidencia.";

  const description = valores.description.trim();
  const largoD = [...description].length;
  if (largoD === 0) errores.description = "Describe la evidencia: quién paga, cuánto y por cuánto tiempo.";
  else if (largoD > DESCRIPCION_MAX) errores.description = `Máximo ${DESCRIPCION_MAX} caracteres (llevas ${largoD}).`;

  const documentRef = valores.document_ref.trim();
  const largoR = [...documentRef].length;
  if (largoR === 0) errores.document_ref = "Escribe la referencia del documento (folio, nombre del archivo o enlace).";
  else if (largoR > REFERENCIA_MAX) errores.document_ref = `Máximo ${REFERENCIA_MAX} caracteres (llevas ${largoR}).`;

  const f = leerFecha(valores.recorded_on, hoy);
  if ("error" in f) errores.recorded_on = f.error;
  else if (f.valor === null) errores.recorded_on = "Escribe la fecha del documento.";

  if (Object.keys(errores).length > 0 || !esTipo(kind) || !("valor" in f) || f.valor === null) {
    return { ok: false, errores };
  }
  return { ok: true, datos: { kind, description, document_ref: documentRef, recorded_on: f.valor } };
}
