// Prueba del auditor con llamadas REALES a la API (cuesta dinero). Lee
// ANTHROPIC_API_KEY de .env.local sin imprimirla.
// Uso: node scripts/probar-auditor.ts [rondas=3]
//
// Imprime cada salida completa para leerla a mano: la guardia es una red,
// no un sustituto de leer lo que dice la IA.

import fs from "node:fs";
import { auditarSupuestos, entradaAuditor } from "../lib/auditor.ts";
import { revisarObservacionesIA } from "../lib/guardia-auditor.ts";
import { ESCENARIOS } from "./escenarios-auditor.ts";
import { CLAVES } from "../lib/supuestos.ts";

for (const linea of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = linea.match(/^ANTHROPIC_API_KEY=\s*"?([^"\s]*)"?\s*$/);
  if (m) process.env.ANTHROPIC_API_KEY = m[1];
}

const rondas = Number(process.argv[2] ?? 3);
let ok = 0, descartadas = 0, errores = 0, segundoIntento = 0;

for (let r = 1; r <= rondas; r++) {
  console.log(`\n================ RONDA ${r} ================`);
  for (const [nombre, supuestos] of ESCENARIOS) {
    const res = await auditarSupuestos(supuestos);
    console.log(`\n--- ${nombre} → ${res.estado}${res.estado === "ok" ? ` (intento ${res.intentos})` : ""}`);
    if (res.estado === "ok") {
      ok++;
      if (res.intentos > 1) {
        segundoIntento++;
        console.log(`  (intento 1 rechazado: ${res.rechazos[0]?.join(" | ")})`);
      }
      // Doble chequeo: lo que se mostraría vuelve a pasar la guardia.
      if (revisarObservacionesIA(res.observaciones, entradaAuditor(supuestos), CLAVES).length) {
        console.log("  !!! no pasa la guardia al re-chequear");
      }
      if (res.observaciones.length === 0) console.log("  (sin observaciones)");
      for (const o of res.observaciones) console.log(`  [${o.clave}] ${o.texto}`);
    } else if (res.estado === "descartado") {
      descartadas++;
      res.salidas.forEach((s, i) => console.log(`  salida ${i + 1}: ${JSON.stringify(s)}\n  problemas: ${res.problemas[i]?.join(" | ")}`));
    } else {
      errores++;
      console.log(`  error: ${res.motivo}`);
    }
  }
}

console.log(`\nTotal: ${ok} aceptadas (${segundoIntento} al segundo intento), ${descartadas} descartadas por la guardia, ${errores} errores, de ${rondas * ESCENARIOS.length}.`);
