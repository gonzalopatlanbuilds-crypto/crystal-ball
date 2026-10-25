// IA vs. chequeo por reglas sobre los escenarios sembrados, a partir de
// las salidas que guardó scripts/probar-lector.ts (no vuelve a llamar a la
// API). Para cada causa sembrada: ¿la regla del UMBRAL_PCT la marca? ¿la
// observación de la IA la nombra (en cuántas rondas)?
//
// Uso: node scripts/comparar-lector.ts docs/pruebas/lector-ia-AAAA-MM-DD.json
import fs from "node:fs";
import { chequeoPorReglas, UMBRAL_PCT } from "../lib/chequeo-reglas.ts";
import { ESCENARIOS } from "./escenarios-lector.ts";

const archivo = process.argv[2];
if (!archivo) {
  console.log("Uso: node scripts/comparar-lector.ts <salida de probar-lector.json>");
  process.exit(1);
}
const { rondas, resultados } = JSON.parse(fs.readFileSync(archivo, "utf8")) as {
  rondas: number;
  resultados: { escenario: string; estado: string; nombra_causa?: boolean }[];
};

console.log(`Regla: marcar un conflicto de peso que cambie más de ${UMBRAL_PCT}%. IA: ¿su observación nombra la causa sembrada?\n`);
console.log("escenario        | regla      | IA (rondas que nombran la causa / mostradas / total)");
let reglaAciertos = 0, iaMayoria = 0;
for (const e of ESCENARIOS) {
  const regla = chequeoPorReglas(e.hallazgo);
  const suyos = resultados.filter((x) => x.escenario === e.id);
  const mostradas = suyos.filter((x) => x.estado === "ok");
  const nombra = mostradas.filter((x) => x.nombra_causa).length;
  // La regla "acierta" si marca; no tiene forma de explicar la causa.
  if (regla.marcado) reglaAciertos++;
  if (nombra * 2 > rondas) iaMayoria++;
  console.log(`${e.id.padEnd(16)} | ${(regla.marcado ? "marca" : "no marca").padEnd(10)} | ${nombra}/${mostradas.length}/${suyos.length}   (${e.causa})`);
}
console.log(`\nLa regla marca ${reglaAciertos} de ${ESCENARIOS.length} escenarios (y no explica ninguno).`);
console.log(`La IA nombra la causa en la mayoría de las rondas en ${iaMayoria} de ${ESCENARIOS.length}.`);
