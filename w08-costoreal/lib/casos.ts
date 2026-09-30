// Etiquetas en español de los valores fijos que sql/schema.sql permite en
// `case_type` y `phase` (checks de la base). Si se agrega un valor allá,
// hay que agregarlo aquí también — la base es la fuente de verdad.

export const CASE_TYPES = ["account_takeover", "impersonation", "fake_fundraiser"] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  account_takeover: "Toma de cuenta",
  impersonation: "Suplantación de identidad",
  fake_fundraiser: "Colecta falsa",
};

export const ESCALAS = [10, 100, 1000] as const;
export type Escala = (typeof ESCALAS)[number];

export const SIMULADO_AVISO =
  "Datos simulados — casos, personal y volumen de prueba, ningún dato real de víctimas.";

export function codigoCaso(caseNumber: number): string {
  return `#${String(caseNumber).padStart(4, "0")}`;
}
