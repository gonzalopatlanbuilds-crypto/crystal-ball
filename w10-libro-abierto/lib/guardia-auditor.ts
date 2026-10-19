// Guardia server-side de las observaciones del auditor de IA. Sin imports de
// runtime para probarla con `node` directo (test:logica) y contra salidas
// reales (scripts/probar-auditor.ts).
//
// La IA nunca calcula ni decide la viabilidad. Si UNA observación falla, se
// rechaza el lote entero y se vuelve a pedir (lib/auditor.ts); no se
// "limpia" texto de la IA a mano. La etiqueta "sin validar" la pone la
// página, nunca el modelo.

export const AUDITOR_MAX = 6;
export const AUDITOR_LARGO_MIN = 10;
export const AUDITOR_LARGO_MAX = 220;

export interface ObservacionIA {
  clave: string;
  texto: string;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Palabras de veredicto: la viabilidad la decide la compuerta (servidor +
// base), nunca la IA. Se rechaza también "viabilidad": la IA no opina
// sobre ella, ni para bien ni para mal.
const VEREDICTO =
  /\b(viab\w*|inviab\w*|rentab\w*|recomend\w*|recomiend\w*|garantiz\w*|aconsej\w*|sostenible\w*|insostenible\w*|exitos\w*|fracas\w*|conviene\w*|deberia\w*|debe\w* (publicar|invertir|aceptar))\b/;

// Lenguaje de alianzas, patrocinio o referidos (Condición 5).
const ALIANZA =
  /\b(alianza\w*|aliad\w*|soci[oa]s?|socio comercial|patrocin\w*|sponsor\w*|partner\w*|convenio\w*|acuerdo comercial|colaboracion comercial|comision\w*|commission\w*|afiliad\w*|affiliat\w*|referid\w*|referral\w*)\b/;

// Números escritos con palabras: se saltarían la regla de cifras (lección
// de w09: "diez por ciento").
const CIFRA_EN_PALABRAS =
  /\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|cientos|\w+cientos|mil|miles|millon\w*|por ciento|doble|triple|mitad)\b/;

// Todos los números de un texto: "2,000" → 2000, "3%" → 3, "49.5" → 49.5,
// "2026-09-01" → 2026, 9, 1.
export function numerosEnTexto(texto: string): number[] {
  return [...texto.matchAll(/\d[\d,.]*\d|\d/g)].map((m) => {
    const crudo = m[0];
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(crudo)) return Number(crudo.replace(/,/g, ""));
    if (/^\d+,\d+$/.test(crudo)) return Number(crudo.replace(",", "."));
    return Number(crudo.replace(/,/g, ""));
  });
}

export function revisarObservacionesIA(
  salida: unknown,
  entradaTexto: string,
  clavesPermitidas: readonly string[]
): string[] {
  if (!Array.isArray(salida)) return ["no es una lista"];
  if (salida.length > AUDITOR_MAX) return [`trae ${salida.length} observaciones (máximo ${AUDITOR_MAX})`];

  // Las únicas cifras permitidas son las que ya estaban en la entrada: la IA
  // no calcula, solo señala.
  const permitidas = new Set(numerosEnTexto(entradaTexto));
  const claves = new Set([...clavesPermitidas, "general"]);
  const problemas: string[] = [];

  salida.forEach((obs, i) => {
    const n = `#${i + 1}`;
    if (typeof obs !== "object" || obs === null) {
      problemas.push(`${n}: no es un objeto`);
      return;
    }
    const { clave, texto } = obs as Record<string, unknown>;
    if (typeof clave !== "string" || !claves.has(clave)) problemas.push(`${n}: clave desconocida (${String(clave)})`);
    if (typeof texto !== "string") {
      problemas.push(`${n}: texto no es texto`);
      return;
    }
    const t = texto.trim();
    if (t.length < AUDITOR_LARGO_MIN || t.length > AUDITOR_LARGO_MAX) {
      problemas.push(`${n}: largo ${t.length} fuera de ${AUDITOR_LARGO_MIN}–${AUDITOR_LARGO_MAX}`);
    }
    const norm = normalizar(t);
    const v = norm.match(VEREDICTO);
    if (v) problemas.push(`${n}: palabra de veredicto ("${v[0]}")`);
    const a = norm.match(ALIANZA);
    if (a) problemas.push(`${n}: lenguaje de alianza o referidos ("${a[0]}")`);
    const p = norm.match(CIFRA_EN_PALABRAS);
    if (p) problemas.push(`${n}: cifra escrita con palabras ("${p[0]}")`);
    const nuevas = numerosEnTexto(t).filter((x) => !permitidas.has(x));
    if (nuevas.length > 0) problemas.push(`${n}: cifra que no está en la entrada (${nuevas.join(", ")})`);
  });

  return problemas;
}
