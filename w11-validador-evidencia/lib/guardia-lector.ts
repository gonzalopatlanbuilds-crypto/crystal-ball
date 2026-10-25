// Guardia server-side de la observación del lector de IA. Sin imports de
// runtime para probarla con `node` directo (test:logica) y contra salidas
// reales (scripts/probar-lector.ts).
//
// La IA nunca decide un hallazgo, nunca calcula un valor y nunca afirma
// cumplimiento, reciclaje ni recuperación. Si la observación falla una
// sola regla, se rechaza completa y se vuelve a pedir (lib/lector-ia.ts);
// no se "limpia" texto de la IA a mano. La etiqueta "sin validar" la pone
// la página, nunca el modelo.

export const OBSERVACION_LARGO_MIN = 15;
export const OBSERVACION_LARGO_MAX = 320;

// Sin acentos y en minúsculas, para que "Verificó" y "verifico" caigan igual.
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Palabras de veredicto (las del packet y sus variantes): cumple,
// reciclado, recuperado, verificado, aprobado. Se rechaza la raíz completa:
// "cumplimiento", "reciclable", "verificar", "aprobación"... La IA no habla
// de eso ni para negarlo ("no se puede verificar" también se rechaza: más
// vale una observación de menos que una que suene a dictamen).
const VEREDICTO = /\b(cumpl\w*|incumpl\w*|recicl\w*|recuper\w*|verific\w*|aprob\w*|certific\w*|valid[ao]s?|validad\w*|conform\w*)\b/;

// La IA no resuelve el hallazgo ni elige cuál valor es el bueno. "valor
// respaldado/confiable" se agregó tras provocar al modelo real
// (scripts/provocar-guardia.ts): escribió "El valor respaldado es 24.5 g",
// otra forma de elegir un valor que la lista no tenía.
const RESOLUCION =
  /\b(resuelt\w*|resolv\w*|solucion\w*|descart\w*|confirm\w*|correct[oa]s?|incorrect[oa]s?|erroneo|erronea|verdader[oa]s?|falso|falsa|(el|un) (valor|dato|peso|material) (real|bueno|valido|respaldado|confiable|fiable|vigente)|es el (bueno|real|confiable)|hay que|se debe|debe(n|ria|rian)?|recomend\w*|recomiend\w*|sugier\w*|conviene)\b/;

// Números escritos con palabras: se saltarían la regla de cifras (w09).
// Sin "uno/una": son artículos ("una revisión") y rechazarían casi todo.
const CIFRA_EN_PALABRAS =
  /\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|cientos|\w+cientos|mil|miles|millon\w*|por ciento|doble|triple|mitad|decena\w*|docena\w*|centena\w*)\b/;

// Todos los números de un texto: "2,000" → 2000, "18,2" → 18.2, "34.6%" →
// 34.6, "2026-09-01" → 2026, 9, 1 (los ceros a la izquierda no importan).
export function numerosEnTexto(texto: string): number[] {
  return [...texto.matchAll(/\d[\d,.]*\d|\d/g)].map((m) => {
    const crudo = m[0];
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(crudo)) return Number(crudo.replace(/,/g, ""));
    if (/^\d+,\d+$/.test(crudo)) return Number(crudo.replace(",", "."));
    return Number(crudo.replace(/,/g, ""));
  });
}

// Devuelve la lista de problemas; vacía = la observación se puede mostrar.
export function revisarObservacion(salida: unknown, entradaTexto: string): string[] {
  if (typeof salida !== "string") return ["la observación no es texto"];
  const t = salida.trim();
  const problemas: string[] = [];
  if (t.length < OBSERVACION_LARGO_MIN || t.length > OBSERVACION_LARGO_MAX) {
    problemas.push(`largo ${t.length} fuera de ${OBSERVACION_LARGO_MIN}–${OBSERVACION_LARGO_MAX}`);
  }
  const norm = normalizar(t);
  const v = norm.match(VEREDICTO);
  if (v) problemas.push(`palabra de veredicto ("${v[0]}")`);
  const r = norm.match(RESOLUCION);
  if (r) problemas.push(`resuelve, elige un valor o recomienda ("${r[0]}")`);
  const p = norm.match(CIFRA_EN_PALABRAS);
  if (p) problemas.push(`cifra escrita con palabras ("${p[0]}")`);
  // Las únicas cifras permitidas son las que ya estaban en la entrada: la
  // IA no calcula (ni diferencias, ni porcentajes, ni conversiones).
  const permitidas = new Set(numerosEnTexto(entradaTexto));
  const nuevas = numerosEnTexto(t).filter((x) => !permitidas.has(x));
  if (nuevas.length) problemas.push(`cifra que no está en la entrada (${nuevas.join(", ")})`);
  if (/[<>]|https?:\/\//i.test(t)) problemas.push("trae etiquetas o enlaces");
  return problemas;
}
