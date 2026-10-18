// Modelo determinista de costos, ingreso y chequeo 10:1. Funciones puras:
// mismo input → mismo output, sin red, sin base de datos, sin IA, sin
// fecha ni azar. Sin imports (excepto tipos) para probarlo con `node`
// directo (npm run test:logica).
//
// Reglas (DECISIONS.md, Feature 3):
// - Una cifra derivada toma el estado de su insumo MÁS DÉBIL
//   (invented < weak < sustained).
// - Si falta un insumo, la cifra es "no calculable". Nunca se usa un valor
//   por defecto ni se inventa el que falta.
// - El `sponsor` se recibe y se ignora: quién paga no puede cambiar el
//   resultado. La prueba de independencia lo comprueba.

import type { EstadoSupuesto } from "./supuestos.ts";

export interface Supuesto {
  key: string;
  value_num: number;
  status: EstadoSupuesto;
}

export type Cifra =
  | { calculable: true; valor: number; estado: EstadoSupuesto; insumos: string[] }
  | { calculable: false; motivo: string; faltan: string[] };

export interface ResultadoModelo {
  // Líneas de costo mensual (MXN / mes).
  mantenimiento: Cifra; // horas al mes × costo por hora
  correcciones: Cifra;
  infraestructura: Cifra;
  costoMensual: Cifra; // suma de las tres líneas
  suscriptores: Cifra; // estudiantes al año × conversión
  ingresoMensual: Cifra; // estudiantes al año × conversión × precio mensual (sin /12)
  faltante: Cifra; // costo − ingreso (negativo = sobra)
  // Costo, no parte del 10:1 (DECISIONS.md, "Chequeo 10:1").
  costoPorEstudianteAnual: Cifra; // costo mensual × 12 ÷ estudiantes al año
  diezAUno: {
    pagoAnualSuscriptor: Cifra; // precio mensual × 12 (supone 12 meses de pago)
    umbral: Cifra; // 10 × pago anual: lo que cada suscriptor tendría que evitar
    razon: Cifra; // pérdida evitada ÷ pago anual
    cumple: boolean | null; // null = no calculable
  };
}

export interface OpcionesModelo {
  sponsor?: unknown;
}

const FUERZA: Record<EstadoSupuesto, number> = { invented: 0, weak: 1, sustained: 2 };

export function estadoMasDebil(estados: EstadoSupuesto[]): EstadoSupuesto {
  // Sin insumos no hay estado "fuerte" que heredar: lo más débil posible.
  if (estados.length === 0) return "invented";
  return estados.reduce((a, b) => (FUERZA[b] < FUERZA[a] ? b : a));
}

// Centavos: lo que se muestra y lo que se compara es lo mismo.
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function noCalculable(motivo: string, faltan: string[]): Cifra {
  return { calculable: false, motivo, faltan };
}

const ETIQUETA_FALTANTE: Record<string, string> = {
  estudiantes_anio: "estudiantes al año",
  horas_mantenimiento_mes: "horas de mantenimiento",
  costo_hora: "costo por hora",
  conversion_suscripcion: "conversión",
  precio_mensual: "precio mensual",
  costo_correcciones_mes: "costo de correcciones",
  costo_infraestructura_mes: "costo de infraestructura",
  perdida_evitada_suscriptor_anio: "el valor evitado",
};

function motivoFaltan(faltan: string[]): string {
  return `falta ${faltan.map((k) => ETIQUETA_FALTANTE[k] ?? k).join(", ")}`;
}

// Combina cifras: calculable solo si todas lo son; el estado es el más
// débil de todos los insumos; los insumos se acumulan sin repetir.
type NoCalculable = Extract<Cifra, { calculable: false }>;
type Calculable = Extract<Cifra, { calculable: true }>;

function combinar(partes: Cifra[], f: (valores: number[]) => number): Cifra {
  const malas = partes.filter((p): p is NoCalculable => !p.calculable);
  if (malas.length > 0) {
    return noCalculable(
      [...new Set(malas.map((p) => p.motivo))].join("; "),
      [...new Set(malas.flatMap((p) => p.faltan))]
    );
  }
  const ok = partes as Calculable[];
  return {
    calculable: true,
    valor: redondear(f(ok.map((p) => p.valor))),
    estado: estadoMasDebil(ok.map((p) => p.estado)),
    insumos: [...new Set(ok.flatMap((p) => p.insumos))].sort(),
  };
}

export function calcularModelo(supuestos: readonly Supuesto[], opciones: OpcionesModelo = {}): ResultadoModelo {
  // `opciones.sponsor` se ignora a propósito (Condición 5: quién paga no
  // cambia el resultado). Ninguna línea de abajo lo lee.
  void opciones;

  // Primer valor por clave (la base garantiza una fila por clave y org).
  // Un valor no finito cuenta como faltante, nunca como 0.
  const porClave = new Map<string, Supuesto>();
  for (const s of supuestos) {
    if (!porClave.has(s.key) && Number.isFinite(s.value_num)) porClave.set(s.key, s);
  }

  const insumo = (key: string): Cifra => {
    const s = porClave.get(key);
    if (!s) return noCalculable(motivoFaltan([key]), [key]);
    return { calculable: true, valor: s.value_num, estado: s.status, insumos: [key] };
  };

  // Un insumo que es base de población o divisor no puede ser 0: con 0
  // estudiantes no hay a quién atender ni entre quién repartir el costo, y
  // con precio 0 el 10:1 no tiene contra qué compararse.
  const positivo = (key: string, motivoCero: string): Cifra => {
    const c = insumo(key);
    if (c.calculable && c.valor <= 0) return noCalculable(motivoCero, []);
    return c;
  };

  const estudiantes = positivo("estudiantes_anio", "estudiantes al año es 0");
  const precio = positivo("precio_mensual", "el precio mensual es 0");
  const conversion = insumo("conversion_suscripcion");

  const mantenimiento = combinar([insumo("horas_mantenimiento_mes"), insumo("costo_hora")], ([h, c]) => h * c);
  const correcciones = combinar([insumo("costo_correcciones_mes")], ([v]) => v);
  const infraestructura = combinar([insumo("costo_infraestructura_mes")], ([v]) => v);
  const costoMensual = combinar([mantenimiento, correcciones, infraestructura], (v) => v.reduce((a, b) => a + b, 0));

  // Conversión en porcentaje (3 = 3%). El orden de las operaciones evita
  // 2000 × 0.03 = 60.000000000000004.
  const suscriptores = combinar([estudiantes, conversion], ([e, c]) => (e * c) / 100);
  const ingresoMensual = combinar([estudiantes, conversion, precio], ([e, c, p]) => (e * c * p) / 100);
  const faltante = combinar([costoMensual, ingresoMensual], ([c, i]) => c - i);
  const costoPorEstudianteAnual = combinar([costoMensual, estudiantes], ([c, e]) => (c * 12) / e);

  const pagoAnualSuscriptor = combinar([precio], ([p]) => p * 12);
  const umbral = combinar([pagoAnualSuscriptor], ([p]) => p * 10);
  const perdida = insumo("perdida_evitada_suscriptor_anio");
  const razon = combinar([perdida, pagoAnualSuscriptor], ([v, p]) => v / p);
  // `cumple` se decide con los insumos sin redondear: la razón redondeada a
  // centavos convertía 9.998 en 10.00 y daba el 10:1 por cumplido (lo
  // encontró test:logica con 5,879 vs. umbral 5,880).
  // En enteros (la base guarda 4 decimales): en punto flotante
  // 10 × (40.06 × 12) = 4807.200000000001 y 4,807.2 no "cumpliría".
  const cumple =
    perdida.calculable && precio.calculable
      ? Math.round(perdida.valor * 1e4) >= Math.round(precio.valor * 1e4) * 120
      : null;

  return {
    mantenimiento,
    correcciones,
    infraestructura,
    costoMensual,
    suscriptores,
    ingresoMensual,
    faltante,
    costoPorEstudianteAnual,
    diezAUno: {
      pagoAnualSuscriptor,
      umbral,
      razon,
      cumple,
    },
  };
}

// Igualdad profunda para la prueba de independencia (también la usa la
// página para mostrar el resultado real, no un texto fijo).
export function igualesProfundo(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object).sort();
  const kb = Object.keys(b as object).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => igualesProfundo((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export const SPONSORS_DE_PRUEBA = [null, "Patrocinador simulado A", "Patrocinador simulado B"] as const;

export function pruebaIndependencia(supuestos: readonly Supuesto[]): boolean {
  const [base, ...otros] = SPONSORS_DE_PRUEBA.map((sponsor) => calcularModelo(supuestos, { sponsor }));
  return otros.every((r) => igualesProfundo(base, r));
}
