// Niveles de precio y estados de evidencia (semana 14). Lógica pura, sin
// base de datos: la prueba test:logica la cubre completa.
//
// Cláusula de sombra: una cifra nunca se muestra más fuerte de lo que es.
// El chip de un nivel con evidencia se arma con los estados de sus filas
// reales en pricing_evidence; "paid" solo aparece si hay una fila paid, y la
// base solo acepta una fila paid con referencia de pago.

export type EstadoEvidencia = "direct" | "relayed" | "paid";

export const ESTADOS: readonly EstadoEvidencia[] = ["direct", "relayed", "paid"];

// Etiqueta de cada estado tal como la ve el público (/about la usa por fila).
export const ETIQUETA_ESTADO_PRECIO: Record<EstadoEvidencia, string> = {
  direct: "Directa",
  relayed: "Referida",
  paid: "Pagada",
};

export const SIGNIFICADO_ESTADO_PRECIO: Record<EstadoEvidencia, string> = {
  direct: "La persona usuaria dijo la cifra ella misma.",
  relayed: "La persona usuaria la reportó de parte de quien decide en su empresa.",
  paid: "Hubo un pago real, con referencia de pago.",
};

export type FilaPrecio = {
  id: number;
  amount_mxn: number;
  state: EstadoEvidencia;
  source: string;
  note: string | null;
  created_at: string;
};

// Tono del chip: verde = hay evidencia real (en /about, solo un pago);
// ámbar = segmento no probado, o una cifra que es señal y no venta;
// gris = hipótesis sin evidencia.
export type TonoChip = "evidencia" | "no-probado" | "senal" | "hipotesis";

// Tono del chip de una fila en /about: directa y referida son señales
// (ámbar); solo un pago real va en verde.
export function tonoEstado(estado: EstadoEvidencia): TonoChip {
  return estado === "paid" ? "evidencia" : "senal";
}

export type Nivel = {
  id: "starter" | "pro" | "enterprise";
  nombre: string;
  // null = cotización a medida (Enterprise).
  precioListaMxn: number | null;
  precioFundador: { mxn: number; meses: number } | null;
  segmento: string;
  // Solo el nivel con evidencia real lee filas de pricing_evidence.
  usaEvidencia: boolean;
  chipSinEvidencia: { texto: string; tono: TonoChip };
  detalle: string;
};

export const NIVELES: readonly Nivel[] = [
  {
    id: "starter",
    nombre: "Starter",
    precioListaMxn: 1500,
    precioFundador: null,
    segmento: "PyME micro (1–3 personas)",
    usaEvidencia: false,
    chipSinEvidencia: { texto: "Segmento no probado", tono: "no-probado" },
    detalle: "Segmento sin evidencia de pago aún.",
  },
  {
    id: "pro",
    nombre: "Pro",
    precioListaMxn: 4500,
    precioFundador: { mxn: 3500, meses: 12 },
    segmento: "PyME mediana (~45 empleados, 4+ proveedores)",
    usaEvidencia: true,
    // Solo se usa si todavía no hay ninguna fila (o no se pudo leer).
    chipSinEvidencia: { texto: "Sin evidencia registrada", tono: "hipotesis" },
    detalle: "El único segmento con cifras reales de una persona usuaria.",
  },
  {
    id: "enterprise",
    nombre: "Enterprise",
    precioListaMxn: null,
    precioFundador: null,
    segmento: "Empresa grande, ya usa plataforma enterprise",
    usaEvidencia: false,
    chipSinEvidencia: { texto: "Hipótesis, sin evidencia", tono: "hipotesis" },
    detalle: "Sin evidencia todavía — hipótesis futura.",
  },
];

// Los dos segmentos de cliente con precio publicado. Enterprise es una
// hipótesis por cotización, no un segmento con precio.
export const SEGMENTOS = NIVELES.filter((n) => n.precioListaMxn !== null).map((n) => n.segmento);

const PALABRA_CHIP: Record<EstadoEvidencia, string> = {
  direct: "directa",
  relayed: "referida",
  paid: "pagada",
};

// "Evidencia directa + referida" a partir de los estados que de verdad hay.
// Orden fijo (direct, relayed, paid), sin repetir. Sin filas → null.
export function textoChipEvidencia(estados: readonly string[]): string | null {
  const presentes = ESTADOS.filter((e) => estados.includes(e));
  if (presentes.length === 0) return null;
  return `Evidencia ${presentes.map((e) => PALABRA_CHIP[e]).join(" + ")}`;
}

export function chipDeNivel(nivel: Nivel, filas: readonly FilaPrecio[] | null): { texto: string; tono: TonoChip } {
  if (!nivel.usaEvidencia || !filas) return nivel.chipSinEvidencia;
  const texto = textoChipEvidencia(filas.map((f) => f.state));
  return texto ? { texto, tono: "evidencia" } : nivel.chipSinEvidencia;
}

// Cuántos pagos reales hay. Nunca se suma un monto que no fue un pago.
export function pagosReales(filas: readonly FilaPrecio[]): number {
  return filas.filter((f) => f.state === "paid").length;
}

const FORMATO_MXN = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });

// "$4,500". Siempre pesos mexicanos; la unidad (MXN/mes) va aparte.
export function formatoMxn(monto: number): string {
  return `$${FORMATO_MXN.format(monto)}`;
}

// Supabase devuelve numeric como número o como texto según el driver; se
// normaliza y se descarta lo que no sea una fila válida.
export function normalizarFilas(datos: unknown): FilaPrecio[] {
  if (!Array.isArray(datos)) return [];
  return datos.flatMap((d) => {
    const monto = Number(d?.amount_mxn);
    if (!Number.isFinite(monto) || monto <= 0) return [];
    if (!ESTADOS.includes(d?.state)) return [];
    if (typeof d?.source !== "string" || typeof d?.id !== "number") return [];
    return [{
      id: d.id,
      amount_mxn: monto,
      state: d.state as EstadoEvidencia,
      source: d.source,
      note: typeof d.note === "string" ? d.note : null,
      created_at: String(d.created_at ?? ""),
    }];
  });
}
