// Revisión automática del borrador de IA antes de mostrarlo. Sin imports a
// propósito (igual que lib/costos.ts y lib/escenarios.ts): se prueba con
// `node` directo contra textos escritos a mano.
//
// No reemplaza leer el borrador — es una red para lo que el test plan pide
// mecánicamente: que nunca afirme una alianza y que no use lenguaje de
// "confirmado" para lo que no lo está. Si encuentra algo, el borrador NO
// se muestra (ver lib/resumen.ts).

// Minúsculas y sin acentos, para que "Alianza" y "alianza" o "ningún" y
// "ningun" cuenten igual.
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Palabras que, si aparecen poco antes del término, lo vuelven una
// negación ("no representa una alianza", "ningún patrocinador ha
// aceptado", "sin acuerdo").
const NEGACIONES = new Set(["no", "ni", "sin", "ningun", "ninguna", "ninguno", "nadie", "nunca"]);
// Hasta 6 palabras antes, pero sin cruzar puntuación: "sin una fuente de
// patrocinio confirmada" cuenta como negada (Haiku lo escribió así y la
// ventana de 4 palabras lo rechazaba), "No es un piloto: el banco ha
// confirmado" no.
const VENTANA_NEGACION = 6;

// Siempre prohibidos, con o sin negación: describen una relación que no
// existe o prometen algo. La IA tiene instrucción de no usarlos.
const PROHIBIDOS: { patron: RegExp; motivo: string }[] = [
  { patron: /\bsocios?\b/, motivo: "menciona un socio" },
  { patron: /\baliad[oa]s?\b/, motivo: "menciona un aliado" },
  { patron: /\bconvenios?\b/, motivo: "menciona un convenio" },
  { patron: /\bfirmad[oa]s?\b/, motivo: "menciona algo firmado" },
  { patron: /\bgarantiz/, motivo: "promete una garantía" },
  { patron: /\bcomprometid[oa]s?\b/, motivo: "menciona un compromiso" },
  { patron: /\brespaldad[oa]s?\b/, motivo: "dice que algo está respaldado" },
  { patron: /\ben colaboracion con\b/, motivo: "dice que hay una colaboración" },
  { patron: /\bnuestros? patrocinador/, motivo: "habla de 'nuestro patrocinador'" },
];

// Permitidos solo si van negados ("no confirmado", "no representa una
// alianza", "ningún patrocinador ha aceptado").
const REQUIEREN_NEGACION: { patron: RegExp; motivo: string }[] = [
  { patron: /\bconfirmad[oa]s?\b/g, motivo: "usa 'confirmado' sin negarlo" },
  { patron: /\balianzas?\b/g, motivo: "menciona una alianza sin negarla" },
  { patron: /\bacept(o|aron|ado|ada|ados|adas)\b/g, motivo: "dice que alguien aceptó, sin negarlo" },
  { patron: /\bacuerdos?\b/g, motivo: "menciona un acuerdo sin negarlo" },
  // Prueba real: "el costo está fundamentado en datos reales de operación"
  // — son casos de prueba ficticios.
  { patron: /\b(datos|operacion|casos) reales?\b/g, motivo: "presenta datos de prueba como reales" },
];

function negadoAntes(normalizado: string, indice: number): boolean {
  const antes = normalizado.slice(0, indice);
  const clausula = antes.slice(Math.max(...[".", ",", ";", ":", "!", "?", "\n"].map((p) => antes.lastIndexOf(p))) + 1);
  const previas = clausula
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(-VENTANA_NEGACION);
  return previas.some((p) => NEGACIONES.has(p));
}

// "$25,300.00", "$25,300", "$ 300" → centavos. Formato es-MX: coma de
// miles, punto decimal.
export function montosEnTexto(texto: string): number[] {
  const montos: number[] = [];
  for (const m of texto.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?/g)) {
    const enteros = Number(m[1].replace(/,/g, ""));
    const decimales = m[2] ? Number(m[2].slice(1).padEnd(2, "0")) : 0;
    montos.push(enteros * 100 + decimales);
  }
  return montos;
}

function formatoCentavos(c: number): string {
  return `$${(c / 100).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Devuelve la lista de problemas encontrados; vacía = pasa.
export function revisarBorrador(texto: string, montosPermitidosCentavos: number[]): string[] {
  const problemas: string[] = [];
  const n = normalizar(texto);

  if (n.trim() === "") {
    return ["el borrador llegó vacío"];
  }

  for (const { patron, motivo } of PROHIBIDOS) {
    if (patron.test(n)) problemas.push(motivo);
  }

  for (const { patron, motivo } of REQUIEREN_NEGACION) {
    for (const m of n.matchAll(patron)) {
      if (!negadoAntes(n, m.index ?? 0)) {
        problemas.push(`${motivo} ("${m[0]}")`);
        break;
      }
    }
  }

  // La tarifa por caso es un supuesto; lo calculado es el costo. En la
  // prueba real Haiku escribió "la tarifa hipotética, calculada a partir
  // del tiempo de personal registrado" — eso vuelve el supuesto un hecho.
  for (const oracion of n.split(/[.!?\n]+/)) {
    if (/\btarifa/.test(oracion) && /\bcalculad[oa]/.test(oracion)) {
      problemas.push("presenta la tarifa hipotética como si estuviera calculada");
      break;
    }
  }

  // Toda cifra en pesos tiene que ser una de la hoja de datos: la IA
  // redacta, no calcula. Un monto que no está ahí es inventado o
  // redondeado, y ya no se puede verificar a mano contra la pantalla.
  const permitidos = new Set(montosPermitidosCentavos);
  const ajenos = [...new Set(montosEnTexto(texto).filter((c) => !permitidos.has(c)))];
  if (ajenos.length > 0) {
    problemas.push(
      `usa cifras que no están en el modelo: ${ajenos.map(formatoCentavos).join(", ")}`
    );
  }

  return problemas;
}
