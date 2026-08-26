import { validarClabe } from "@/lib/clabe";
import { buscarEmpresa, buscarPromotor } from "@/lib/fixtures";

export interface DatosOferta {
  empresa: string;
  promotor: string;
  clabe: string;
}

export type ColorSemaforo = "rojo" | "amarillo" | "verde";

export interface Senal {
  id: string;
  etiqueta: string;
  verificado: boolean;
  evidencia: string;
  fuente: "real" | "mock";
}

export interface DesgloseCostoItem {
  concepto: string;
  costoEstimado: string;
  motivo: string;
}

export interface ResultadoVerificacion {
  color: ColorSemaforo;
  senales: Senal[];
  desgloseCosto: DesgloseCostoItem[];
  notaCosto: string;
  disclaimer: string;
}

// Estimados ilustrativos de órdenes de magnitud típicos de servicios de
// verificación (KYC/AML, consulta a listas de riesgo, validación de
// identidad). NO son cotizaciones reales de ningún proveedor — sirven
// para mostrar por qué este tipo de verificación no está al alcance de
// una persona particular.
const DESGLOSE_COSTO: DesgloseCostoItem[] = [
  {
    concepto: "Consulta KYC/AML por persona o empresa",
    costoEstimado: "$150–$400 MXN por consulta",
    motivo: "Se cobra por consulta y requiere contrato con el proveedor de datos.",
  },
  {
    concepto: "Verificación de registro ante CNBV / CONDUSEF",
    costoEstimado: "Sin costo directo, pero acceso solo institucional",
    motivo: "Las consultas masivas o automatizadas están reservadas a instituciones reguladas, no a particulares.",
  },
  {
    concepto: "Monitoreo continuo de listas de riesgo (PEP, OFAC, listas negras)",
    costoEstimado: "$2,000–$8,000 MXN al mes",
    motivo: "Se vende como suscripción empresarial, no como consulta individual.",
  },
  {
    concepto: "Validación de identidad del promotor (biometría + documentos)",
    costoEstimado: "$20–$60 MXN por validación",
    motivo: "Solo se ofrece a empresas con contrato, no a personas que quieren verificar antes de invertir.",
  },
];

function evaluarSenalClabe(clabe: string): Senal {
  const resultado = validarClabe(clabe);
  if (!resultado.formatoValido) {
    return {
      id: "clabe-formato",
      etiqueta: "Formato de la CLABE",
      verificado: false,
      evidencia: "La CLABE no tiene 18 dígitos numéricos — no se pudo evaluar el dígito verificador.",
      fuente: "real",
    };
  }
  return {
    id: "clabe-formato",
    etiqueta: "Dígito verificador de la CLABE",
    verificado: resultado.digitoVerificadorValido,
    evidencia: resultado.digitoVerificadorValido
      ? `Dígito verificador correcto. Banco identificado: ${resultado.banco ?? "no está en el catálogo simplificado de esta demo"}.`
      : "El dígito verificador no coincide — la CLABE tiene un error de captura o está mal formada.",
    fuente: "real",
  };
}

function evaluarSenalEmpresa(empresa: string): { senal: Senal; estado: ReturnType<typeof buscarEmpresa> } {
  const match = buscarEmpresa(empresa);
  return {
    senal: {
      id: "empresa-registro",
      etiqueta: "Empresa en lista de ejemplo",
      verificado: match?.estado === "registrada_sin_reportes",
      evidencia: match
        ? `Coincide con "${match.nombre}" en la lista simulada de esta demo (estado: ${match.estado.replace("_", " ")}). ${match.notaFuente}`
        : "No se encontró coincidencia en la lista simulada — esto NO significa que la empresa sea falsa, solo que no está en esta lista de ejemplo.",
      fuente: "mock",
    },
    estado: match,
  };
}

function evaluarSenalPromotor(promotor: string): { senal: Senal; estado: ReturnType<typeof buscarPromotor> } {
  const match = buscarPromotor(promotor);
  return {
    senal: {
      id: "promotor-reportes",
      etiqueta: "Promotor en lista de reportes",
      verificado: match?.estado !== "reportada_fraude",
      evidencia: match
        ? `Coincide con "${match.nombre}" en la lista simulada de esta demo (estado: ${match.estado.replace("_", " ")}).`
        : "No se encontró coincidencia en la lista simulada — no hay señal ni positiva ni negativa.",
      fuente: "mock",
    },
    estado: match,
  };
}

export function evaluarOferta(datos: DatosOferta): ResultadoVerificacion {
  const senalClabe = evaluarSenalClabe(datos.clabe);
  const { senal: senalEmpresa, estado: empresaMatch } = evaluarSenalEmpresa(datos.empresa);
  const { senal: senalPromotor, estado: promotorMatch } = evaluarSenalPromotor(datos.promotor);

  const clabeValida = senalClabe.verificado;
  const hayFraudeReportado =
    empresaMatch?.estado === "reportada_fraude" || promotorMatch?.estado === "reportada_fraude";
  const empresaLimpiaYRegistrada = empresaMatch?.estado === "registrada_sin_reportes";

  let color: ColorSemaforo;
  if (!clabeValida || hayFraudeReportado) {
    color = "rojo";
  } else if (empresaLimpiaYRegistrada) {
    // Incluso con todas las señales positivas, el máximo posible es
    // "verde" con un disclaimer explícito — nunca un badge de "seguro"
    // o "garantizado", porque las listas mock no son una fuente oficial.
    color = "verde";
  } else {
    color = "amarillo";
  }

  return {
    color,
    senales: [senalClabe, senalEmpresa, senalPromotor],
    desgloseCosto: DESGLOSE_COSTO,
    notaCosto: "Cifras estimadas e ilustrativas — no son una cotización real de ningún proveedor.",
    disclaimer:
      "Esta verificación combina un cálculo real (formato de la CLABE) con listas de ejemplo simuladas, sin conexión a CNBV, CONDUSEF ni a tu institución financiera. No sustituye una verificación oficial y nunca es una garantía de que la oferta sea segura.",
  };
}
