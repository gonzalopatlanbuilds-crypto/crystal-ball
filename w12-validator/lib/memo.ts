// Memo 10:1 de /about (semana 14). Lógica pura; test:logica la cubre.
//
// La estimación de costo es de quien funda, no una medición: la página la
// etiqueta así. Si no hay estimación (null), la página lo dice y no
// calcula ningún ahorro ni ninguna razón.

export const HOY =
  "Concilia a mano, en hojas de cálculo, los datos de empaque que mandan sus proveedores (4+). No usa ninguna plataforma.";

export type EstimacionFundador = {
  // Horas al mes que se van en conciliar a mano.
  horasMes: number;
  // Lo que cuesta una hora de esa persona, en MXN.
  costoHoraMxn: number;
  // Riesgo de multa prorrateado al mes, en MXN (monto × probabilidad / 12).
  riesgoMultaMesMxn: number;
  // De dónde sale cada número, en palabras de quien funda.
  base: string;
};

// Semana 14: se publica sin estimación (decisión de Gonzalo, 2026-11-11;
// ver DECISIONS.md). null = la página no calcula ningún ahorro.
export const ESTIMACION_FUNDADOR: EstimacionFundador | null = null;

// Regla del memo: mi precio no debe pasar del 20% del ahorro estimado.
export const TOPE_PRECIO_SOBRE_AHORRO = 0.2;
export const REGLA_20 = "Mi precio no debe pasar del 20% del ahorro estimado. Si no, tengo un problema de valor.";

export function costoTiempoMes(e: EstimacionFundador): number {
  return e.horasMes * e.costoHoraMxn;
}

export function ahorroMensual(e: EstimacionFundador): number {
  return costoTiempoMes(e) + e.riesgoMultaMesMxn;
}

export function precioMaximo(ahorro: number): number {
  return ahorro * TOPE_PRECIO_SOBRE_AHORRO;
}

// true si el precio respeta la regla del 20%. Con ahorro 0 o negativo,
// ningún precio la respeta.
export function cumpleRegla20(precio: number, ahorro: number): boolean {
  return ahorro > 0 && precio <= precioMaximo(ahorro);
}

// Cuántas veces el ahorro cubre el precio (10 = 10:1), con un decimal.
export function razonValorPrecio(ahorro: number, precio: number): number {
  if (precio <= 0) return 0;
  return Math.round((ahorro / precio) * 10) / 10;
}

export function validarEstimacion(e: EstimacionFundador): string | null {
  for (const [nombre, v] of [["horasMes", e.horasMes], ["costoHoraMxn", e.costoHoraMxn], ["riesgoMultaMesMxn", e.riesgoMultaMesMxn]] as const) {
    if (!Number.isFinite(v) || v < 0) return `${nombre} debe ser un número >= 0`;
  }
  if (e.base.trim() === "") return "base no puede estar vacía";
  return null;
}
