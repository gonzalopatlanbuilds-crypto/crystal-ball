// DATOS DE EJEMPLO, INVENTADOS para esta demo — ninguna de estas listas
// está conectada a CNBV, CONDUSEF, ni a ningún registro real. Sirven
// solo para mostrar cómo se vería una señal de verificación si existiera
// una fuente real y pública a la que consultar.

export type EstadoRegistro = "registrada_sin_reportes" | "reportada_fraude";

export interface EmpresaMock {
  nombre: string;
  estado: EstadoRegistro;
  fuente: "simulada";
  notaFuente: string;
}

export interface PromotorMock {
  nombre: string;
  estado: EstadoRegistro;
  fuente: "simulada";
  notaFuente: string;
}

export const EMPRESAS_MOCK: EmpresaMock[] = [
  {
    nombre: "Inversiones Horizonte SA de CV",
    estado: "registrada_sin_reportes",
    fuente: "simulada",
    notaFuente: "Lista de ejemplo, actualizada a mano para esta demo.",
  },
  {
    nombre: "Capital Sereno Fondos",
    estado: "registrada_sin_reportes",
    fuente: "simulada",
    notaFuente: "Lista de ejemplo, actualizada a mano para esta demo.",
  },
  {
    nombre: "Rendimientos Rápidos Global",
    estado: "reportada_fraude",
    fuente: "simulada",
    notaFuente: "Ejemplo de reporte simulado — nombre inventado para esta demo.",
  },
  {
    nombre: "Triple Retorno Internacional",
    estado: "reportada_fraude",
    fuente: "simulada",
    notaFuente: "Ejemplo de reporte simulado — nombre inventado para esta demo.",
  },
];

export const PROMOTORES_MOCK: PromotorMock[] = [
  {
    nombre: "Laura Méndez Ibarra",
    estado: "registrada_sin_reportes",
    fuente: "simulada",
    notaFuente: "Lista de ejemplo, actualizada a mano para esta demo.",
  },
  {
    nombre: "Ricardo Fuentes Salas",
    estado: "reportada_fraude",
    fuente: "simulada",
    notaFuente: "Ejemplo de reporte simulado — nombre inventado para esta demo.",
  },
  {
    nombre: "Ale Contreras",
    estado: "reportada_fraude",
    fuente: "simulada",
    notaFuente: "Ejemplo de reporte simulado — nombre inventado para esta demo.",
  },
];

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function buscarEmpresa(nombre: string): EmpresaMock | null {
  const objetivo = normalizar(nombre);
  if (!objetivo) return null;
  return (
    EMPRESAS_MOCK.find((empresa) => normalizar(empresa.nombre) === objetivo) ?? null
  );
}

export function buscarPromotor(nombre: string): PromotorMock | null {
  const objetivo = normalizar(nombre);
  if (!objetivo) return null;
  return (
    PROMOTORES_MOCK.find((promotor) => normalizar(promotor.nombre) === objetivo) ?? null
  );
}
