// Motor de hallazgos. Funciones puras y deterministas: sin IA, sin base de
// datos, sin red. La server action le pasa el historial y los hallazgos ya
// guardados; la prueba (npm run test:logica) le pasa casos construidos.
//
// "Última evidencia aceptada" de un SKU + proveedor (decisión de Gonzalo,
// DECISIONS.md): la primera carga es la base; una fila posterior se acepta
// si no produjo ningún hallazgo o si TODOS sus hallazgos fueron
// descartados. Un hallazgo confirmado, pendiente o que nunca se guardó
// deja la fila sin aceptar: nada que nadie revisó pasa a ser referencia.
import type { FilaEvidencia } from "./csv.ts";

export const TIPOS = ["missing_supplier", "value_conflict", "late_revision", "possible_duplicate"] as const;
export type TipoHallazgo = (typeof TIPOS)[number];
export type EstadoHallazgo = "pending" | "confirmed" | "discarded";

// Etiquetas fijas de la interfaz. "verificado" nunca aparece junto a una
// afirmación positiva: el duplicado siempre es "sin verificar".
export const ETIQUETA_TIPO: Record<TipoHallazgo, string> = {
  missing_supplier: "Sin dato de proveedor",
  value_conflict: "Valores en conflicto",
  late_revision: "Revisión posterior a evidencia",
  possible_duplicate: "Posible duplicado, sin verificar",
};

export const ETIQUETA_ESTADO: Record<EstadoHallazgo, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  discarded: "Descartado",
};

export interface VersionHistorial {
  id: string;
  seq: number;
  uploaded_at: string; // ISO
  uploaded_by: string;
  source_filename: string;
  identical_to_previous: boolean;
  raw_rows: FilaEvidencia[];
}

export interface HallazgoGuardado {
  fingerprint: string;
  status: EstadoHallazgo;
}

export interface CargaNueva {
  source_filename: string;
  filas: FilaEvidencia[];
}

// De dónde viene un valor: archivo + fila + versión + quién + cuándo.
export interface Procedencia {
  version_id: string;
  archivo: string;
  fila: number;
  uploaded_at: string;
  uploaded_by: string;
}

// La carga nueva todavía no tiene id ni fecha (los pone la base al
// guardarla); el hallazgo apunta a ella con evidence_version_id.
export interface ProcedenciaNueva {
  archivo: string;
  fila: number;
}

export interface ValoresFila {
  weight_g: number;
  material: string;
  packaging_revision_date: string;
  evidence_folio: string;
}

export type Detalles =
  | {
      // missing_supplier
      ultima_aceptada: Procedencia & ValoresFila;
      archivo_actual: string;
    }
  | {
      // value_conflict
      cambios: { campo: "weight_g" | "material"; anterior: number | string; nuevo: number | string }[];
      anterior: Procedencia & ValoresFila;
      nueva: ProcedenciaNueva & ValoresFila;
    }
  | {
      // late_revision
      fecha_revision: string;
      fecha_evidencia_aceptada: string; // fecha de carga (CDMX) de la última aceptada
      anterior: Procedencia & ValoresFila;
      nueva: ProcedenciaNueva & ValoresFila;
    }
  | {
      // possible_duplicate
      folio: string;
      nueva: ProcedenciaNueva & { sku: string; supplier: string };
      otros_usos: ({ version_id: string | null; archivo: string; fila: number; sku: string; supplier: string; uploaded_at: string | null })[];
    };

export interface HallazgoNuevo {
  type: TipoHallazgo;
  sku: string;
  supplier: string;
  details: Detalles;
  fingerprint: string;
}

const clave = (sku: string, supplier: string) => `${sku.toLowerCase()}|${supplier.toLowerCase()}`;
const normMaterial = (m: string) => m.trim().replace(/\s+/g, " ").toLowerCase();
const normFolio = (f: string) => f.trim().toUpperCase();
const valores = (f: FilaEvidencia): ValoresFila => ({
  weight_g: f.weight_g,
  material: f.material,
  packaging_revision_date: f.packaging_revision_date,
  evidence_folio: f.evidence_folio,
});

// Fecha (AAAA-MM-DD) en Ciudad de México de un instante ISO.
export function fechaMexico(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

// Mismo criterio que huella_evidencia() en la base: las filas sin su
// número de fila, en cualquier orden.
function canonica(filas: FilaEvidencia[]): string {
  return filas
    .map((f) => JSON.stringify([f.sku, f.supplier, f.weight_g, f.material, f.packaging_revision_date, f.evidence_folio]))
    .sort()
    .join("\n");
}

type FilaAceptada = FilaEvidencia & { procedencia: Procedencia };

interface UsoFolio {
  version_id: string | null;
  archivo: string;
  fila: number;
  sku: string;
  supplier: string;
  uploaded_at: string | null;
}

// Hallazgos que produce `filas` (de una carga) contra el estado aceptado y
// los usos previos de folios. Misma función para la carga nueva y para
// reconstruir el historial: así las huellas coinciden.
function candidatos(
  aceptadas: Map<string, FilaAceptada>,
  usosPrevios: Map<string, UsoFolio[]>,
  archivo: string,
  filas: FilaEvidencia[],
): HallazgoNuevo[] {
  const salida: HallazgoNuevo[] = [];
  const enCarga = new Set(filas.map((f) => clave(f.sku, f.supplier)));

  for (const f of filas) {
    const base = aceptadas.get(clave(f.sku, f.supplier));
    const nueva = { archivo, fila: f.fila, ...valores(f) };

    if (base) {
      const cambios: { campo: "weight_g" | "material"; anterior: number | string; nuevo: number | string }[] = [];
      if (base.weight_g !== f.weight_g) cambios.push({ campo: "weight_g", anterior: base.weight_g, nuevo: f.weight_g });
      if (normMaterial(base.material) !== normMaterial(f.material)) cambios.push({ campo: "material", anterior: base.material, nuevo: f.material });
      if (cambios.length) {
        salida.push({
          type: "value_conflict",
          sku: f.sku,
          supplier: f.supplier,
          details: { cambios, anterior: { ...base.procedencia, ...valores(base) }, nueva },
          fingerprint: ["value_conflict", clave(f.sku, f.supplier), ...cambios.map((c) => `${c.campo}:${String(c.anterior).toLowerCase()}>${String(c.nuevo).toLowerCase()}`)].join("|"),
        });
      }
      const fechaBase = fechaMexico(base.procedencia.uploaded_at);
      if (f.packaging_revision_date > fechaBase) {
        salida.push({
          type: "late_revision",
          sku: f.sku,
          supplier: f.supplier,
          details: {
            fecha_revision: f.packaging_revision_date,
            fecha_evidencia_aceptada: fechaBase,
            anterior: { ...base.procedencia, ...valores(base) },
            nueva,
          },
          fingerprint: ["late_revision", clave(f.sku, f.supplier), f.packaging_revision_date, fechaBase].join("|"),
        });
      }
    }

    // Folio en OTRO SKU u OTRO proveedor (en una versión anterior o en esta
    // misma carga). El mismo SKU + proveedor + folio reenviado es la misma
    // prueba, no una reutilización (decisión de Gonzalo).
    const folio = normFolio(f.evidence_folio);
    const otros: UsoFolio[] = [
      ...(usosPrevios.get(folio) ?? []),
      ...filas
        .filter((o) => o !== f && normFolio(o.evidence_folio) === folio)
        .map((o) => ({ version_id: null, archivo, fila: o.fila, sku: o.sku, supplier: o.supplier, uploaded_at: null })),
    ].filter((u) => clave(u.sku, u.supplier) !== clave(f.sku, f.supplier));
    if (otros.length) {
      const pares = [...new Set(otros.map((u) => clave(u.sku, u.supplier)))].sort();
      salida.push({
        type: "possible_duplicate",
        sku: f.sku,
        supplier: f.supplier,
        details: { folio: f.evidence_folio, nueva: { archivo, fila: f.fila, sku: f.sku, supplier: f.supplier }, otros_usos: otros },
        fingerprint: ["possible_duplicate", folio, clave(f.sku, f.supplier), ...pares].join("|"),
      });
    }
  }

  // Proveedor faltante: solo para proveedores que vienen en esta carga (un
  // archivo por proveedor es lo normal; un proveedor ausente no se juzga).
  const proveedores = new Set(filas.map((f) => f.supplier.toLowerCase()));
  for (const [k, base] of aceptadas) {
    if (!proveedores.has(base.supplier.toLowerCase()) || enCarga.has(k)) continue;
    salida.push({
      type: "missing_supplier",
      sku: base.sku,
      supplier: base.supplier,
      details: { ultima_aceptada: { ...base.procedencia, ...valores(base) }, archivo_actual: archivo },
      // La versión de la última aceptada va en la huella: si el SKU vuelve,
      // se acepta y luego vuelve a faltar, es un hallazgo nuevo.
      fingerprint: ["missing_supplier", k, base.procedencia.version_id].join("|"),
    });
  }
  return salida;
}

// Reconstruye, en orden de seq, qué fila de cada SKU + proveedor es la
// última aceptada y qué folios se han usado, aplicando los estados actuales
// de los hallazgos guardados.
export function reconstruir(historial: VersionHistorial[], guardados: HallazgoGuardado[]) {
  const estado = new Map(guardados.map((h) => [h.fingerprint, h.status]));
  const aceptadas = new Map<string, FilaAceptada>();
  const usos = new Map<string, UsoFolio[]>();

  for (const v of [...historial].sort((a, b) => a.seq - b.seq)) {
    // Una versión idéntica a la anterior no aporta nada nuevo.
    if (v.identical_to_previous) continue;
    const cands = candidatos(aceptadas, usos, v.source_filename, v.raw_rows);
    for (const f of v.raw_rows) {
      const k = clave(f.sku, f.supplier);
      const suyos = cands.filter((c) => c.type !== "missing_supplier" && clave(c.sku, c.supplier) === k);
      if (suyos.every((c) => estado.get(c.fingerprint) === "discarded")) {
        aceptadas.set(k, {
          ...f,
          procedencia: { version_id: v.id, archivo: v.source_filename, fila: f.fila, uploaded_at: v.uploaded_at, uploaded_by: v.uploaded_by },
        });
      }
    }
    for (const f of v.raw_rows) {
      const folio = normFolio(f.evidence_folio);
      usos.set(folio, [
        ...(usos.get(folio) ?? []),
        { version_id: v.id, archivo: v.source_filename, fila: f.fila, sku: f.sku, supplier: f.supplier, uploaded_at: v.uploaded_at },
      ]);
    }
  }
  return { aceptadas, usos };
}

// Hallazgos NUEVOS de una carga: los que todavía no existen (por huella)
// en la organización. Una carga idéntica a la última versión no produce
// ninguno.
export function detectarHallazgos(historial: VersionHistorial[], guardados: HallazgoGuardado[], carga: CargaNueva): HallazgoNuevo[] {
  const ultima = [...historial].sort((a, b) => b.seq - a.seq)[0];
  if (ultima && canonica(ultima.raw_rows) === canonica(carga.filas)) return [];

  const { aceptadas, usos } = reconstruir(historial, guardados);
  const existentes = new Set(guardados.map((h) => h.fingerprint));
  const vistos = new Set<string>();
  return candidatos(aceptadas, usos, carga.source_filename, carga.filas).filter((h) => {
    if (existentes.has(h.fingerprint) || vistos.has(h.fingerprint)) return false;
    vistos.add(h.fingerprint);
    return true;
  });
}

// Texto de una línea para la lista. Lo arma el código, nunca la IA.
export function describirHallazgo(h: { type: TipoHallazgo; supplier: string | null; details: Detalles }): string {
  const fmtFecha = (iso: string) => new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`));
  const d = h.details as Record<string, unknown>;
  switch (h.type) {
    case "missing_supplier": {
      const u = d.ultima_aceptada as Procedencia;
      return `Falta ${h.supplier} para este SKU: lo reportó en ${u.archivo} (fila ${u.fila}) y no aparece en ${d.archivo_actual as string}`;
    }
    case "value_conflict":
      return (d.cambios as { campo: string; anterior: number | string; nuevo: number | string }[])
        .map((c) => (c.campo === "weight_g" ? `Peso declarado: ${c.anterior} g (anterior) vs ${c.nuevo} g (nuevo)` : `Material: ${c.anterior} (anterior) vs ${c.nuevo} (nuevo)`))
        .join(" · ");
    case "late_revision":
      return `Evidencia aceptada el ${fmtFecha(d.fecha_evidencia_aceptada as string)}; empaque revisado el ${fmtFecha(d.fecha_revision as string)}`;
    case "possible_duplicate": {
      // Pares SKU + proveedor distintos: el mismo folio en 3 versiones del
      // mismo SKU es un solo "otro uso", no tres.
      const pares = [...new Set((d.otros_usos as UsoFolio[]).map((o) => `${o.sku} (${o.supplier})`))];
      return `Folio ${d.folio as string} también citado para ${pares.join(", ")}`;
    }
  }
}
