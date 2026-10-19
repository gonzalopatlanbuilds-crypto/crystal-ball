// Textos fijos de los avisos. Viven en código, nunca los genera la IA, y
// se muestran en todas las pantallas (operador y público).
export const AVISO_OPERADOR = "Datos simulados. Todo supuesto lleva estado y fuente.";

export const AVISO_PUBLICO =
  "Datos simulados: las cifras, los patrocinadores y los costos de esta pantalla son inventados.";

// Resultado de la comparación IA vs. revisión por reglas
// (scripts/comparar-auditor.ts, DECISIONS.md "Feature 5"): con 7 errores
// sembrados, la IA encontró 4 que las reglas no detectan y no detectó un
// valor implausible de conversión. Por eso no se marca "opcional" pero sí
// "sin validar", y se dice lo que se le escapó.
export const NOTA_UTILIDAD_IA =
  "Complementa la revisión por reglas: en una prueba con errores sembrados encontró fuentes de otro tema, fuentes muy viejas y valores fuera de rango que las reglas no ven, pero se le escapó una conversión implausible. Puede equivocarse: revisa cada una.";
