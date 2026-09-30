// Modelo de financiamiento: proyección de costo mensual + los tres
// escenarios (víctima paga / patrocinador paga por caso / sin
// patrocinador), con break-even y déficit calculados automáticamente.
//
// Sin imports a propósito (igual que lib/costos.ts): se prueba con node
// directo contra cuentas hechas a mano, y la Feature 4 (resumen de IA)
// recibe exactamente estos números — el modelo de lenguaje nunca calcula
// ni inventa una cifra propia.
//
// Todo en centavos enteros. Cada paso redondea a centavos lo que la UI
// muestra, y el siguiente paso usa ese valor redondeado — así cualquier
// subtotal en pantalla se puede rehacer a mano con los números visibles.

export interface CasoCosteado {
  caseType: string;
  costoCentavos: number;
}

export interface VolumenTipo {
  caseType: string;
  monthlyCases: number;
}

export interface LineaTipo {
  caseType: string;
  casosMes: number;
  casosRegistrados: number;
  costoPromedioCentavos: number;
  // true si este tipo no tiene ni un caso con tiempo registrado y su costo
  // se estimó con el promedio de TODOS los casos registrados. Se muestra
  // en pantalla: es menos firme que un promedio del propio tipo.
  estimadoConPromedioGeneral: boolean;
  subtotalCentavos: number;
}

export interface Modelo {
  escala: number;
  casosMes: number;
  casosRegistrados: number;
  costoPromedioGeneralCentavos: number;
  lineas: LineaTipo[];
  usaPromedioGeneral: boolean;
  costoMensualCentavos: number;
  victimaPaga: { ingresoCentavos: number; balanceCentavos: number };
  patrocinioPorCaso: {
    tarifaCentavos: number;
    ingresoCentavos: number;
    balanceCentavos: number;
    // Tarifa mínima por caso que cubriría el costo a esta escala.
    tarifaEquilibrioCentavos: number;
  };
  sinPatrocinio: { ingresoCentavos: number; deficitCentavos: number };
}

function promedio(valores: number[]): number {
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

// Devuelve null si no hay ni un caso con tiempo registrado: sin costo real
// no hay nada que proyectar, y no se rellena con un número inventado.
export function calcularModelo(
  escala: number,
  casos: CasoCosteado[],
  volumen: VolumenTipo[],
  tarifaPatrocinioCentavos: number
): Modelo | null {
  const costeados = casos.filter((c) => c.costoCentavos > 0);
  if (costeados.length === 0 || volumen.length === 0) {
    return null;
  }

  const costoPromedioGeneralCentavos = promedio(costeados.map((c) => c.costoCentavos));

  const lineas: LineaTipo[] = volumen.map((v) => {
    const delTipo = costeados.filter((c) => c.caseType === v.caseType);
    const estimado = delTipo.length === 0;
    const costoPromedio = estimado
      ? costoPromedioGeneralCentavos
      : promedio(delTipo.map((c) => c.costoCentavos));
    return {
      caseType: v.caseType,
      casosMes: v.monthlyCases,
      casosRegistrados: delTipo.length,
      costoPromedioCentavos: costoPromedio,
      estimadoConPromedioGeneral: estimado,
      subtotalCentavos: v.monthlyCases * costoPromedio,
    };
  });

  const casosMes = lineas.reduce((s, l) => s + l.casosMes, 0);
  const costoMensualCentavos = lineas.reduce((s, l) => s + l.subtotalCentavos, 0);
  const ingresoPatrocinio = tarifaPatrocinioCentavos * casosMes;

  return {
    escala,
    casosMes,
    casosRegistrados: costeados.length,
    costoPromedioGeneralCentavos,
    lineas,
    usaPromedioGeneral: lineas.some((l) => l.estimadoConPromedioGeneral),
    costoMensualCentavos,
    victimaPaga: { ingresoCentavos: 0, balanceCentavos: -costoMensualCentavos },
    patrocinioPorCaso: {
      tarifaCentavos: tarifaPatrocinioCentavos,
      ingresoCentavos: ingresoPatrocinio,
      balanceCentavos: ingresoPatrocinio - costoMensualCentavos,
      tarifaEquilibrioCentavos: casosMes > 0 ? Math.ceil(costoMensualCentavos / casosMes) : 0,
    },
    sinPatrocinio: { ingresoCentavos: 0, deficitCentavos: costoMensualCentavos - 0 },
  };
}
