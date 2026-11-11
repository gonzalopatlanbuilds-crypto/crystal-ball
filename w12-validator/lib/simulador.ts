// Simulador de ingresos (semana 14). Lógica pura, sin React ni base de
// datos: test:logica la cubre completa, incluido el guardado con un
// almacén falso.
//
// Todo lo que entra aquí es un SUPUESTO de quien funda, no una medición.
// El simulador nunca lee ni escribe pricing_evidence: una proyección no
// puede convertirse en evidencia (cláusula de sombra).
//
// Decisiones aprobadas por Gonzalo (2026-11-11, DECISIONS.md):
// - Escenarios en localStorage (solo este navegador), no en Supabase.
// - Mezcla por nivel como supuesto extra, default 0 / 100 / 0.
// - Anual = mensual × 12 (el mismo mes, sin bajas ni crecimiento).

export const NIVELES_SIM = ["starter", "pro", "enterprise"] as const;
export type NivelSim = (typeof NIVELES_SIM)[number];

export const NOMBRE_NIVEL_SIM: Record<NivelSim, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export type Supuestos = {
  leadsMes: number;
  convDirectoReferidoPct: number;
  convReferidoPagadoPct: number;
  precios: Record<NivelSim, number>;
  mezclaPct: Record<NivelSim, number>;
};

// Valores de ejemplo para que la calculadora no arranque vacía. NO son los
// supuestos de quien funda: la página los presenta como ejemplo.
// Precios: los de lista de /pricing; Enterprise es cotización → 0.
export const SUPUESTOS_EJEMPLO: Supuestos = {
  leadsMes: 10,
  convDirectoReferidoPct: 50,
  convReferidoPagadoPct: 10,
  precios: { starter: 1500, pro: 4500, enterprise: 0 },
  mezclaPct: { starter: 0, pro: 100, enterprise: 0 },
};

export const LEADS_MAX = 10000;
export const PRECIO_MAX = 1000000;
export const MESES_ANUAL = 12;
export const ETIQUETA_ANUAL = "Anual (mismo mes × 12, sin bajas ni crecimiento)";

const centavos = (x: number) => Math.round(x * 100) / 100;

export type Resultado = {
  referidosMes: number;
  pagadosMes: number;
  porNivel: Record<NivelSim, { clientes: number; ingresoMes: number }>;
  mensual: number;
  anual: number;
};

export function calcular(s: Supuestos): Resultado {
  const referidosMes = (s.leadsMes * s.convDirectoReferidoPct) / 100;
  const pagadosMes = (referidosMes * s.convReferidoPagadoPct) / 100;
  const porNivel = {} as Resultado["porNivel"];
  let mensual = 0;
  for (const n of NIVELES_SIM) {
    const clientes = (pagadosMes * s.mezclaPct[n]) / 100;
    const ingresoMes = clientes * s.precios[n];
    porNivel[n] = { clientes: centavos(clientes), ingresoMes: centavos(ingresoMes) };
    mensual += ingresoMes;
  }
  return {
    referidosMes: centavos(referidosMes),
    pagadosMes: centavos(pagadosMes),
    porNivel,
    mensual: centavos(mensual),
    anual: centavos(mensual * MESES_ANUAL),
  };
}

// ---------- Validación ----------

// Lo que llega del formulario: texto tal cual lo escribió la persona.
export type CamposTexto = {
  leadsMes: string;
  convDirectoReferidoPct: string;
  convReferidoPagadoPct: string;
  precios: Record<NivelSim, string>;
  mezclaPct: Record<NivelSim, string>;
};

export type Errores = Partial<Record<string, string>>;

export function aTexto(s: Supuestos): CamposTexto {
  const map = (r: Record<NivelSim, number>) =>
    Object.fromEntries(NIVELES_SIM.map((n) => [n, String(r[n])])) as Record<NivelSim, string>;
  return {
    leadsMes: String(s.leadsMes),
    convDirectoReferidoPct: String(s.convDirectoReferidoPct),
    convReferidoPagadoPct: String(s.convReferidoPagadoPct),
    precios: map(s.precios),
    mezclaPct: map(s.mezclaPct),
  };
}

// "1,500" o " 4500 " → número. Vacío o basura → NaN.
function numero(texto: string): number {
  const limpio = texto.trim().replace(/,/g, "");
  if (limpio === "" || !/^-?\d+(\.\d+)?$/.test(limpio)) return NaN;
  return Number(limpio);
}

export function leerCampos(c: CamposTexto): { supuestos: Supuestos | null; errores: Errores } {
  const errores: Errores = {};
  const leads = numero(c.leadsMes);
  if (!Number.isInteger(leads) || leads < 0 || leads > LEADS_MAX) {
    errores.leadsMes = `Un número entero entre 0 y ${LEADS_MAX.toLocaleString("es-MX")}.`;
  }
  const pct = (campo: "convDirectoReferidoPct" | "convReferidoPagadoPct") => {
    const v = numero(c[campo]);
    if (!Number.isFinite(v) || v < 0 || v > 100) errores[campo] = "Un porcentaje entre 0 y 100.";
    return v;
  };
  const r1 = pct("convDirectoReferidoPct");
  const r2 = pct("convReferidoPagadoPct");
  const precios = {} as Record<NivelSim, number>;
  const mezcla = {} as Record<NivelSim, number>;
  for (const n of NIVELES_SIM) {
    precios[n] = numero(c.precios[n]);
    if (!Number.isFinite(precios[n]) || precios[n] < 0 || precios[n] > PRECIO_MAX) {
      errores[`precio.${n}`] = `Un monto entre 0 y ${PRECIO_MAX.toLocaleString("es-MX")}.`;
    }
    mezcla[n] = numero(c.mezclaPct[n]);
    if (!Number.isFinite(mezcla[n]) || mezcla[n] < 0 || mezcla[n] > 100) {
      errores[`mezcla.${n}`] = "Un porcentaje entre 0 y 100.";
    }
  }
  const sumaMezcla = NIVELES_SIM.reduce((t, n) => t + (Number.isFinite(mezcla[n]) ? mezcla[n] : 0), 0);
  if (NIVELES_SIM.every((n) => !errores[`mezcla.${n}`]) && Math.abs(sumaMezcla - 100) > 1e-9) {
    errores.mezcla = `La mezcla tiene que sumar 100%. Hoy suma ${centavos(sumaMezcla)}%.`;
  }
  if (Object.keys(errores).length > 0) return { supuestos: null, errores };
  return {
    supuestos: { leadsMes: leads, convDirectoReferidoPct: r1, convReferidoPagadoPct: r2, precios, mezclaPct: mezcla },
    errores,
  };
}

// Valida un objeto que viene de localStorage (puede estar corrupto o ser
// de otra versión). null si no sirve.
export function supuestosValidos(x: unknown): Supuestos | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const rec = (r: unknown) => {
    if (!r || typeof r !== "object") return null;
    const out = {} as Record<NivelSim, string>;
    for (const n of NIVELES_SIM) {
      const v = (r as Record<string, unknown>)[n];
      if (typeof v !== "number") return null;
      out[n] = String(v);
    }
    return out;
  };
  const precios = rec(o.precios), mezcla = rec(o.mezclaPct);
  if (!precios || !mezcla) return null;
  for (const k of ["leadsMes", "convDirectoReferidoPct", "convReferidoPagadoPct"]) {
    if (typeof o[k] !== "number") return null;
  }
  return leerCampos({
    leadsMes: String(o.leadsMes),
    convDirectoReferidoPct: String(o.convDirectoReferidoPct),
    convReferidoPagadoPct: String(o.convReferidoPagadoPct),
    precios,
    mezclaPct: mezcla,
  }).supuestos;
}

// ---------- Escenarios guardados (localStorage) ----------

// Lo mínimo de Storage que se usa; en las pruebas es un objeto falso.
export type Almacen = Pick<Storage, "getItem" | "setItem">;

export const CLAVE_ESCENARIOS = "validator.simulador.escenarios.v1";
export const CLAVE_ULTIMO = "validator.simulador.ultimo.v1";
export const NOMBRE_MAX = 60;
export const ESCENARIOS_MAX = 50;

export type Escenario = { id: string; nombre: string; supuestos: Supuestos; guardadoEn: string };

export const MENSAJE_SIN_ALMACEN =
  "Este navegador no permite guardar escenarios (¿ventana privada o datos del sitio bloqueados?). La calculadora sigue funcionando.";

export function validarNombre(nombre: string): string | null {
  const limpio = nombre.trim();
  if (limpio === "" || !/[\p{L}\p{N}]/u.test(limpio)) return "Ponle un nombre al escenario.";
  if (limpio.length > NOMBRE_MAX) return `Máximo ${NOMBRE_MAX} caracteres.`;
  return null;
}

// Nunca lanza: un almacén que falla o datos corruptos dan lista vacía y
// un error legible.
export function leerEscenarios(almacen: Almacen | null): { escenarios: Escenario[]; error: string | null } {
  if (!almacen) return { escenarios: [], error: MENSAJE_SIN_ALMACEN };
  let crudo: string | null;
  try {
    crudo = almacen.getItem(CLAVE_ESCENARIOS);
  } catch {
    return { escenarios: [], error: MENSAJE_SIN_ALMACEN };
  }
  if (!crudo) return { escenarios: [], error: null };
  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return { escenarios: [], error: "Los escenarios guardados estaban dañados y no se pudieron leer." };
  }
  if (!Array.isArray(datos)) return { escenarios: [], error: "Los escenarios guardados estaban dañados y no se pudieron leer." };
  const escenarios = datos.flatMap((d): Escenario[] => {
    const supuestos = supuestosValidos(d?.supuestos);
    if (!supuestos || typeof d?.id !== "string" || typeof d?.nombre !== "string" || validarNombre(d.nombre)) return [];
    return [{ id: d.id, nombre: d.nombre.trim(), supuestos, guardadoEn: String(d.guardadoEn ?? "") }];
  });
  const descartados = datos.length - escenarios.length;
  return {
    escenarios,
    error: descartados > 0 ? `${descartados} escenario(s) guardado(s) estaban dañados y no se muestran.` : null,
  };
}

function escribir(almacen: Almacen | null, escenarios: Escenario[]): string | null {
  if (!almacen) return MENSAJE_SIN_ALMACEN;
  try {
    almacen.setItem(CLAVE_ESCENARIOS, JSON.stringify(escenarios));
    return null;
  } catch {
    return "No se pudo guardar el escenario (el navegador lo rechazó).";
  }
}

// Agrega un escenario nuevo; nunca sobrescribe otro, aunque tenga el mismo
// nombre. Devuelve la lista nueva o un error (y entonces nada cambió).
export function guardarEscenario(
  almacen: Almacen | null,
  actuales: Escenario[],
  nombre: string,
  supuestos: Supuestos,
  id: string,
  ahora: Date,
): { escenarios: Escenario[]; error: string | null } {
  const errorNombre = validarNombre(nombre);
  if (errorNombre) return { escenarios: actuales, error: errorNombre };
  if (actuales.length >= ESCENARIOS_MAX) {
    return { escenarios: actuales, error: `Máximo ${ESCENARIOS_MAX} escenarios. Borra alguno para guardar otro.` };
  }
  const nuevos = [...actuales, { id, nombre: nombre.trim(), supuestos, guardadoEn: ahora.toISOString() }];
  const error = escribir(almacen, nuevos);
  if (error) return { escenarios: actuales, error };
  recordarUltimo(almacen, id);
  return { escenarios: nuevos, error: null };
}

export function borrarEscenario(almacen: Almacen | null, actuales: Escenario[], id: string): { escenarios: Escenario[]; error: string | null } {
  const nuevos = actuales.filter((e) => e.id !== id);
  const error = escribir(almacen, nuevos);
  return error ? { escenarios: actuales, error } : { escenarios: nuevos, error: null };
}

// El último escenario guardado o cargado: al recargar, se vuelve a cargar.
export function recordarUltimo(almacen: Almacen | null, id: string): void {
  try {
    almacen?.setItem(CLAVE_ULTIMO, id);
  } catch {
    // Sin almacén no hay "último": la página arranca con el ejemplo.
  }
}

export function ultimoEscenario(almacen: Almacen | null, escenarios: Escenario[]): Escenario | null {
  let id: string | null = null;
  try {
    id = almacen?.getItem(CLAVE_ULTIMO) ?? null;
  } catch {
    return null;
  }
  return escenarios.find((e) => e.id === id) ?? null;
}
