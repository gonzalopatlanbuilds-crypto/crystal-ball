// Prueba mecánica de la lógica pura (sin base de datos).
// Uso: npm run test:logica
import { crearOrgSchema, normalizarJoinCode, unirseOrgSchema } from "../lib/orgs.ts";
import { COLUMNAS, FILAS_MAX, hoyMexico, leerCsv, leerFecha, leerNumero, TAMANO_MAX_BYTES, validarArchivo } from "../lib/csv.ts";
import { CSV_EJEMPLO } from "../lib/ejemplo.ts";

let ok = 0;
let fail = 0;
function check(nombre: string, cond: boolean, detalle?: unknown) {
  if (cond) {
    ok++;
    console.log("PASS", nombre);
  } else {
    fail++;
    console.log("FAIL", nombre, JSON.stringify(detalle));
  }
}

// ---------- Feature 1: organizaciones ----------
check("join code en minúsculas y sin guion se normaliza", normalizarJoinCode(" abc234 ") === "ABC-234");
check("join code válido pasa", unirseOrgSchema.safeParse({ joinCode: "abc-234" }).success);
check("join code con 0/O se rechaza", !unirseOrgSchema.safeParse({ joinCode: "AB0-234" }).success);
check("nombre de org de 1 letra se rechaza", !crearOrgSchema.safeParse({ name: "x" }).success);

// ---------- Feature 2: archivo ----------
const HOY = "2026-10-25";
check("archivo .csv text/csv de 1 KB pasa", validarArchivo("proveedor.csv", "text/csv", 1024) === null);
check("archivo .CSV de Excel (application/vnd.ms-excel) pasa", validarArchivo("PROVEEDOR.CSV", "application/vnd.ms-excel", 10) === null);
check("archivo .xlsx se rechaza", validarArchivo("proveedor.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 10) !== null);
check("archivo .csv con tipo image/png se rechaza", validarArchivo("truco.csv", "image/png", 10) !== null);
check("archivo vacío se rechaza", validarArchivo("vacio.csv", "text/csv", 0) !== null);
check(`archivo de más de ${TAMANO_MAX_BYTES / 1024} KB se rechaza`, validarArchivo("grande.csv", "text/csv", TAMANO_MAX_BYTES + 1) !== null);
check("archivo justo en el límite pasa", validarArchivo("limite.csv", "text/csv", TAMANO_MAX_BYTES) === null);

// ---------- Feature 2: números ----------
const num = (t: string) => {
  const r = leerNumero(t);
  return "valor" in r ? r.valor : null;
};
check("12.5 → 12.5", num("12.5") === 12.5);
check("12,5 (coma decimal) → 12.5", num("12,5") === 12.5);
check("0,125 → 0.125 (sin ambigüedad)", num("0,125") === 0.125);
check("42 → 42", num(" 42 ") === 42);
for (const malo of ["1e3", "1E3", "NaN", "Infinity", "-Infinity", "-5", "+5", "1,234.5", "1.234,5", "1,234,567", "1.500", "1,500", "12.", ".5", "0x10", "12 5", "doce", "", "1_000"]) {
  check(`"${malo}" se rechaza`, num(malo) === null, leerNumero(malo));
}
check("separador de miles: el motivo lo dice", /miles/.test(JSON.stringify(leerNumero("1,234,567"))));
check("1,500 ambiguo: el motivo lo dice", /ambiguo/.test(JSON.stringify(leerNumero("1,500"))));

// ---------- Feature 2: fechas ----------
const fecha = (t: string) => {
  const r = leerFecha(t, HOY);
  return "valor" in r ? r.valor : null;
};
check("2026-09-15 pasa", fecha("2026-09-15") === "2026-09-15");
check("hoy pasa", fecha(HOY) === HOY);
check("mañana se rechaza (futuro)", fecha("2026-10-26") === null);
check("2026-02-30 se rechaza (no existe)", fecha("2026-02-30") === null);
check("2024-02-29 pasa (bisiesto)", fecha("2024-02-29") === "2024-02-29");
check("15/09/2026 se rechaza (formato)", fecha("15/09/2026") === null);
check("1999-12-31 se rechaza (antes de 2000)", fecha("1999-12-31") === null);
check("hoyMexico: 2026-10-26 03:00 UTC sigue siendo 25 en CDMX", hoyMexico(new Date("2026-10-26T03:00:00Z")) === "2026-10-25");

// ---------- Feature 2: CSV ----------
const CAB = COLUMNAS.join(",");
const ej = leerCsv(CSV_EJEMPLO, HOY);
check("ejemplo: 10 filas válidas, 0 rechazadas", ej.ok && ej.filas.length === 10 && ej.rechazadas.length === 0, ej);
check("ejemplo: 8 SKUs distintos y 2 proveedores", ej.ok && new Set(ej.filas.map((f) => f.sku)).size === 8 && new Set(ej.filas.map((f) => f.supplier)).size === 2);
check("ejemplo: todo marcado como simulado (SIM- y 'Simulado')", ej.ok && ej.filas.every((f) => f.sku.startsWith("SIM-") && /Simulado/.test(f.supplier) && f.evidence_folio.startsWith("FOL-SIM-")));
check("ejemplo: campo entre comillas con coma (\"papel, laminado\")", ej.ok && ej.filas.some((f) => f.material === "papel, laminado"));
check("ejemplo: \"12,5\" entre comillas → 12.5", ej.ok && ej.filas.some((f) => f.sku === "SIM-8890" && f.weight_g === 12.5));
check("ejemplo: procedencia = número de línea del archivo (cabecera = 1)", ej.ok && ej.filas[0].fila === 2 && ej.filas[9].fila === 11);

const mixto = [
  CAB,
  "SKU-1,Prov A,10,PET,2026-09-01,F-1",
  "SKU-2,Prov A,1e3,PET,2026-09-01,F-2",
  "SKU-3,Prov A,10,PET,2026-02-30,F-3",
  "SKU-4,Prov A,10,PET,2026-09-01",
  "",
  "SKU-5,,10,PET,2026-09-01,F-5",
  "SKU-1,Prov A,11,PET,2026-09-01,F-6",
  "SKU 7,Prov A,10,PET,2026-09-01,F-7",
  "SKU-8,=HYPERLINK(\"x\"),10,PET,2026-09-01,F-8",
  "SKU-9,Prov A,NaN,PET,2026-09-01,F-9",
  "SKU-10,Prov A,10,PET,2026-09-01,F-10",
  "SKU-11,\"Prov \"\"B\"\"\",10,PET,2026-09-01,F-11",
  "SKU-12,\"Prov sin cerrar,10,PET,2026-09-01,F-12",
].join("\r\n");
const m = leerCsv(mixto, HOY);
const motivo = (fila: number) => (m.ok ? m.rechazadas.find((x) => x.fila === fila)?.motivo ?? "" : "");
check("mixto: 3 válidas (SKU-1, SKU-10, SKU-11) y el resto reportadas, nada se tira en silencio", m.ok && m.filas.map((f) => f.sku).join() === "SKU-1,SKU-10,SKU-11" && m.rechazadas.length === 9, m);
check("mixto: 1e3 → fila 3 con motivo", /1e3/.test(motivo(3)));
check("mixto: fecha inexistente → fila 4", /no es una fecha que exista/.test(motivo(4)));
check("mixto: 5 columnas → fila 5 con el conteo", /5 columnas/.test(motivo(5)));
check("mixto: la línea vacía (6) no cuenta como fila", !m.ok || !m.rechazadas.some((x) => x.fila === 6));
check("mixto: proveedor vacío → fila 7", /falta supplier/.test(motivo(7)));
check("mixto: SKU+proveedor repetido → fila 8 apunta a la fila 2", /ya aparece en la fila 2/.test(motivo(8)));
check("mixto: sku con espacio → fila 9", /sku/.test(motivo(9)));
check("mixto: proveedor tipo fórmula → fila 10", /no puede empezar/.test(motivo(10)));
check("mixto: NaN → fila 11", /NaN/.test(motivo(11)));
check("mixto: comillas dobles escapadas → Prov \"B\"", m.ok && m.filas.some((f) => f.supplier === 'Prov "B"'));
check("mixto: comilla sin cerrar → fila 14", /comilla/.test(motivo(14)));

const pyc = leerCsv(["sku;supplier;weight_g;material;packaging_revision_date;evidence_folio", "S-1;Prov A;12,5;PET;2026-09-01;F-1"].join("\n"), HOY);
check("separador punto y coma (Excel en español) con coma decimal sin comillas", pyc.ok && pyc.filas[0]?.weight_g === 12.5, pyc);
const bom = leerCsv("﻿" + CAB.toUpperCase().replace("SKU", " Sku ") + ",notas\nS-1,Prov A,1,PET,2026-09-01,F-1,algo", HOY);
check("BOM, cabecera en mayúsculas/espacios y columna extra (ignorada y reportada)", bom.ok && bom.filas.length === 1 && bom.columnasIgnoradas.join() === "notas", bom);
const falta = leerCsv("sku,supplier,weight_g,material,evidence_folio\nS-1,Prov A,1,PET,F-1", HOY);
check("falta columna obligatoria → archivo rechazado con su nombre", !falta.ok && /packaging_revision_date/.test(falta.error), falta);
check("columna repetida → rechazado", !leerCsv(CAB + ",sku\n", HOY).ok);
check("solo cabecera → rechazado", !leerCsv(CAB + "\n\n", HOY).ok);
check("vacío → rechazado", !leerCsv("", HOY).ok);
check("binario (NUL) → rechazado", !leerCsv("sku\u0000", HOY).ok);
const muchas = [CAB, ...Array.from({ length: FILAS_MAX + 1 }, (_, i) => `S-${i},Prov A,1,PET,2026-09-01,F-${i}`)].join("\n");
check(`más de ${FILAS_MAX} filas → rechazado`, !leerCsv(muchas, HOY).ok);
const todasMalas = leerCsv(`${CAB}\nS-1,Prov A,abc,PET,2026-09-01,F-1`, HOY);
check("todas las filas malas: ok con 0 válidas (la acción no guarda nada y lo dice)", todasMalas.ok && todasMalas.filas.length === 0 && todasMalas.rechazadas.length === 1, todasMalas);

console.log(`\n${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
