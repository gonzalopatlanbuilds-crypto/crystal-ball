import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESCALAS, type Escala } from "@/lib/casos";
import { costoCasoCentavos } from "@/lib/costos";
import { calcularModelo, type Modelo } from "@/lib/escenarios";

export const ESCALA_DEFAULT: Escala = 100;
// $300 por caso: la cifra hipotética del mockup 2. Es un supuesto para
// discusión, nunca una oferta — se puede cambiar en pantalla.
export const TARIFA_PATROCINIO_DEFAULT_MXN = 300;
export const TARIFA_PATROCINIO_MAX_MXN = 10000;

export interface ParametrosModelo {
  escala: Escala;
  tarifaPatrocinioMxn: number;
  // Si lo que venía en la URL no era válido se usa el default y se avisa,
  // en vez de calcular con un número basura.
  avisos: string[];
}

export function leerParametros(escalaRaw: unknown, tarifaRaw: unknown): ParametrosModelo {
  const avisos: string[] = [];
  let escala = ESCALA_DEFAULT;
  let tarifaPatrocinioMxn = TARIFA_PATROCINIO_DEFAULT_MXN;

  if (typeof escalaRaw === "string" && escalaRaw !== "") {
    const n = Number(escalaRaw);
    if ((ESCALAS as readonly number[]).includes(n)) {
      escala = n as Escala;
    } else {
      avisos.push(`Escala "${escalaRaw}" no válida — se usa ${ESCALA_DEFAULT} casos/mes.`);
    }
  }

  if (typeof tarifaRaw === "string" && tarifaRaw.trim() !== "") {
    const t = tarifaRaw.trim();
    const n = Number(t);
    if (/^\d+(\.\d{1,2})?$/.test(t) && n > 0 && n <= TARIFA_PATROCINIO_MAX_MXN) {
      tarifaPatrocinioMxn = n;
    } else {
      avisos.push(
        `Tarifa hipotética "${t}" no válida (mayor a $0 y hasta $${TARIFA_PATROCINIO_MAX_MXN.toLocaleString("es-MX")}, máximo 2 decimales) — se usa $${TARIFA_PATROCINIO_DEFAULT_MXN}.`
      );
    }
  }

  return { escala, tarifaPatrocinioMxn, avisos };
}

export type ResultadoModelo =
  | { estado: "ok"; modelo: Modelo }
  | { estado: "sin-datos" }
  | { estado: "error" };

// Todo sale de la base con la sesión de quien pide (RLS de su propia org),
// nunca de valores enviados por el cliente — la Feature 4 vuelve a llamar
// esta función en el servidor en vez de confiar en los números de la
// pantalla.
export async function cargarModelo(
  supabase: SupabaseClient,
  escala: Escala,
  tarifaPatrocinioMxn: number
): Promise<ResultadoModelo> {
  const [casosRes, logsRes, volumenRes] = await Promise.all([
    supabase.from("cases").select("id, case_type").returns<{ id: string; case_type: string }[]>(),
    supabase
      .from("case_time_logs")
      .select("case_id, minutes, hourly_rate_mxn")
      .returns<{ case_id: string; minutes: number; hourly_rate_mxn: number | string }[]>(),
    supabase
      .from("case_volume_scenarios")
      .select("case_type, monthly_cases")
      .eq("scale", escala)
      .returns<{ case_type: string; monthly_cases: number }[]>(),
  ]);

  const error = casosRes.error ?? logsRes.error ?? volumenRes.error;
  if (error) {
    console.error("cargarModelo: no se pudieron leer los datos", error);
    return { estado: "error" };
  }

  const logs = logsRes.data ?? [];
  const casos = (casosRes.data ?? []).map((c) => ({
    caseType: c.case_type,
    costoCentavos: costoCasoCentavos(logs.filter((l) => l.case_id === c.id)),
  }));

  const modelo = calcularModelo(
    escala,
    casos,
    (volumenRes.data ?? []).map((v) => ({ caseType: v.case_type, monthlyCases: v.monthly_cases })),
    Math.round(tarifaPatrocinioMxn * 100)
  );

  return modelo ? { estado: "ok", modelo } : { estado: "sin-datos" };
}
