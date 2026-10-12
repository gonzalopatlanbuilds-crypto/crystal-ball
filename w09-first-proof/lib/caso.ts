// El caso ficticio vive aquí, en código, no en la base: es la única fuente
// de verdad de los datos y de las respuestas correctas. Sin imports a
// propósito (igual que lib/costos.ts de w08): se prueba con `node` directo.
//
// Las respuestas correctas se CALCULAN de los datos, no se escriben a mano,
// para que un error de captura en la tabla no pueda dejar una "respuesta
// correcta" que no corresponde a lo que ve el candidato.

export const EMPRESA = "Distribuidora Aurora";

export const DATOS = {
  ingresos: { t1: 4_200_000, t2: 4_620_000 },
  costoVentas: { t1: 2_856_000, t2: 3_234_000 },
  cuentasPorCobrar: { t1: 1_050_000, t2: 1_540_000 },
} as const;

export const FILAS_CASO: { concepto: string; t1: number; t2: number }[] = [
  { concepto: "Ingresos", ...DATOS.ingresos },
  { concepto: "Costo de ventas", ...DATOS.costoVentas },
  { concepto: "Cuentas por cobrar (final)", ...DATOS.cuentasPorCobrar },
];

export const TOLERANCIA = 0.05;

export type ClaveCalculo = "growth" | "margin" | "dso";

export interface Calculo {
  clave: ClaveCalculo;
  etiqueta: string;
  correcto: number;
}

function redondear1(n: number): number {
  return Math.round(n * 10) / 10;
}

const { ingresos, costoVentas, cuentasPorCobrar } = DATOS;

export const CALCULOS: Calculo[] = [
  {
    clave: "growth",
    etiqueta: "Crecimiento de ingresos T2 vs T1 (%)",
    correcto: redondear1(((ingresos.t2 - ingresos.t1) / ingresos.t1) * 100),
  },
  {
    clave: "margin",
    etiqueta: "Margen bruto T2 (%)",
    correcto: redondear1(((ingresos.t2 - costoVentas.t2) / ingresos.t2) * 100),
  },
  {
    clave: "dso",
    etiqueta: "Días de cobranza T2 (cuentas por cobrar / ingresos × 90)",
    correcto: redondear1((cuentasPorCobrar.t2 / ingresos.t2) * 90),
  },
];

export const PREGUNTA_EXPLICACION =
  "Explica en 3 a 5 oraciones qué cambió y qué revisarías primero, en tus palabras.";

// C1 lo juzga el sistema; C2 y C3, la persona que revisa (Feature 4).
export const CRITERIOS = [
  { id: "C1", texto: "Calcula indicadores básicos", juzga: "sistema" },
  { id: "C2", texto: "Explica qué cambió con sus propias palabras", juzga: "humano" },
  { id: "C3", texto: "Propone qué revisar primero", juzga: "humano" },
] as const;

export type EstadoChequeo = "correcto" | "no_coincide" | "sin_respuesta";

export interface ResultadoChequeo extends Calculo {
  respuesta: number | null;
  estado: EstadoChequeo;
}

// Supabase puede devolver `numeric` como string; se normaliza aquí.
function aNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Un resultado por cálculo, nunca un total ni un puntaje: el chequeo dice
// "coincide o no" con el valor correcto, no califica a la persona.
export function chequear(respuestas: Record<ClaveCalculo, unknown>): ResultadoChequeo[] {
  return CALCULOS.map((c) => {
    const respuesta = aNumero(respuestas[c.clave]);
    const estado: EstadoChequeo =
      respuesta === null
        ? "sin_respuesta"
        : // + 1e-9: 30.05 - 30 da 0.0500000000000007 en punto flotante.
          Math.abs(respuesta - c.correcto) <= TOLERANCIA + 1e-9
          ? "correcto"
          : "no_coincide";
    return { ...c, respuesta, estado };
  });
}

export function formatoMiles(n: number): string {
  return n.toLocaleString("es-MX");
}

export function formatoDecimal(n: number): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
