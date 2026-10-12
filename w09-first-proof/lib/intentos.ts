// Número de intento: solo lo ve el candidato, nunca quien revisa (las
// funciones blind_* de sql/schema.sql no lo devuelven). Sin imports para
// probarlo con `node` directo.

// El intento 1 no lleva etiqueta: es el caso normal y no hay nada que
// avisar.
export function etiquetaIntento(intento: number): string | null {
  return intento > 1 ? `Intento ${intento}: reenvío` : null;
}

// La evidencia es el intento 1: la única entrega hecha antes de ver los
// valores correctos del chequeo automático. Un reenvío posterior nunca la
// reemplaza. Si el intento 1 se borró, no hay evidencia (null) en vez de
// promover el intento 2: si no, borrar el primero sería la forma de
// "mejorar" el expediente después de ver las respuestas.
export function elegirEvidencia<T extends { attempt_number: number }>(entregas: T[]): T | null {
  return entregas.find((e) => e.attempt_number === 1) ?? null;
}
