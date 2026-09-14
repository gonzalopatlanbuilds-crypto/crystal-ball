import type { RangoEdadValue, SintomaValue } from "@/lib/screenings";

// ============================================================
// Riesgo por reglas — lógica pura (sin IO, determinística, testeable a
// mano). Nada de esto lo decide un LLM: la Feature 4 solo va a redactar
// una explicación en lenguaje simple a partir del `nivel` y los `motivos`
// que esta función ya calculó (ver DECISIONS.md).
// ============================================================

export interface RiesgoInput {
  glucoseMgdl: number;
  familyHistory: boolean;
  symptoms: SintomaValue[];
  ageBand: RangoEdadValue;
}

export interface ResultadoRiesgo {
  score: number;
  nivel: "alto" | "bajo";
  motivos: string[];
}

// A partir de este puntaje el resultado se trata como alto riesgo —
// dispara el paso concreto obligatorio (Feature 4) y la señal para el
// navegador humano (fuera de alcance de este slice).
export const UMBRAL_ALTO_RIESGO = 40;

export function calcularRiesgo(input: RiesgoInput): ResultadoRiesgo {
  let score = 0;
  const motivos: string[] = [];

  if (input.glucoseMgdl >= 200) {
    score += 40;
    motivos.push(`Glucosa de ${input.glucoseMgdl} mg/dL en rango de diabetes (≥200 mg/dL).`);
  } else if (input.glucoseMgdl >= 140) {
    score += 25;
    motivos.push(`Glucosa de ${input.glucoseMgdl} mg/dL en rango de prediabetes (140–199 mg/dL).`);
  }

  if (input.familyHistory) {
    score += 15;
    motivos.push("Antecedente familiar de diabetes.");
  }

  if (input.symptoms.length > 0) {
    score += input.symptoms.length * 10;
    motivos.push(`${input.symptoms.length} síntoma(s) reportado(s) (+10 cada uno).`);
  }

  if (input.ageBand === "60_mas") {
    score += 15;
    motivos.push("Edad de 60 años o más.");
  } else if (input.ageBand === "40_59") {
    score += 8;
    motivos.push("Edad entre 40 y 59 años.");
  }

  const nivel: ResultadoRiesgo["nivel"] = score >= UMBRAL_ALTO_RIESGO ? "alto" : "bajo";
  return { score, nivel, motivos };
}

// ============================================================
// Folio — identificador público (folio + apellido, sin login) para la
// consulta del paciente en Feature 3. Debe ser difícil de adivinar: nada
// de contadores secuenciales ni datos derivados del paciente, alfabeto
// sin caracteres ambiguos (sin O/0, I/1) porque se imprime y un humano lo
// vuelve a teclear a mano después.
// ============================================================

const FOLIO_ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function segmentoAleatorio(longitud: number): string {
  const bytes = new Uint8Array(longitud);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < longitud; i++) {
    out += FOLIO_ALFABETO[bytes[i] % FOLIO_ALFABETO.length];
  }
  return out;
}

export function generarFolio(): string {
  return `MX-${segmentoAleatorio(4)}-${segmentoAleatorio(3)}`;
}
