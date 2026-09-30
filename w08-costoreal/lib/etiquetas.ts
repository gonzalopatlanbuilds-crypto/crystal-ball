// Etiquetas de confirmación de cada escenario. Una sola fuente: la
// pantalla de escenarios (Feature 3) y el resumen de IA (Feature 4) usan
// exactamente estas cadenas, para que la IA no pueda "suavizar" una
// etiqueta que la pantalla sí muestra.
//
// Criterio: "Confirmado" solo si el número descansa únicamente en tiempo
// de personal registrado. Cualquier ingreso que dependa de que alguien
// acepte pagar es "No confirmado" — nadie ha aceptado nada (Condición 5
// del Blueprint: no asumir alianzas).

export const ETIQUETA_VICTIMA_PAGA =
  "No confirmado: sin fuente de ingreso, cierre en el primer mes";
export const ETIQUETA_PATROCINIO =
  "No confirmado: ningún patrocinador ha aceptado este modelo todavía";
export const ETIQUETA_SIN_PATROCINIO =
  "Confirmado: cálculo directo de tiempo de personal registrado";

export const AVISO_NINGUN_PATROCINADOR =
  "Ningún patrocinador ha sido contactado ni ha confirmado este modelo. Datos de volumen simulados.";
