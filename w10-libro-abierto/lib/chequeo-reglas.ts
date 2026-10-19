// Revisión simple por reglas (Condición 4: la IA tiene que ganarle a esto
// para justificarse). Determinista: falta el supuesto, o no está
// sustentado (sin fuente). Misma forma de salida que el auditor de IA para
// poder compararlos.

import { CATALOGO, CLAVES, ETIQUETA_ESTADO, type EstadoSupuesto } from "./supuestos.ts";

export interface SupuestoAuditable {
  key: string;
  value_num: number;
  unit: string;
  status: EstadoSupuesto;
  source_url: string | null;
  source_date: string | null;
}

export interface HallazgoReglas {
  clave: string;
  texto: string;
}

export function chequeoPorReglas(supuestos: readonly SupuestoAuditable[]): HallazgoReglas[] {
  const hallazgos: HallazgoReglas[] = [];
  for (const clave of CLAVES) {
    const s = supuestos.find((x) => x.key === clave);
    const etiqueta = CATALOGO[clave].etiqueta;
    if (!s) {
      hallazgos.push({ clave, texto: `"${etiqueta}" no existe en el modelo.` });
    } else if (s.status !== "sustained") {
      hallazgos.push({ clave, texto: `"${etiqueta}" no tiene fuente (estado: ${ETIQUETA_ESTADO[s.status]}).` });
    } else if (!s.source_url || !s.source_date) {
      hallazgos.push({ clave, texto: `"${etiqueta}" está sustentado pero le falta URL o fecha de la fuente.` });
    }
  }
  return hallazgos;
}
