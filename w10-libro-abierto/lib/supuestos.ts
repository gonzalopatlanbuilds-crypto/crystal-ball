// Catálogo de supuestos y validación server-side del formulario. Sin
// imports para probarlo con `node` directo (npm run test:logica). Las
// claves y unidades son las mismas que el `check` de sql/schema.sql: la
// base es la última línea de defensa.

export type EstadoSupuesto = "sustained" | "weak" | "invented";

export const ESTADOS: EstadoSupuesto[] = ["sustained", "weak", "invented"];

export const ETIQUETA_ESTADO: Record<EstadoSupuesto, string> = {
  sustained: "sustentado",
  weak: "débil",
  invented: "inventado",
};

export interface DefinicionSupuesto {
  etiqueta: string;
  unidad: string;
  min: number;
  max: number;
  entero: boolean;
  // Cómo se muestra el valor: "%" va pegado al número (3%).
  formato: "numero" | "porcentaje" | "mxn";
}

// El orden es el del mockup del operador. Unidades: ver DECISIONS.md
// ("Fórmula del ingreso por suscripción: sin /12").
export const CATALOGO = {
  estudiantes_anio: {
    etiqueta: "Estudiantes atendidos al año",
    unidad: "estudiantes/año",
    min: 0,
    max: 1_000_000,
    entero: true,
    formato: "numero",
  },
  horas_mantenimiento_mes: {
    etiqueta: "Horas de mantenimiento al mes",
    unidad: "horas/mes",
    min: 0,
    max: 744, // horas que tiene un mes de 31 días
    entero: false,
    formato: "numero",
  },
  costo_hora: {
    etiqueta: "Costo por hora (MXN)",
    unidad: "MXN/hora",
    min: 0,
    max: 100_000,
    entero: false,
    formato: "mxn",
  },
  conversion_suscripcion: {
    etiqueta: "Conversión a suscripción",
    unidad: "%",
    min: 0,
    max: 100,
    entero: false,
    formato: "porcentaje",
  },
  precio_mensual: {
    etiqueta: "Precio mensual (MXN)",
    unidad: "MXN/mes",
    min: 0,
    max: 100_000,
    entero: false,
    formato: "mxn",
  },
  costo_correcciones_mes: {
    etiqueta: "Atención a correcciones (MXN al mes)",
    unidad: "MXN/mes",
    min: 0,
    max: 10_000_000,
    entero: false,
    formato: "mxn",
  },
  costo_infraestructura_mes: {
    etiqueta: "Infraestructura (MXN al mes)",
    unidad: "MXN/mes",
    min: 0,
    max: 10_000_000,
    entero: false,
    formato: "mxn",
  },
  // Insumo del chequeo 10:1 (Feature 3). No se siembra: sin evidencia, el
  // 10:1 es "no calculable" en vez de inventarlo.
  perdida_evitada_suscriptor_anio: {
    etiqueta: "Pérdida evitada por suscriptor al año (MXN)",
    unidad: "MXN/suscriptor/año",
    min: 0,
    max: 10_000_000,
    entero: false,
    formato: "mxn",
  },
} as const satisfies Record<string, DefinicionSupuesto>;

export type ClaveSupuesto = keyof typeof CATALOGO;

export const CLAVES = Object.keys(CATALOGO) as ClaveSupuesto[];

export function esClave(valor: string): valor is ClaveSupuesto {
  return Object.prototype.hasOwnProperty.call(CATALOGO, valor);
}

// Valores del mockup, todos inventados. Los siembra create_org() en la
// base; esta copia existe para la prueba que compara ambas.
export const SEMBRADOS: { key: ClaveSupuesto; value_num: number }[] = [
  { key: "estudiantes_anio", value_num: 2000 },
  { key: "horas_mantenimiento_mes", value_num: 40 },
  { key: "costo_hora", value_num: 150 },
  { key: "conversion_suscripcion", value_num: 3 },
  { key: "precio_mensual", value_num: 49 },
  { key: "costo_correcciones_mes", value_num: 1000 },
  { key: "costo_infraestructura_mes", value_num: 500 },
];

export const NOTA_MAX = 500;
export const URL_MAX = 500;
const DECIMALES_MAX = 4; // numeric(14, 4) en la base

// "2000", "2000.5", "2000,5", "3 %" → número. Se rechaza lo que no sea un
// número simple: 1e3, NaN, Infinity, 0x10, y separadores de miles.
//
// "2,000" y "1.500" son ambiguos (en México "2,000" es dos mil; con coma
// decimal sería 2): se rechazan con un mensaje que pide escribirlo sin
// separador, en vez de adivinar y guardar un valor mil veces menor.
export function leerNumero(texto: string): { valor: number } | { error: string } {
  const limpio = texto.trim().replace(/\s*%$/, "").trim();
  if (limpio === "") return { error: "Escribe un valor." };
  if (/^[1-9]\d{0,2}([.,]\d{3})+$/.test(limpio)) {
    return { error: `Escribe el número sin separador de miles, por ejemplo ${limpio.replace(/[.,]/g, "")}.` };
  }
  if (!/^-?\d+([.,]\d+)?$/.test(limpio)) {
    return { error: "Escribe solo un número, por ejemplo 150 o 2,5" };
  }
  const n = Number(limpio.replace(",", "."));
  if (!Number.isFinite(n)) return { error: "Escribe solo un número, por ejemplo 150 o 2,5" };
  const decimales = limpio.split(/[.,]/)[1]?.length ?? 0;
  if (decimales > DECIMALES_MAX) return { error: `Máximo ${DECIMALES_MAX} decimales.` };
  return { valor: n };
}

// Fecha de la fuente: AAAA-MM-DD (lo que manda <input type="date">), una
// fecha real y no en el futuro.
export function leerFecha(texto: string, hoy: Date = new Date()): { valor: string | null } | { error: string } {
  const limpio = texto.trim();
  if (limpio === "") return { valor: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpio);
  if (!m) return { error: "Usa el formato AAAA-MM-DD." };
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(a, mes - 1, d));
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== d) {
    return { error: "Esa fecha no existe." };
  }
  if (a < 1990) return { error: "La fecha es demasiado antigua." };
  const hoyUtc = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  // Un día de margen por zona horaria (México vs. UTC del servidor).
  if (fecha.getTime() > hoyUtc + 86_400_000) return { error: "La fecha no puede ser futura." };
  return { valor: limpio };
}

export function leerUrl(texto: string): { valor: string | null } | { error: string } {
  const limpio = texto.trim();
  if (limpio === "") return { valor: null };
  if ([...limpio].length > URL_MAX) return { error: `Máximo ${URL_MAX} caracteres.` };
  let url: URL;
  try {
    url = new URL(limpio);
  } catch {
    return { error: "Escribe una dirección completa, que empiece con https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: "Escribe una dirección completa, que empiece con https://" };
  }
  if (/\s/.test(limpio)) return { error: "La dirección no puede tener espacios." };
  return { valor: limpio };
}

export type CampoSupuesto = "key" | "value_num" | "status" | "source_url" | "source_date" | "note";
export type ValoresSupuesto = Record<CampoSupuesto, string>;
export type ErroresSupuesto = Partial<Record<CampoSupuesto, string>>;

export interface SupuestoValido {
  key: ClaveSupuesto;
  value_num: number;
  unit: string;
  status: EstadoSupuesto;
  source_url: string | null;
  source_date: string | null;
  note: string | null;
}

// Regla central de la Feature 2: "sustentado" exige fuente (URL y fecha).
// "débil" e "inventado" pueden omitirla. La misma regla vive en la base
// (constraint assumptions_sustained_needs_source).
export function validarSupuesto(
  valores: ValoresSupuesto,
  hoy: Date = new Date()
): { ok: true; datos: SupuestoValido } | { ok: false; errores: ErroresSupuesto } {
  const errores: ErroresSupuesto = {};

  const key = valores.key.trim();
  if (!esClave(key)) errores.key = "Elige un supuesto de la lista.";

  let valor: number | null = null;
  const n = leerNumero(valores.value_num);
  if ("error" in n) {
    errores.value_num = n.error;
  } else if (esClave(key)) {
    const def: DefinicionSupuesto = CATALOGO[key];
    if (n.valor < def.min || n.valor > def.max) {
      errores.value_num = `Debe estar entre ${def.min} y ${def.max.toLocaleString("es-MX")}.`;
    } else if (def.entero && !Number.isInteger(n.valor)) {
      errores.value_num = "Debe ser un número entero.";
    } else {
      valor = n.valor;
    }
  }

  const status = valores.status.trim();
  const statusOk = (ESTADOS as string[]).includes(status);
  if (!statusOk) errores.status = "Elige un estado.";

  const u = leerUrl(valores.source_url);
  if ("error" in u) errores.source_url = u.error;
  const f = leerFecha(valores.source_date, hoy);
  if ("error" in f) errores.source_date = f.error;

  if (status === "sustained") {
    if ("valor" in u && u.valor === null) errores.source_url = "Un supuesto sustentado necesita la URL de su fuente.";
    if ("valor" in f && f.valor === null) errores.source_date = "Un supuesto sustentado necesita la fecha de su fuente.";
  }

  const nota = valores.note.trim();
  if ([...nota].length > NOTA_MAX) errores.note = `Máximo ${NOTA_MAX} caracteres (llevas ${[...nota].length}).`;

  if (Object.keys(errores).length > 0 || !esClave(key) || valor === null || !statusOk) {
    return { ok: false, errores };
  }

  return {
    ok: true,
    datos: {
      key,
      value_num: valor,
      unit: CATALOGO[key].unidad,
      status: status as EstadoSupuesto,
      source_url: "valor" in u ? u.valor : null,
      source_date: "valor" in f ? f.valor : null,
      note: nota === "" ? null : nota,
    },
  };
}

const mxn = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });

export function formatearValor(key: string, valor: number | string): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!esClave(key)) return mxn.format(n);
  return CATALOGO[key].formato === "porcentaje" ? `${mxn.format(n)}%` : mxn.format(n);
}
