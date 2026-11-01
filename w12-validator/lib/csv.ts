// Lectura y validación del CSV de proveedor. Lógica pura (sin base de
// datos ni red): la usa la server action de carga y la prueba con `node`
// directo (npm run test:logica). La base vuelve a revisar la forma de cada
// fila al guardar (sql/schema.sql, validar_filas_evidencia), por si alguien
// llama al RPC sin pasar por aquí.

export const COLUMNAS = [
  "sku",
  "supplier",
  "weight_g",
  "material",
  "packaging_revision_date",
  "evidence_folio",
] as const;

export const TAMANO_MAX_BYTES = 200 * 1024;
export const FILAS_MAX = 1000;
export const PESO_MAX_G = 1_000_000;

// Una fila aceptada. `fila` es el número de línea en el archivo original
// (la cabecera es la 1): con el nombre del archivo, quién y cuándo, es la
// procedencia de cada valor.
export interface FilaEvidencia {
  fila: number;
  sku: string;
  supplier: string;
  weight_g: number;
  material: string;
  packaging_revision_date: string; // AAAA-MM-DD
  evidence_folio: string;
}

export interface FilaRechazada {
  fila: number;
  motivo: string;
}

export type ResultadoCsv =
  | { ok: false; error: string }
  | { ok: true; filas: FilaEvidencia[]; rechazadas: FilaRechazada[]; columnasIgnoradas: string[] };

const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const FOLIO = /^[A-Za-z0-9][A-Za-z0-9/._-]{0,63}$/;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
// Caracteres de control (salvo tab) en texto libre.
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

// Valida lo que llega antes de leer el contenido: extensión, tipo y tamaño.
export function validarArchivo(nombre: string, tipo: string, tamano: number): string | null {
  if (!/\.csv$/i.test(nombre)) return "El archivo debe terminar en .csv.";
  // Los navegadores mandan tipos distintos para un .csv (Excel en Windows
  // manda application/vnd.ms-excel; algunos, nada).
  const tiposOk = ["", "text/csv", "text/plain", "application/vnd.ms-excel", "application/csv"];
  if (!tiposOk.includes(tipo.toLowerCase())) return `Tipo de archivo no aceptado (${tipo}). Sube un CSV.`;
  if (tamano === 0) return "El archivo está vacío.";
  if (tamano > TAMANO_MAX_BYTES) return `El archivo pesa más de ${TAMANO_MAX_BYTES / 1024} KB.`;
  if (nombre.length > 200) return "El nombre del archivo es demasiado largo.";
  return null;
}

// Número con punto o coma decimal. Rechaza notación científica (1e3),
// NaN, Infinity, signos y separadores de miles. "1,234" o "1.500" son
// ambiguos (¿miles o decimales?): se rechazan con un motivo claro en vez
// de adivinar. "0,125" sí es decimal sin ambigüedad.
export function leerNumero(texto: string): { valor: number } | { error: string } {
  const t = texto.trim();
  if (t === "") return { error: "falta el valor" };
  if (!/^\d+([.,]\d+)?$/.test(t)) {
    if (/^\d{1,3}([.,]\d{3}){2,}([.,]\d+)?$/.test(t) || /^\d{1,3}(,\d{3})+\.\d+$/.test(t) || /^\d{1,3}(\.\d{3})+,\d+$/.test(t)) {
      return { error: `"${t}" usa separador de miles; escribe el número sin separadores` };
    }
    return { error: `"${t}" no es un número válido (usa 12.5 o 12,5)` };
  }
  const [entero, decimales = ""] = t.split(/[.,]/);
  if (decimales.length === 3 && Number(entero) !== 0) {
    return { error: `"${t}" es ambiguo (¿separador de miles o decimales?); escribe ${entero}${decimales} o usa máximo 2 decimales` };
  }
  if (decimales.length > 3) return { error: `"${t}" tiene demasiados decimales (máximo 3)` };
  const valor = Number(t.replace(",", "."));
  if (!Number.isFinite(valor)) return { error: `"${t}" no es un número válido` };
  return { valor };
}

// Fecha AAAA-MM-DD real (no 2026-02-30), no anterior a 2000 ni posterior a
// `hoy` (AAAA-MM-DD).
export function leerFecha(texto: string, hoy: string): { valor: string } | { error: string } {
  const t = texto.trim();
  const m = FECHA.exec(t);
  if (!m) return { error: `"${t}" no es una fecha AAAA-MM-DD` };
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(a, mes - 1, d));
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== d) {
    return { error: `"${t}" no es una fecha que exista` };
  }
  if (t < "2000-01-01") return { error: `"${t}" es anterior a 2000` };
  if (t > hoy) return { error: `"${t}" está en el futuro` };
  return { valor: t };
}

function textoLibre(nombre: string, texto: string, max: number): { valor: string } | { error: string } {
  const t = texto.trim().replace(/\s+/g, " ");
  if (t === "") return { error: `falta ${nombre}` };
  if (t.length > max) return { error: `${nombre} tiene más de ${max} caracteres` };
  if (CONTROL.test(t)) return { error: `${nombre} tiene caracteres de control` };
  // Evita que el valor se interprete como fórmula si alguien abre los datos
  // en una hoja de cálculo.
  if (/^[=+@-]/.test(t)) return { error: `${nombre} no puede empezar con = + - @` };
  return { valor: t };
}

// Separa una línea en campos (RFC 4180: comillas dobles, "" dentro de
// comillas). Devuelve null si una comilla queda abierta.
function separarLinea(linea: string, sep: string): string[] | null {
  const campos: string[] = [];
  let actual = "";
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (enComillas) {
      if (ch === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        actual += ch;
      }
    } else if (ch === '"' && actual.trim() === "") {
      enComillas = true;
      actual = "";
    } else if (ch === sep) {
      campos.push(actual);
      actual = "";
    } else {
      actual += ch;
    }
  }
  if (enComillas) return null;
  campos.push(actual);
  return campos;
}

// `hoy` se recibe (AAAA-MM-DD) para que la prueba sea reproducible.
export function leerCsv(contenido: string, hoy: string): ResultadoCsv {
  if (contenido.includes("\u0000")) return { ok: false, error: "El archivo no es texto (parece binario)." };
  if (contenido.includes("�")) return { ok: false, error: "El archivo no está en UTF-8. Guárdalo como CSV UTF-8." };
  const texto = contenido.replace(/^﻿/, "");
  const lineas = texto.split(/\r\n|\n|\r/);
  const cabecera = lineas[0] ?? "";
  if (cabecera.trim() === "") return { ok: false, error: "El archivo no tiene cabecera." };

  // Excel en español exporta con punto y coma; si la cabecera lo usa y no
  // tiene comas, ese es el separador.
  const sep = cabecera.includes(";") && !cabecera.includes(",") ? ";" : ",";
  const nombres = separarLinea(cabecera, sep)?.map((c) => c.trim().toLowerCase());
  if (!nombres) return { ok: false, error: "La cabecera tiene una comilla sin cerrar." };
  const repetidas = nombres.filter((n, i) => n !== "" && nombres.indexOf(n) !== i);
  if (repetidas.length) return { ok: false, error: `Columna repetida en la cabecera: ${[...new Set(repetidas)].join(", ")}.` };
  const faltan = COLUMNAS.filter((c) => !nombres.includes(c));
  if (faltan.length) return { ok: false, error: `Faltan columnas obligatorias: ${faltan.join(", ")}.` };
  const indice = Object.fromEntries(COLUMNAS.map((c) => [c, nombres.indexOf(c)])) as Record<(typeof COLUMNAS)[number], number>;
  const columnasIgnoradas = nombres.filter((n) => n !== "" && !(COLUMNAS as readonly string[]).includes(n));

  const filas: FilaEvidencia[] = [];
  const rechazadas: FilaRechazada[] = [];
  const vistos = new Map<string, number>();
  let conDatos = 0;

  for (let i = 1; i < lineas.length; i++) {
    const numero = i + 1;
    const linea = lineas[i];
    // Una línea vacía no tiene datos que perder: no cuenta como fila.
    if (linea.trim() === "") continue;
    conDatos++;
    if (conDatos > FILAS_MAX) return { ok: false, error: `El archivo tiene más de ${FILAS_MAX} filas de datos.` };

    const campos = separarLinea(linea, sep);
    if (!campos) {
      rechazadas.push({ fila: numero, motivo: "comilla sin cerrar" });
      continue;
    }
    if (campos.length !== nombres.length) {
      rechazadas.push({ fila: numero, motivo: `tiene ${campos.length} columnas y la cabecera ${nombres.length}` });
      continue;
    }
    const campo = (c: (typeof COLUMNAS)[number]) => campos[indice[c]] ?? "";
    const motivos: string[] = [];

    const sku = campo("sku").trim();
    if (!SKU.test(sku)) motivos.push(sku === "" ? "falta sku" : `sku "${sku.slice(0, 40)}" inválido (letras, números, . _ -; máx. 64)`);
    const proveedor = textoLibre("supplier", campo("supplier"), 120);
    if ("error" in proveedor) motivos.push(proveedor.error);
    const peso = leerNumero(campo("weight_g"));
    if ("error" in peso) motivos.push(`weight_g: ${peso.error}`);
    else if (peso.valor <= 0 || peso.valor > PESO_MAX_G) motivos.push(`weight_g fuera de rango (mayor que 0 y hasta ${PESO_MAX_G})`);
    const material = textoLibre("material", campo("material"), 60);
    if ("error" in material) motivos.push(material.error);
    const fecha = leerFecha(campo("packaging_revision_date"), hoy);
    if ("error" in fecha) motivos.push(`packaging_revision_date: ${fecha.error}`);
    const folio = campo("evidence_folio").trim();
    if (!FOLIO.test(folio)) motivos.push(folio === "" ? "falta evidence_folio" : `evidence_folio "${folio.slice(0, 40)}" inválido`);

    if (motivos.length) {
      rechazadas.push({ fila: numero, motivo: motivos.join("; ") });
      continue;
    }
    const valorProveedor = (proveedor as { valor: string }).valor;
    // El motor compara por SKU + proveedor: dos filas iguales en el mismo
    // archivo no se pueden comparar contra nada. Se rechaza la segunda.
    const clave = `${sku.toLowerCase()}|${valorProveedor.toLowerCase()}`;
    const previa = vistos.get(clave);
    if (previa !== undefined) {
      rechazadas.push({ fila: numero, motivo: `SKU ${sku} con ${valorProveedor} ya aparece en la fila ${previa}` });
      continue;
    }
    vistos.set(clave, numero);
    filas.push({
      fila: numero,
      sku,
      supplier: valorProveedor,
      weight_g: (peso as { valor: number }).valor,
      material: (material as { valor: string }).valor,
      packaging_revision_date: (fecha as { valor: string }).valor,
      evidence_folio: folio,
    });
  }

  if (conDatos === 0) return { ok: false, error: "El archivo solo tiene la cabecera: no hay filas de datos." };
  return { ok: true, filas, rechazadas, columnasIgnoradas };
}

// Fecha de hoy en Ciudad de México (AAAA-MM-DD), para no rechazar una
// fecha de hoy cuando en UTC ya es mañana o al revés.
export function hoyMexico(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}
