// Genera los CSV de la prueba en el navegador (docs/pruebas/) a partir del
// ejemplo simulado, y muestra qué hallazgos debe producir cada uno contra
// el historial actual de la org de prueba (reconstruido a mano abajo).
// Uso: node scripts/generar-pruebas.ts
import fs from "node:fs";
import { COLUMNAS, leerCsv, type FilaEvidencia } from "../lib/csv.ts";
import { CSV_EJEMPLO } from "../lib/ejemplo.ts";
import { describirHallazgo, detectarHallazgos, ETIQUETA_TIPO, type VersionHistorial } from "../lib/validador.ts";

const ej = leerCsv(CSV_EJEMPLO, "2026-10-25");
if (!ej.ok) throw new Error("ejemplo inválido");
const cambiar = (filas: FilaEvidencia[], sku: string, prov: string, cambio: Partial<FilaEvidencia>) =>
  filas.map((f) => (f.sku === sku && f.supplier.includes(prov) ? { ...f, ...cambio } : f));
const aCsv = (filas: FilaEvidencia[]) =>
  [COLUMNAS.join(","), ...filas.map((f) => COLUMNAS.map((c) => {
    const v = String(f[c]);
    return /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(","))].join("\n") + "\n";

let f1 = ej.filas.filter((f) => !(f.sku === "SIM-4821" && f.supplier.includes("Alfa")));
f1 = cambiar(f1, "SIM-1190", "Alfa", { weight_g: 24.5 });
f1 = cambiar(f1, "SIM-2034", "Alfa", { evidence_folio: "FOL-SIM-0001" });
const f3 = cambiar(f1, "SIM-6018", "Beta", { weight_g: 60 });

const dir = new URL("../docs/pruebas/", import.meta.url);
fs.mkdirSync(dir, { recursive: true });
const archivos: [string, FilaEvidencia[]][] = [
  ["f3-1-faltante-conflicto-duplicado.csv", f1],
  ["f3-3-un-cambio-mas.csv", f3],
];
for (const [nombre, filas] of archivos) {
  const texto = aCsv(filas);
  const releido = leerCsv(texto, "2026-10-25");
  if (!releido.ok || releido.rechazadas.length) throw new Error(`${nombre} no se relee limpio`);
  fs.writeFileSync(new URL(nombre, dir), texto);
}

// Historial real de la org de prueba (TPK-F9Z) al 25-oct: v1 ejemplo,
// v2 proveedor_octubre_malo.csv (1 fila válida), v3 ejemplo, v4 ejemplo
// (idéntica). Sin hallazgos guardados (se subieron antes del motor).
const malo = leerCsv("sku,supplier,weight_g,material,packaging_revision_date,evidence_folio\nSIM-1190,Proveedor Simulado Alfa,24.5,PET,2026-10-09,FOL-SIM-0101\n", "2026-10-25");
if (!malo.ok) throw new Error("malo");
const v = (seq: number, nombre: string, filas: FilaEvidencia[], identica = false): VersionHistorial =>
  ({ id: `v${seq}`, seq, uploaded_at: "2026-10-25T20:12:00Z", uploaded_by: "u", source_filename: nombre, identical_to_previous: identica, raw_rows: filas });
const historial = [v(1, "ejemplo-simulado.csv", ej.filas), v(2, "proveedor_octubre_malo.csv", malo.filas), v(3, "ejemplo-simulado.csv", ej.filas), v(4, "ejemplo-simulado.csv", ej.filas, true)];

const imprimir = (titulo: string, hs: ReturnType<typeof detectarHallazgos>) => {
  console.log(`\n${titulo}: ${hs.length} hallazgos nuevos`);
  for (const h of hs) console.log(`  - ${h.sku} (${h.supplier}) [${ETIQUETA_TIPO[h.type]}] ${describirHallazgo(h)}`);
};
const h1 = detectarHallazgos(historial, [], { source_filename: archivos[0][0], filas: f1 });
imprimir("Paso 1 (f3-1)", h1);
const guardados = h1.map((h) => ({ fingerprint: h.fingerprint, status: "pending" as const }));
const conV5 = [...historial, v(5, archivos[0][0], f1)];
imprimir("Paso 2 (f3-1 otra vez)", detectarHallazgos(conV5, guardados, { source_filename: archivos[0][0], filas: f1 }));
const conV6 = [...conV5, v(6, archivos[0][0], f1, true)];
imprimir("Paso 3 (f3-3)", detectarHallazgos(conV6, guardados, { source_filename: archivos[1][0], filas: f3 }));
