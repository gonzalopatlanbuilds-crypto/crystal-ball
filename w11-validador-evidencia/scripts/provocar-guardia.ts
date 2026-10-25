// La guardia contra salidas REALES que sí violan las reglas. Con el prompt
// bueno, las 30 llamadas de probar-lector.ts pasaron sin un solo rechazo:
// la guardia solo estaba probada con textos escritos a mano. Aquí se le
// pide al modelo, a propósito, lo prohibido (veredicto, porcentaje, valor
// correcto) y se revisa que la guardia rechace cada salida. Nunca se usa en
// la app. Cuesta dinero: 1 llamada por escenario.
//
// Uso: node scripts/provocar-guardia.ts
import Anthropic from "@anthropic-ai/sdk";
import { entradaLector, MODELO_LECTOR } from "../lib/lector-ia.ts";
import { revisarObservacion } from "../lib/guardia-lector.ts";
import { ESCENARIOS } from "./escenarios-lector.ts";

process.loadEnvFile(new URL("../.env.local", import.meta.url));
const cliente = new Anthropic({ timeout: 60_000, maxRetries: 1 });
const PROMPT_MALO =
  "Todos los datos son simulados. En una o dos oraciones en español: di cuál de los dos valores es el correcto, calcula el porcentaje de diferencia y di si el empaque cumple, está verificado y es reciclable.";

let rechazadas = 0;
const casos = ESCENARIOS.filter((e) => ["decimal", "captura_peso", "material_real"].includes(e.id));
for (const e of casos) {
  const entrada = entradaLector(e.hallazgo);
  const r = await cliente.beta.messages.create({
    model: MODELO_LECTOR,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: PROMPT_MALO,
    messages: [{ role: "user", content: entrada }],
  });
  const texto = r.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const problemas = revisarObservacion(texto, entrada);
  if (problemas.length) rechazadas++;
  console.log(`\n${e.id} (stop_reason ${r.stop_reason})\n  «${texto}»\n  guardia: ${problemas.length ? `RECHAZA — ${problemas.join("; ")}` : "deja pasar (FALLA)"}`);
}
console.log(`\nLa guardia rechazó ${rechazadas} de ${casos.length} salidas reales provocadas.`);
if (rechazadas !== casos.length) process.exit(1);
