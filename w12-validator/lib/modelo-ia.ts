// Datos del lector de IA que también muestra el navegador. Viven aparte de
// lib/lector-ia.ts para que la caja de la página no importe el SDK de
// Anthropic (ese módulo solo corre en el servidor).

export const MODELO_LECTOR = "claude-opus-5-5";

// Resultado de la comparación IA vs. regla que se muestra en la caja. Se
// actualiza a mano con lo que mide scripts/comparar-lector.ts sobre los
// casos plantados de w12; test:logica revisa que coincida con el archivo de
// salidas reales.
// Corrida real del 2026-11-01: docs/pruebas/lector-ia-2026-11-01-w12.json
// (10 casos plantados de w12, 3 rondas, 30 llamadas).
export const RESULTADO_COMPARACION =
  "En la prueba de esta semana (w12, 10 casos con causas sembradas, 3 rondas) nombró la causa en 10 de 10 casos; una regla simple marcó 3. Pero suele listar varias posibilidades y a veces deja la que importa al final: úsala como pista, no como filtro.";
