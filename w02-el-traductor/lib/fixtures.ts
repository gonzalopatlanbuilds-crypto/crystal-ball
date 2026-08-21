/**
 * Datos de ejemplo (inventados, no reales) para la demo de El Traductor.
 * Shadow Clause: este objeto nunca debe tener un campo de score/probabilidad.
 * "vinculos" existe únicamente como texto ilustrativo del aviso simulado del
 * banco — nunca se usa como input funcional del sistema.
 */

export type DatoUsado = {
  id: "cp" | "apellido" | "patron_consumo";
  etiqueta: string;
  valor: string;
  explicacion: string;
};

export type AvisoSimulado = {
  nombreSolicitante: string;
  fechaSolicitud: string;
  entidadSimulada: string;
  motivoGenerico: string;
  datosUsados: DatoUsado[];
  ejemploVinculos: string;
};

export const avisoSimuladoMarisol: AvisoSimulado = {
  nombreSolicitante: "Marisol Pech",
  fechaSolicitud: "2026-08-18",
  entidadSimulada: "Financiera Ejemplo S.A. (simulado, no es un banco real)",
  motivoGenerico:
    "Tu solicitud de crédito no fue aprobada con la información disponible en este momento.",
  datosUsados: [
    {
      id: "cp",
      etiqueta: "Código postal",
      valor: "09000",
      explicacion:
        "Usaron la zona donde vives (CP 09000, Iztapalapa) como parte de su evaluación, aunque tu dirección no dice nada sobre si tú pagas o no.",
    },
    {
      id: "apellido",
      etiqueta: "Apellido",
      valor: "Pech",
      explicacion:
        "Tu apellido se registró como parte de tus datos personales usados en la revisión, aunque un apellido no debería definir si mereces un crédito.",
    },
    {
      id: "patron_consumo",
      etiqueta: "Patrón de consumo",
      valor: "Compras frecuentes en efectivo, ingresos variables (venta informal)",
      explicacion:
        "Notaron que tus ingresos varían de un mes a otro por ser vendedora informal, y eso lo usaron en su evaluación, aunque no refleja tu capacidad real de pago.",
    },
  ],
  ejemploVinculos:
    "El aviso también menciona de forma genérica que a veces se considera la 'cercanía con otras personas o negocios de la zona' — este dato es solo un ejemplo de lo que el banco dice que podría usar, y El Traductor nunca lo calcula ni lo usa.",
};
