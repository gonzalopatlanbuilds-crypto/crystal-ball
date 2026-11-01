// Lector de IA con llamadas REALES a la API: N rondas de los escenarios
// sembrados. Imprime cada observación (para leerla a mano), lo que dijo la
// guardia y cuántos intentos tomó, y guarda todo en docs/pruebas/ para que
// scripts/comparar-lector.ts haga la comparación sin volver a pagar.
// Cuesta dinero: cada escenario es 1 o 2 llamadas.
//
// Uso: node scripts/probar-lector.ts 3
// Lee ANTHROPIC_API_KEY de .env.local; nunca la imprime.
import fs from "node:fs";
import { observarHallazgo, entradaLector, MODELO_LECTOR } from "../lib/lector-ia.ts";
import { revisarObservacion } from "../lib/guardia-lector.ts";
import { ESCENARIOS } from "./escenarios-lector.ts";

process.loadEnvFile(new URL("../.env.local", import.meta.url));
const rondas = Number(process.argv[2] ?? 1);
if (!Number.isInteger(rondas) || rondas < 1 || rondas > 5) {
  console.log("Uso: node scripts/probar-lector.ts <rondas 1-5>");
  process.exit(1);
}

// Si ya hay salidas de hoy, las rondas nuevas se agregan (no se vuelven a
// pagar las anteriores).
const destino = new URL(`../docs/pruebas/lector-ia-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url);
const previas = fs.existsSync(destino) ? (JSON.parse(fs.readFileSync(destino, "utf8")) as { rondas: number; resultados: unknown[] }) : { rondas: 0, resultados: [] };
const resultados: unknown[] = [...previas.resultados];
let mostradas = 0, descartadas = 0, errores = 0, violaciones = 0;
for (let r = previas.rondas + 1; r <= previas.rondas + rondas; r++) {
  for (const e of ESCENARIOS) {
    const res = await observarHallazgo(e.hallazgo);
    const fila: Record<string, unknown> = { ronda: r, escenario: e.id, causa: e.causa, estado: res.estado };
    console.log(`\n[ronda ${r}] ${e.id} — ${e.causa}`);
    if (res.estado === "ok") {
      mostradas++;
      // Segunda revisión independiente de lo que SÍ se mostraría.
      const recheck = revisarObservacion(res.observacion, entradaLector(e.hallazgo));
      if (recheck.length) violaciones++;
      Object.assign(fila, { observacion: res.observacion, intentos: res.intentos, rechazos: res.rechazos, nombra_causa: e.pista.test(res.observacion) });
      console.log(`  OK (intento ${res.intentos})${res.rechazos.length ? ` — rechazos previos: ${JSON.stringify(res.rechazos)}` : ""}`);
      console.log(`  «${res.observacion}»`);
      console.log(`  ¿nombra la causa sembrada? ${e.pista.test(res.observacion) ? "sí" : "no"}`);
    } else if (res.estado === "descartado") {
      descartadas++;
      Object.assign(fila, { problemas: res.problemas, salidas: res.salidas });
      console.log(`  DESCARTADO por la guardia: ${JSON.stringify(res.problemas)}`);
      for (const s of res.salidas) console.log(`  (no se mostró) «${String(s)}»`);
    } else {
      errores++;
      fila.motivo = res.motivo;
      console.log(`  ERROR: ${res.motivo}`);
    }
    resultados.push(fila);
  }
}

fs.writeFileSync(destino, JSON.stringify({ modelo: MODELO_LECTOR, rondas: previas.rondas + rondas, resultados }, null, 2) + "\n");
console.log(`\n${rondas} rondas nuevas (${previas.rondas + rondas} en total) ×${ESCENARIOS.length} escenarios: ${mostradas} mostradas, ${descartadas} descartadas por la guardia, ${errores} errores.`);
console.log(`Observaciones mostradas que violan la guardia (debe ser 0): ${violaciones}`);
console.log(`Guardado en ${destino.pathname}`);
if (violaciones > 0 || errores > 0) process.exit(1);
