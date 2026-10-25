// Prueba mecánica de la lógica pura (sin base de datos).
// Uso: npm run test:logica
import { crearOrgSchema, normalizarJoinCode, unirseOrgSchema } from "../lib/orgs.ts";
import { COLUMNAS, FILAS_MAX, hoyMexico, leerCsv, leerFecha, leerNumero, TAMANO_MAX_BYTES, validarArchivo } from "../lib/csv.ts";
import { CSV_EJEMPLO } from "../lib/ejemplo.ts";
import type { FilaEvidencia } from "../lib/csv.ts";
import {
  describirHallazgo,
  detectarHallazgos,
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  reconstruir,
  type HallazgoGuardado,
  type HallazgoNuevo,
  type VersionHistorial,
} from "../lib/validador.ts";
import { decisionSchema, diferenciaPorcentual, ETIQUETA_DECISION, HISTORIAL_DECISION, NOTA_MAX, SIGNIFICADO_DECISION } from "../lib/decisiones.ts";

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

// ---------- Feature 3: motor de hallazgos ----------
if (!ej.ok) throw new Error("el ejemplo debe leerse");
const BASE = ej.filas;
const ver = (id: string, seq: number, uploaded_at: string, raw_rows: FilaEvidencia[], identical_to_previous = false): VersionHistorial =>
  ({ id, seq, uploaded_at, uploaded_by: "user-a", source_filename: `${id}.csv`, identical_to_previous, raw_rows });
const cambiar = (filas: FilaEvidencia[], sku: string, prov: string, cambio: Partial<FilaEvidencia>) =>
  filas.map((f) => (f.sku === sku && f.supplier.includes(prov) ? { ...f, ...cambio } : f));
const carga = (filas: FilaEvidencia[], nombre = "nueva.csv") => ({ source_filename: nombre, filas });
const V1 = ver("v1", 1, "2026-10-02T16:00:00Z", BASE);
const tipos = (hs: HallazgoNuevo[]) => hs.map((h) => `${h.type}:${h.sku}:${h.supplier}`).sort();

let hs = detectarHallazgos([], [], carga(BASE, "primera.csv"));
check("primera carga (sin historial): 0 hallazgos", hs.length === 0, hs);
hs = detectarHallazgos([V1], [], carga(BASE));
check("recarga idéntica: 0 hallazgos", hs.length === 0, hs);
hs = detectarHallazgos([V1], [], carga([...BASE].reverse().map((f, i) => ({ ...f, fila: i + 2 }))));
check("mismas filas en otro orden y otras filas: 0 hallazgos", hs.length === 0, hs);

// missing_supplier
hs = detectarHallazgos([V1], [], carga(BASE.filter((f) => !(f.sku === "SIM-4821" && f.supplier.includes("Alfa")))));
check("missing_supplier: falta SIM-4821 de Alfa → exactamente ese hallazgo", tipos(hs).join() === "missing_supplier:SIM-4821:Proveedor Simulado Alfa", hs);
const dm = hs[0]?.details as { ultima_aceptada: { version_id: string; fila: number; archivo: string } };
check("missing_supplier: procedencia de la última aceptada (v1, archivo y fila)", dm?.ultima_aceptada.version_id === "v1" && dm.ultima_aceptada.archivo === "v1.csv" && dm.ultima_aceptada.fila === 6, dm);
hs = detectarHallazgos([V1], [], carga(BASE.filter((f) => f.supplier.includes("Beta"))));
check("missing_supplier: un archivo solo de Beta no juzga a Alfa (0 hallazgos)", hs.length === 0, hs);
hs = detectarHallazgos([V1], [], carga(BASE.filter((f) => f.supplier.includes("Beta") && f.sku !== "SIM-6018")));
check("missing_supplier: archivo de Beta sin SIM-6018 → solo ese", tipos(hs).join() === "missing_supplier:SIM-6018:Proveedor Simulado Beta", hs);

// value_conflict
const pesoNuevo = cambiar(BASE, "SIM-1190", "Alfa", { weight_g: 24.5 });
hs = detectarHallazgos([V1], [], carga(pesoNuevo));
check("value_conflict: peso 18.2 → 24.5 de SIM-1190/Alfa → exactamente ese hallazgo", tipos(hs).join() === "value_conflict:SIM-1190:Proveedor Simulado Alfa", hs);
const dc = hs[0]?.details as { cambios: { campo: string; anterior: number; nuevo: number }[]; anterior: { version_id: string; fila: number }; nueva: { archivo: string; fila: number } };
check("value_conflict: muestra los dos valores", dc?.cambios.length === 1 && dc.cambios[0].campo === "weight_g" && dc.cambios[0].anterior === 18.2 && dc.cambios[0].nuevo === 24.5, dc);
check("value_conflict: y las dos procedencias (v1 fila 2 / nueva.csv fila 2)", dc?.anterior.version_id === "v1" && dc.anterior.fila === 2 && dc.nueva.archivo === "nueva.csv" && dc.nueva.fila === 2, dc);
hs = detectarHallazgos([V1], [], carga(cambiar(BASE, "SIM-1190", "Alfa", { material: "  pet " })));
check("value_conflict: PET vs pet con espacios (mayúsculas/espacios) no es conflicto", hs.length === 0, hs);
hs = detectarHallazgos([V1], [], carga(cambiar(BASE, "SIM-1190", "Alfa", { material: "PEAD", weight_g: 20 })));
check("value_conflict: peso y material cambian → 1 hallazgo con 2 cambios", hs.length === 1 && (hs[0].details as { cambios: unknown[] }).cambios.length === 2, hs);
hs = detectarHallazgos([V1], [], carga(cambiar(BASE, "SIM-1190", "Beta", { weight_g: 24.5 })));
check("value_conflict: el cambio en Beta no toca a Alfa (mismo SKU)", tipos(hs).join() === "value_conflict:SIM-1190:Proveedor Simulado Beta", hs);
check("value_conflict: ningún hallazgo trae estado (nace pendiente en la base)", hs.every((h) => !("status" in h)), hs);

// late_revision
hs = detectarHallazgos([V1], [], carga(cambiar(BASE, "SIM-7733", "Beta", { packaging_revision_date: "2026-10-09" })));
check("late_revision: revisión 9-oct después de la evidencia aceptada (2-oct) → ese hallazgo", tipos(hs).join() === "late_revision:SIM-7733:Proveedor Simulado Beta", hs);
const dl = hs[0]?.details as { fecha_revision: string; fecha_evidencia_aceptada: string };
check("late_revision: guarda las dos fechas", dl?.fecha_revision === "2026-10-09" && dl.fecha_evidencia_aceptada === "2026-10-02", dl);
hs = detectarHallazgos([V1], [], carga(cambiar(BASE, "SIM-7733", "Beta", { packaging_revision_date: "2026-10-02" })));
check("late_revision: revisión el MISMO día de la evidencia → no", hs.length === 0, hs);
const V1noche = ver("v1", 1, "2026-10-03T03:00:00Z", BASE); // 2-oct 21:00 en CDMX
hs = detectarHallazgos([V1noche], [], carga(cambiar(BASE, "SIM-7733", "Beta", { packaging_revision_date: "2026-10-03" })));
check("late_revision: compara contra la fecha en CDMX (3-oct 03:00 UTC = 2-oct) → 3-oct sí es posterior", tipos(hs).join() === "late_revision:SIM-7733:Proveedor Simulado Beta", hs);
hs = detectarHallazgos([V1], [], carga([...BASE, { ...BASE[0], sku: "SIM-NUEVO", evidence_folio: "FOL-SIM-0999", packaging_revision_date: "2026-10-20" }]));
check("late_revision: un SKU nuevo (sin evidencia aceptada) no es revisión tardía", hs.length === 0, hs);

// possible_duplicate
hs = detectarHallazgos([V1], [], carga(cambiar(BASE, "SIM-2034", "Alfa", { evidence_folio: "FOL-SIM-0001" })));
check("possible_duplicate: SIM-2034 reutiliza el folio de SIM-1190/Alfa (v1) → hallazgo", tipos(hs).includes("possible_duplicate:SIM-2034:Proveedor Simulado Alfa"), hs);
const dd = hs.find((h) => h.sku === "SIM-2034")?.details as { otros_usos: { version_id: string; sku: string }[] };
check("possible_duplicate: dice dónde más se usó (v1, SIM-1190)", dd?.otros_usos.some((u) => u.version_id === "v1" && u.sku === "SIM-1190"), dd);
check("possible_duplicate: en la misma carga, SIM-1190/Alfa con FOL-SIM-0001 también queda marcado", tipos(hs).includes("possible_duplicate:SIM-1190:Proveedor Simulado Alfa"), hs);
hs = detectarHallazgos([V1], [], carga(cambiar(BASE, "SIM-1190", "Alfa", { weight_g: 24.5 })));
check("possible_duplicate: mismo SKU + proveedor + folio reenviado NO es duplicado", !hs.some((h) => h.type === "possible_duplicate"), hs);
hs = detectarHallazgos([V1], [], carga(cambiar(BASE, "SIM-1190", "Alfa", { evidence_folio: "fol-sim-0006" })));
check("possible_duplicate: folio en minúsculas igual se detecta (FOL-SIM-0006 era de SIM-4821/Beta)", tipos(hs).includes("possible_duplicate:SIM-1190:Proveedor Simulado Alfa"), hs);
hs = detectarHallazgos([], [], carga([BASE[0], { ...BASE[2], evidence_folio: BASE[0].evidence_folio }]));
check("possible_duplicate: dos filas de la PRIMERA carga con el mismo folio → las dos marcadas", hs.length === 2 && hs.every((h) => h.type === "possible_duplicate"), hs);

// Deduplicación y "no se crea dos veces"
const guardado = (h: HallazgoNuevo, status: HallazgoGuardado["status"] = "pending"): HallazgoGuardado => ({ fingerprint: h.fingerprint, status });
const conflicto = detectarHallazgos([V1], [], carga(pesoNuevo))[0];
const V2 = ver("v2", 2, "2026-10-09T16:00:00Z", pesoNuevo);
const otroCambio = cambiar(pesoNuevo, "SIM-6018", "Beta", { weight_g: 60 });
hs = detectarHallazgos([V1, V2], [guardado(conflicto)], carga(otroCambio));
check("dedup: v3 con el mismo conflicto pendiente + otro cambio → solo el hallazgo nuevo (SIM-6018)", tipos(hs).join() === "value_conflict:SIM-6018:Proveedor Simulado Beta", hs);
hs = detectarHallazgos([V1, V2], [guardado(conflicto)], carga(pesoNuevo));
check("dedup: recargar v2 (idéntica a la última) → 0", hs.length === 0, hs);

// Aceptación: descartado = se acepta el valor nuevo; confirmado/pendiente = no.
let ac = reconstruir([V1, V2], [guardado(conflicto, "pending")]).aceptadas.get("sim-1190|proveedor simulado alfa");
check("aceptada con el conflicto PENDIENTE: sigue siendo 18.2 de v1", ac?.weight_g === 18.2 && ac.procedencia.version_id === "v1", ac);
ac = reconstruir([V1, V2], [guardado(conflicto, "confirmed")]).aceptadas.get("sim-1190|proveedor simulado alfa");
check("aceptada con el conflicto CONFIRMADO: sigue siendo 18.2 de v1", ac?.weight_g === 18.2 && ac.procedencia.version_id === "v1", ac);
ac = reconstruir([V1, V2], [guardado(conflicto, "discarded")]).aceptadas.get("sim-1190|proveedor simulado alfa");
check("aceptada con el conflicto DESCARTADO: pasa a 24.5 de v2", ac?.weight_g === 24.5 && ac.procedencia.version_id === "v2", ac);
ac = reconstruir([V1, V2], []).aceptadas.get("sim-1190|proveedor simulado alfa");
check("aceptada si el hallazgo nunca se guardó: no se acepta lo que nadie revisó (18.2)", ac?.weight_g === 18.2, ac);
hs = detectarHallazgos([V1, V2], [guardado(conflicto, "discarded")], carga(cambiar(BASE, "SIM-1190", "Alfa", { weight_g: 30 })));
check("tras descartar: el siguiente cambio (30 g) se compara contra 24.5 (la aceptada)", (hs[0]?.details as { cambios: { anterior: number }[] })?.cambios[0].anterior === 24.5, hs);
hs = detectarHallazgos([V1, V2], [guardado(conflicto, "confirmed")], carga(cambiar(BASE, "SIM-1190", "Alfa", { weight_g: 30 })));
check("tras confirmar: el siguiente cambio (30 g) se compara contra 18.2 (la referencia sigue siendo v1)", (hs[0]?.details as { cambios: { anterior: number }[] })?.cambios[0].anterior === 18.2, hs);
const V3identica = ver("v3", 3, "2026-10-10T16:00:00Z", pesoNuevo, true);
ac = reconstruir([V1, V2, V3identica], [guardado(conflicto)]).aceptadas.get("sim-1190|proveedor simulado alfa");
check("una versión idéntica a la anterior NO vuelve aceptado un valor pendiente (sigue 18.2)", ac?.weight_g === 18.2, ac);
// Recargar el mismo archivo después no "renueva" la fecha de la evidencia
// aceptada: si no, una revisión del 9-oct dejaría de ser tardía solo porque
// alguien volvió a subir el archivo del 2-oct el 20-oct.
const V2identicaTarde = ver("v2", 2, "2026-10-20T16:00:00Z", BASE, true);
hs = detectarHallazgos([V1, V2identicaTarde], [], carga(cambiar(BASE, "SIM-7733", "Beta", { packaging_revision_date: "2026-10-09" })));
check("recarga idéntica posterior no renueva la fecha aceptada: revisión 9-oct sigue siendo tardía (vs 2-oct)", tipos(hs).join() === "late_revision:SIM-7733:Proveedor Simulado Beta", hs);
ac = reconstruir([V1, V2identicaTarde], []).aceptadas.get("sim-7733|proveedor simulado beta");
check("…y la procedencia aceptada sigue siendo la versión original (v1), no la recarga", ac?.procedencia.version_id === "v1", ac);
const faltante = detectarHallazgos([V1], [], carga(BASE.filter((f) => f.sku !== "SIM-6018")))[0];
const V2sin = ver("v2", 2, "2026-10-09T16:00:00Z", BASE.filter((f) => f.sku !== "SIM-6018"));
const V3con = ver("v3", 3, "2026-10-10T16:00:00Z", BASE);
hs = detectarHallazgos([V1, V2sin, V3con], [guardado(faltante)], carga(BASE.filter((f) => f.sku !== "SIM-6018")));
check("missing_supplier: el SKU volvió (v3) y vuelve a faltar → hallazgo nuevo (otra huella)", hs.length === 1 && hs[0].type === "missing_supplier" && hs[0].fingerprint !== faltante.fingerprint, [hs, faltante.fingerprint]);

// Determinismo
const cargaDet = () => carga(cambiar(otroCambio, "SIM-2034", "Alfa", { evidence_folio: "FOL-SIM-0009", packaging_revision_date: "2026-10-20" }));
const r1 = JSON.stringify(detectarHallazgos([V2, V1], [guardado(conflicto, "discarded")], cargaDet()));
const r2 = JSON.stringify(detectarHallazgos([V2, V1], [guardado(conflicto, "discarded")], cargaDet()));
const r3 = JSON.stringify(detectarHallazgos([V1, V2], [guardado(conflicto, "discarded")], cargaDet()));
check("determinista: misma entrada → misma salida, y el orden del historial no importa", r1 === r2 && r1 === r3 && JSON.parse(r1).length >= 3, JSON.parse(r1));

// Textos: "verificado" nunca junto a una afirmación positiva
const textos = [
  ...Object.values(ETIQUETA_TIPO),
  ...Object.values(ETIQUETA_ESTADO),
  ...JSON.parse(r1).map((h: HallazgoNuevo) => describirHallazgo(h)),
  ...detectarHallazgos([V1], [], carga(BASE.filter((f) => f.sku !== "SIM-6018"))).map(describirHallazgo),
];
check("textos: ninguno dice verificado/a salvo 'sin verificar'", textos.every((t) => !/verificad[oa]/i.test(t.replace(/sin verificar/gi, ""))), textos);
check("textos: ninguno afirma cumplimiento, reciclaje o recuperación", textos.every((t) => !/cumple|recicl|recupera|aprobad/i.test(t)), textos);
check("textos: la etiqueta del duplicado es exactamente 'Posible duplicado, sin verificar'", ETIQUETA_TIPO.possible_duplicate === "Posible duplicado, sin verificar");
const V3misma = ver("v3", 3, "2026-10-12T16:00:00Z", BASE);
const dupVarias = detectarHallazgos([V1, V2, V3misma], [], carga(cambiar(BASE, "SIM-2034", "Alfa", { evidence_folio: "FOL-SIM-0001" }))).find((h) => h.sku === "SIM-2034");
check("describir duplicado: el folio usado por SIM-1190/Alfa en 3 versiones se nombra UNA vez (pares distintos)",
  !!dupVarias && describirHallazgo(dupVarias) === "Folio FOL-SIM-0001 también citado para SIM-1190 (Proveedor Simulado Alfa)", dupVarias && describirHallazgo(dupVarias));
check("describir value_conflict: 'Peso declarado: 18.2 g (anterior) vs 24.5 g (nuevo)'", describirHallazgo(conflicto) === "Peso declarado: 18.2 g (anterior) vs 24.5 g (nuevo)", describirHallazgo(conflicto));

// ---------- Feature 4: decisiones ----------
const UUID = "11111111-2222-3333-4444-555555555555";
const dec = (cambio: Record<string, unknown>) => decisionSchema.safeParse({ findingId: UUID, decision: "confirmed", note: "Nota real.", ...cambio });
check("decisión con nota → válida (y la nota se recorta)", dec({ note: "  Nota real.  " }).success && dec({ note: "  Nota real.  " }).data?.note === "Nota real.");
for (const [nombre, nota] of [["vacía", ""], ["solo espacios", "    "], ["solo saltos de línea y tabs", "\n\t \r\n"], ["ausente", undefined]] as const) {
  const r = dec({ note: nota });
  check(`decisión con nota ${nombre} → rechazada con "La nota es obligatoria"`, !r.success && /nota es obligatoria/i.test(r.error.issues[0].message), r);
}
check(`nota de ${NOTA_MAX} caracteres → válida`, dec({ note: "x".repeat(NOTA_MAX) }).success);
check(`nota de ${NOTA_MAX + 1} caracteres → rechazada`, !dec({ note: "x".repeat(NOTA_MAX + 1) }).success);
check("decisión 'resuelto' → rechazada", !dec({ decision: "resuelto" }).success);
check("findingId que no es uuid → rechazado", !dec({ findingId: "1 or 1=1" }).success);
check("diferencia 18.2 → 24.5 = +34.6% (como el mockup)", diferenciaPorcentual(18.2, 24.5) === "+34.6%", diferenciaPorcentual(18.2, 24.5));
check("diferencia 55 → 50 = -9.1%", diferenciaPorcentual(55, 50) === "-9.1%", diferenciaPorcentual(55, 50));
check("diferencia sin cambio = 0.0%", diferenciaPorcentual(10, 10) === "0.0%", diferenciaPorcentual(10, 10));
check("diferencia con anterior 0 → no se calcula (null)", diferenciaPorcentual(0, 5) === null);
const textosDecision = [...Object.values(ETIQUETA_DECISION), ...Object.values(SIGNIFICADO_DECISION), ...Object.values(HISTORIAL_DECISION)];
check("textos de decisión: ninguno dice verificado ni afirma cumplimiento/reciclaje", textosDecision.every((t) => !/verificad|cumple|recicl|recupera|aprobad/i.test(t)), textosDecision);

console.log(`\n${ok} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
