// Aritmética de costo, sin imports a propósito: así se puede probar con
// `node` directo (sin Next ni alias `@/`) contra cálculos hechos a mano.
//
// Regla de redondeo, elegida para que el total se pueda verificar a mano
// con lo que se ve en pantalla: cada entrada se redondea a centavos
// PRIMERO (que es el costo que la UI muestra por entrada), y el costo del
// caso es la suma exacta de esos centavos. Redondear solo al final podría
// dar un total que difiere por 1 centavo de sumar las entradas visibles.
//
// La tarifa capturada ES la tarifa cargada final (sueldo + prestaciones):
// no hay ningún multiplicador oculto encima (decisión aprobada, ver
// DECISIONS.md — el mockup 1 mostraba $253 con números que suman $211.67).

export function aCentavos(pesos: number | string): number {
  return Math.round(Number(pesos) * 100);
}

export function costoEntradaCentavos(minutos: number, tarifaHoraMxn: number | string): number {
  return Math.round((minutos * aCentavos(tarifaHoraMxn)) / 60);
}

export interface EntradaCosto {
  minutes: number;
  hourly_rate_mxn: number | string;
}

export function costoCasoCentavos(entradas: EntradaCosto[]): number {
  return entradas.reduce((suma, e) => suma + costoEntradaCentavos(e.minutes, e.hourly_rate_mxn), 0);
}

export function minutosTotales(entradas: EntradaCosto[]): number {
  return entradas.reduce((suma, e) => suma + e.minutes, 0);
}

export function formatoMxn(centavos: number): string {
  return `$${(centavos / 100).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MXN`;
}
