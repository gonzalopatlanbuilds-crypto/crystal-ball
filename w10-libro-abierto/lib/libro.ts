// Contenido del snapshot que se publica en published_ledger.content. Lista
// blanca: solo cifras, estados, fuentes y conteos. NUNCA notas, descripción
// ni referencia de la evidencia, correos, nombres ni ids de personas (son
// texto libre o datos personales). test:logica revisa las claves.

import { calcularModelo, pruebaIndependencia, type Cifra, type Supuesto } from "./modelo.ts";
import { CATALOGO, esClave } from "./supuestos.ts";
import type { Viabilidad } from "./viabilidad.ts";

export const FORMATO_LIBRO = 1;

export interface SupuestoPublicado {
  clave: string;
  etiqueta: string;
  valor: number;
  unidad: string;
  estado: Supuesto["status"];
  fuente_url: string | null;
  fuente_fecha: string | null;
}

export interface Libro {
  formato: number;
  simulado: true;
  viabilidad: Viabilidad;
  costos: { mantenimiento: Cifra; correcciones: Cifra; infraestructura: Cifra; total: Cifra };
  ingreso_mensual: Cifra;
  faltante: Cifra;
  costo_por_estudiante_anual: Cifra;
  diez_a_uno: { umbral: Cifra; razon: Cifra; cumple: boolean | null };
  supuestos: SupuestoPublicado[];
  evidencia_pagador: { registros: number; tipos: string[] };
  independencia_verificada: boolean;
}

export interface SupuestoConFuente extends Supuesto {
  unit: string;
  source_url: string | null;
  source_date: string | null;
}

export function construirLibro(
  supuestos: readonly SupuestoConFuente[],
  tiposEvidencia: readonly string[],
  viabilidad: Viabilidad
): Libro {
  const r = calcularModelo(supuestos);
  return {
    formato: FORMATO_LIBRO,
    simulado: true,
    viabilidad,
    costos: {
      mantenimiento: r.mantenimiento,
      correcciones: r.correcciones,
      infraestructura: r.infraestructura,
      total: r.costoMensual,
    },
    ingreso_mensual: r.ingresoMensual,
    faltante: r.faltante,
    costo_por_estudiante_anual: r.costoPorEstudianteAnual,
    diez_a_uno: { umbral: r.diezAUno.umbral, razon: r.diezAUno.razon, cumple: r.diezAUno.cumple },
    supuestos: supuestos.map((s) => ({
      clave: s.key,
      etiqueta: esClave(s.key) ? CATALOGO[s.key].etiqueta : s.key,
      valor: s.value_num,
      unidad: s.unit,
      estado: s.status,
      fuente_url: s.source_url,
      fuente_fecha: s.source_date,
    })),
    evidencia_pagador: { registros: tiposEvidencia.length, tipos: [...new Set(tiposEvidencia)].sort() },
    independencia_verificada: pruebaIndependencia(supuestos),
  };
}

// Lectura defensiva del snapshot para la página pública: si la forma no es
// la esperada, la página dice que no puede mostrarlo en vez de romperse o
// mostrar algo a medias.
function esCifra(c: unknown): c is Cifra {
  if (typeof c !== "object" || c === null) return false;
  const x = c as Record<string, unknown>;
  return x.calculable === true
    ? typeof x.valor === "number" && typeof x.estado === "string"
    : x.calculable === false && typeof x.motivo === "string";
}

export function leerLibro(content: unknown): Libro | null {
  if (typeof content !== "object" || content === null) return null;
  const l = content as Partial<Libro>;
  const c = l.costos;
  if (
    l.formato !== FORMATO_LIBRO ||
    typeof l.viabilidad !== "string" ||
    !c ||
    ![c.mantenimiento, c.correcciones, c.infraestructura, c.total].every(esCifra)
  ) {
    return null;
  }
  return l as Libro;
}

// Textos fijos de la página pública (mockup). Viven en código, no en el
// snapshot: son compromisos del verificador, no datos de una versión.
export const NINGUN_PATROCINADOR_PUEDE_CAMBIAR = [
  "Los resultados de compatibilidad.",
  "El orden y la cobertura de las listas.",
  "Las correcciones que se publican.",
  "No hay comisiones por referido ni enlaces de afiliado.",
];

export const QUE_DATOS_GUARDAMOS = [
  "De estudiantes: ninguno. Esta página no pide cuenta.",
  "Solo el equipo inicia sesión para editar el modelo.",
  "No se comparte nada con vendedores.",
];
