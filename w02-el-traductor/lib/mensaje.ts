import type { AvisoSimulado } from "./fixtures";

export function generarMensajeSolicitud(
  aviso: AvisoSimulado,
  datosObjetadosIds: string[]
): string {
  const datosObjetados = aviso.datosUsados.filter((dato) =>
    datosObjetadosIds.includes(dato.id)
  );

  const listaDatos = datosObjetados.length
    ? datosObjetados.map((dato) => `- ${dato.etiqueta}: ${dato.valor}`).join("\n")
    : "- No se marcó ningún dato en específico; se solicita revisión general del caso.";

  return `Solicitud de revisión humana — LFPDPPP

Nombre: ${aviso.nombreSolicitante}
Fecha de la solicitud original: ${aviso.fechaSolicitud}
Entidad: ${aviso.entidadSimulada}

Con fundamento en la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y mis derechos ARCO, solicito que una persona revise mi caso. Objeto el uso de los siguientes datos en la decisión:

${listaDatos}

Pido que esta solicitud sea atendida por una persona, no solo por un sistema automático.`;
}
