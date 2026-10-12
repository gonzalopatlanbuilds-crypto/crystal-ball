// Guardia server-side de las observaciones preparadas por IA (Condición 3:
// la IA nunca decide). Sin imports para probarla con `node` contra textos
// escritos a mano (scripts/probar-logica.ts) y contra salidas reales de
// Haiku (scripts/probar-observaciones.ts).
//
// Si una sola observación falla, se rechaza el lote entero y se vuelve a
// pedir (ver lib/observaciones.ts): no se "limpia" texto de la IA a mano.

import { DATOS } from "./caso.ts";

export const OBS_MIN = 2;
export const OBS_MAX = 4;
export const OBS_LARGO_MAX = 200;

// Minúsculas y sin acentos, para que "Califica" y "calificación" cuenten
// igual que "califica" y "calificacion".
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Cada observación describe lo que el texto hace o no hace. Empezar con uno
// de estos verbos obliga a que sea descriptiva y no un juicio ("Es una
// buena explicación").
const INICIOS = [
  "menciona", "explica", "describe", "cuantifica", "propone", "identifica",
  "compara", "relaciona", "senala", "incluye", "usa", "atribuye", "se refiere",
];

const PROHIBIDOS: { patron: RegExp; motivo: string }[] = [
  { patron: /\b(califica\w*|calificacion\w*|puntaje\w*|puntuacion\w*|puntua\w*|score|rating|estrellas?|nivel)\b/, motivo: "califica o puntúa" },
  { patron: /\b(aprob\w*|reprob\w*|rechaz\w*|apt[oa]s?|pass|fail|pasa la prueba|no pasa)\b/, motivo: "aprueba o rechaza" },
  { patron: /\b(excelente|sobresaliente|deficiente|insuficiente|mediocre|pobre|brillante|impecable|perfect[oa]|buen[oa]?s?|mal[oa]?s?|bien hecho|muy bien|destaca\w*|fuerte|debil)\b/, motivo: "hace un juicio de calidad" },
  // El chequeo de cálculos es del sistema, no de la IA.
  { patron: /\b(correct\w*|incorrect\w*|acert\w*|equivoc\w*|errone\w*|error(es)?)\b/, motivo: "juzga si algo está bien o mal" },
  { patron: /\b(contrat\w*|emple(o|os|ador|adores|abilidad|able|ables)|trabajo\w*|puesto\w*|vacante\w*|entrevist\w*|reclut\w*|seleccion\w*|idone\w*|recomend\w*|recomiend\w*|salario\w*|sueldo\w*|candidat\w*)\b/, motivo: "usa lenguaje de contratación o empleo" },
];

// Las únicas cifras permitidas son las de la hoja de datos del caso (y el
// 90 de la fórmula de días de cobranza que ve el candidato). "T1"/"T2" son
// etiquetas, no cifras.
const CIFRAS_PERMITIDAS = new Set<number>([
  ...Object.values(DATOS).flatMap((fila) => [fila.t1, fila.t2]),
  90,
]);

export function cifrasEnTexto(texto: string): number[] {
  const sinTrimestres = texto.replace(/\bT[12]\b/gi, "");
  return [...sinTrimestres.matchAll(/\d[\d.,]*\d|\d/g)].map((m) => {
    const crudo = m[0];
    // "4,200,000" → 4200000; "22.5" → 22.5; "4.2" → 4.2.
    const sinMiles = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(crudo) ? crudo.replace(/,/g, "") : crudo.replace(",", ".");
    return Number(sinMiles);
  });
}

// Devuelve la lista de problemas; vacía = el lote pasa.
export function revisarObservaciones(observaciones: unknown): string[] {
  if (!Array.isArray(observaciones)) return ["no es una lista"];
  if (observaciones.length < OBS_MIN || observaciones.length > OBS_MAX) {
    return [`trae ${observaciones.length} observaciones (deben ser ${OBS_MIN} a ${OBS_MAX})`];
  }

  const problemas: string[] = [];
  observaciones.forEach((obs, i) => {
    const n = `#${i + 1}`;
    if (typeof obs !== "string") {
      problemas.push(`${n}: no es texto`);
      return;
    }
    const texto = obs.trim();
    if (texto.length < 10 || texto.length > OBS_LARGO_MAX) {
      problemas.push(`${n}: largo ${texto.length} fuera de 10–${OBS_LARGO_MAX}`);
    }
    const norm = normalizar(texto);
    const sinNo = norm.replace(/^no\s+/, "");
    if (!INICIOS.some((v) => sinNo.startsWith(v + " ") || sinNo.startsWith(v + ","))) {
      problemas.push(`${n}: no empieza con un verbo descriptivo ("Menciona…", "No cuantifica…")`);
    }
    for (const { patron, motivo } of PROHIBIDOS) {
      const m = norm.match(patron);
      if (m) problemas.push(`${n}: ${motivo} ("${m[0]}")`);
    }
    const ajenas = cifrasEnTexto(texto).filter((c) => !CIFRAS_PERMITIDAS.has(c));
    if (ajenas.length > 0) {
      problemas.push(`${n}: usa cifras que no están en el caso (${ajenas.join(", ")})`);
    }
  });
  return problemas;
}
