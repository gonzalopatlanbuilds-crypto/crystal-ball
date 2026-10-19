// Condición 4: ¿la IA encuentra algo que la revisión simple por reglas no?
// Mismo conjunto con errores sembrados para ambos. Llamadas REALES (cuesta
// dinero). Lee ANTHROPIC_API_KEY de .env.local sin imprimirla.
// Uso: node scripts/comparar-auditor.ts [rondas=3]

import fs from "node:fs";
import { auditarSupuestos } from "../lib/auditor.ts";
import { chequeoPorReglas } from "../lib/chequeo-reglas.ts";
import { SEMBRADO_CON_ERRORES } from "./escenarios-auditor.ts";

for (const linea of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = linea.match(/^ANTHROPIC_API_KEY=\s*"?([^"\s]*)"?\s*$/);
  if (m) process.env.ANTHROPIC_API_KEY = m[1];
}

const { supuestos, esperado } = SEMBRADO_CON_ERRORES;
const claves = Object.keys(esperado);

const reglas = new Set(chequeoPorReglas(supuestos).map((h) => h.clave));
console.log("Revisión por reglas encontró:", [...reglas].join(", "));

const rondas = Number(process.argv[2] ?? 3);
const conteoIA: Record<string, number> = Object.fromEntries(claves.map((k) => [k, 0]));
let falsosIA = 0, rondasOk = 0;
for (let r = 1; r <= rondas; r++) {
  const res = await auditarSupuestos(supuestos);
  if (res.estado !== "ok") {
    console.log(`Ronda ${r}: ${res.estado}`, res.estado === "error" ? res.motivo : "");
    continue;
  }
  rondasOk++;
  const vistas = new Set(res.observaciones.map((o) => o.clave));
  for (const k of claves) if (vistas.has(k)) conteoIA[k]++;
  falsosIA += [...vistas].filter((k) => !claves.includes(k) && k !== "general").length;
  console.log(`\nRonda ${r}:`);
  for (const o of res.observaciones) console.log(`  [${o.clave}] ${o.texto}`);
}

console.log("\n| Error sembrado | Reglas | IA (rondas que lo señaló) |");
console.log("|---|---|---|");
for (const k of claves) console.log(`| ${k}: ${esperado[k]} | ${reglas.has(k) ? "sí" : "no"} | ${conteoIA[k]}/${rondasOk} |`);
const soloIA = claves.filter((k) => !reglas.has(k) && conteoIA[k] > 0);
console.log(`\nLa IA encontró algo que las reglas no: ${soloIA.length > 0 ? soloIA.join(", ") : "NADA"}`);
console.log(`Señalamientos de la IA sobre claves sin error sembrado: ${falsosIA}`);
