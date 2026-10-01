import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CASE_TYPE_LABELS, SIMULADO_AVISO, type CaseType } from "@/lib/casos";
import { formatoMxn } from "@/lib/costos";
import type { Modelo } from "@/lib/escenarios";
import {
  AVISO_NINGUN_PATROCINADOR,
  ETIQUETA_PATROCINIO,
  ETIQUETA_SIN_PATROCINIO,
  ETIQUETA_VICTIMA_PAGA,
  TITULO_BORRADOR,
} from "@/lib/etiquetas";
import { etiquetarMontos, revisarBorrador } from "@/lib/guardia-resumen";

// Haiku 4.5: decisión tuya (más barato, suficiente para un borrador corto
// a partir de números ya calculados).
const MODELO_IA = "claude-haiku-4-5";

// La IA solo redacta. Todos los números salen de lib/escenarios.ts
// (calculados en el servidor con la sesión de quien pide) y se le pasan ya
// formateados; la guardia rechaza cualquier monto que no venga de aquí.
const SYSTEM_PROMPT = `Redactas el borrador de un resumen breve para un posible patrocinador (por ejemplo, un banco o una empresa de telecomunicaciones) de un servicio piloto en México que apoya a víctimas de fraude digital. El servicio es gratuito para las víctimas. Recibes una hoja de datos con el modelo de costos del piloto.

Reglas obligatorias:
1. Usa solo las cifras de la hoja de datos, copiadas exactamente como aparecen. No calcules, redondees, sumes ni inventes cifras, porcentajes ni proyecciones nuevas.
2. Ningún patrocinador ha sido contactado ni ha aceptado nada. Nunca digas ni insinúes que existe una alianza, acuerdo, socio, aliado, convenio, compromiso, respaldo o interés de alguna institución. No nombres bancos ni empresas reales.
3. Distingue siempre dos cifras distintas: el costo por caso (lo que cuesta atender un caso, calculado a partir del tiempo de personal registrado) y la tarifa hipotética (lo que un patrocinador pagaría por caso, un supuesto para discusión, nunca una oferta). La tarifa no se calcula del tiempo registrado: nunca lo digas.
4. La palabra "confirmado" solo puede aparecer como "no confirmado", y solo para los escenarios en que la víctima paga o un patrocinador paga por caso. El costo por caso y el escenario sin patrocinador se describen como cálculo directo del tiempo de personal registrado: nunca los llames "confirmado" ni "no confirmado".
5. Di explícitamente que el volumen de casos es simulado. Los casos con tiempo registrado son casos de prueba del piloto: no digas que el costo viene de datos reales ni de operación real.
6. Empieza directamente con el primer párrafo. No escribas título, encabezados, firmas ni avisos legales: la aplicación los agrega.
7. Español de México, tono sobrio y verificable, sin lenguaje de marketing. Máximo 4 párrafos cortos, texto plano sin markdown.`;

export interface HojaDeDatos {
  texto: string;
  montosCentavos: number[];
}

export function hojaDeDatos(m: Modelo): HojaDeDatos {
  const p = m.patrocinioPorCaso;
  const lineas = m.lineas.map(
    (l) =>
      `- ${CASE_TYPE_LABELS[l.caseType as CaseType] ?? l.caseType}: ${l.casosMes} casos/mes (simulado) × costo promedio ${formatoMxn(l.costoPromedioCentavos)}${
        l.estimadoConPromedioGeneral ? " (estimado con el promedio general: no hay casos registrados de este tipo)" : ""
      } = ${formatoMxn(l.subtotalCentavos)}`
  );

  const texto = [
    `Escala elegida: ${m.casosMes} casos/mes (volumen simulado, no real).`,
    `Costo por caso: calculado a partir del tiempo de personal registrado en ${m.casosRegistrados} caso(s) de prueba. Promedio general: ${formatoMxn(m.costoPromedioGeneralCentavos)} por caso.`,
    `Desglose:`,
    ...lineas,
    `Costo mensual proyectado: ${formatoMxn(m.costoMensualCentavos)}.`,
    ``,
    `Escenario A — La víctima paga: ingreso $0.00 MXN (el servicio es gratuito para la víctima). Déficit de ${formatoMxn(-m.victimaPaga.balanceCentavos)}/mes. Etiqueta: ${ETIQUETA_VICTIMA_PAGA}.`,
    `Escenario B — Un patrocinador paga por caso: tarifa hipotética de ${formatoMxn(p.tarifaCentavos)} por caso, ingreso hipotético de ${formatoMxn(p.ingresoCentavos)}/mes, ${
      p.balanceCentavos >= 0 ? `superávit de ${formatoMxn(p.balanceCentavos)}/mes` : `déficit de ${formatoMxn(-p.balanceCentavos)}/mes`
    }. Tarifa mínima que cubriría el costo a esta escala: ${formatoMxn(p.tarifaEquilibrioCentavos)} por caso. Etiqueta: ${ETIQUETA_PATROCINIO}.`,
    `Escenario C — Sin patrocinador: déficit de ${formatoMxn(m.sinPatrocinio.deficitCentavos)}/mes. Etiqueta: ${ETIQUETA_SIN_PATROCINIO}.`,
  ].join("\n");

  const montosCentavos = [
    0,
    m.costoPromedioGeneralCentavos,
    m.costoMensualCentavos,
    ...m.lineas.flatMap((l) => [l.costoPromedioCentavos, l.subtotalCentavos]),
    Math.abs(m.victimaPaga.balanceCentavos),
    p.tarifaCentavos,
    p.ingresoCentavos,
    Math.abs(p.balanceCentavos),
    p.tarifaEquilibrioCentavos,
    m.sinPatrocinio.deficitCentavos,
  ];

  return { texto, montosCentavos };
}

// En la prueba real Haiku puso título en markdown en 8 de 9 borradores
// pese a la instrucción. La UI muestra texto plano, así que se quita aquí
// en vez de confiar en el prompt: líneas de encabezado (# …, o una línea
// entera en **negritas**) y los ** sueltos.
export function limpiarFormato(texto: string): string {
  return texto
    .split("\n")
    .filter((l) => !/^\s*#{1,6}\s/.test(l) && !/^\s*\*\*[^*]+\*\*\s*$/.test(l))
    .join("\n")
    .replace(/\*\*/g, "")
    .trim();
}

export type ResultadoResumen =
  | { estado: "ok"; texto: string }
  | { estado: "rechazado"; problemas: string[] }
  | { estado: "error"; mensaje: string };

export async function redactarResumen(m: Modelo): Promise<ResultadoResumen> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("redactarResumen: falta ANTHROPIC_API_KEY");
    return { estado: "error", mensaje: "El servicio de IA no está configurado." };
  }

  const hoja = hojaDeDatos(m);
  const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });

  let respuesta: Anthropic.Message;
  try {
    respuesta = await client.messages.create({
      model: MODELO_IA,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Hoja de datos:\n\n${hoja.texto}` }],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.error("redactarResumen: rate limit", error.status);
      return { estado: "error", mensaje: "El servicio de IA está saturado. Intenta en un minuto." };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("redactarResumen: llave inválida", error.status);
      return { estado: "error", mensaje: "El servicio de IA no está configurado correctamente." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error("redactarResumen: error de la API", error.status, error.message);
    } else {
      console.error("redactarResumen: error inesperado", error);
    }
    return { estado: "error", mensaje: "No se pudo generar el borrador. Intenta de nuevo." };
  }

  if (respuesta.stop_reason !== "end_turn") {
    console.error("redactarResumen: stop_reason", respuesta.stop_reason);
    return { estado: "error", mensaje: "El borrador llegó incompleto. Intenta de nuevo." };
  }

  const texto = limpiarFormato(
    respuesta.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
  );

  const problemas = revisarBorrador(texto, hoja.montosCentavos);
  if (problemas.length > 0) {
    // Se registra completo en el log del servidor para poder ajustar el
    // prompt o la guardia, pero no se le muestra a nadie.
    console.error("redactarResumen: borrador rechazado", problemas, texto);
    return { estado: "rechazado", problemas };
  }

  return { estado: "ok", texto };
}

const TAG_NO_CONFIRMADO = "NO CONFIRMADO: tarifa hipotética, ningún patrocinador ha aceptado";
const TAG_SIN_VALIDAR = "SIN VALIDAR: datos de prueba simulados";

// Contenido del .txt descargable. Persona test: un fragmento copiado fuera
// de contexto no debe perder su advertencia, así que (1) cada monto de la
// prosa de la IA lleva su etiqueta pegada (etiquetarMontos) y (2) las
// cifras clave se repiten en líneas armadas en código, cada una con su
// etiqueta y su supuesto completos — sin depender de cómo redactó la IA.
export function armarDescarga(texto: string, m: Modelo, generado: string): string {
  const p = m.patrocinioPorCaso;
  const casos = `${m.casosMes.toLocaleString("es-MX")} casos/mes simulados`;
  const balanceB =
    p.balanceCentavos >= 0
      ? `superávit hipotético de ${formatoMxn(p.balanceCentavos)}/mes`
      : `déficit hipotético de ${formatoMxn(-p.balanceCentavos)}/mes`;

  const cifras = [
    `- Costo mensual proyectado [SIN VALIDAR: volumen simulado]: ${formatoMxn(m.costoMensualCentavos)} a ${casos}; costo por caso calculado del tiempo de personal registrado en ${m.casosRegistrados} caso(s) de prueba ficticios.`,
    `- Escenario A, la víctima paga [NO CONFIRMADO: sin fuente de ingreso]: ingreso $0.00 MXN, déficit de ${formatoMxn(-m.victimaPaga.balanceCentavos)}/mes a ${casos}.`,
    `- Escenario B [NO CONFIRMADO]: tarifa hipotética de ${formatoMxn(p.tarifaCentavos)} por caso que ningún patrocinador ha aceptado.`,
    `- Escenario B [NO CONFIRMADO]: ingreso hipotético de ${formatoMxn(p.ingresoCentavos)}/mes a ${casos}, basado en una tarifa de ${formatoMxn(p.tarifaCentavos)}/caso que ningún patrocinador ha aceptado.`,
    `- Escenario B [NO CONFIRMADO]: ${balanceB} a ${casos}, basado en una tarifa de ${formatoMxn(p.tarifaCentavos)}/caso que ningún patrocinador ha aceptado.`,
    `- Escenario B [NO CONFIRMADO]: una tarifa de ${formatoMxn(p.tarifaEquilibrioCentavos)}/caso cubriría el costo a ${casos}; ningún patrocinador ha aceptado pagarla.`,
    `- Escenario C, sin patrocinador [cálculo directo del tiempo registrado; volumen simulado]: déficit de ${formatoMxn(m.sinPatrocinio.deficitCentavos)}/mes a ${casos}.`,
  ];

  return [
    TITULO_BORRADOR.toUpperCase(),
    `Escala: ${casos} · Generado: ${generado}`,
    `Cada cifra lleva su etiqueta entre corchetes. No la quites al citarla.`,
    "",
    etiquetarMontos(
      texto,
      [p.tarifaCentavos, p.ingresoCentavos, Math.abs(p.balanceCentavos), p.tarifaEquilibrioCentavos],
      TAG_NO_CONFIRMADO,
      TAG_SIN_VALIDAR
    ),
    "",
    "CIFRAS DEL MODELO (cada línea se sostiene sola):",
    ...cifras,
    "",
    "---",
    `${AVISO_NINGUN_PATROCINADOR} ${SIMULADO_AVISO}`,
    "Este borrador no representa una alianza ni una oferta. Revísalo contra la pantalla de CostoReal antes de compartirlo.",
  ].join("\n");
}
