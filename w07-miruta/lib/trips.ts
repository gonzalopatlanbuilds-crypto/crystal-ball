import { z } from "zod";
import type { Route } from "@/lib/routes";

export const TELEMETRY_LABELS = [
  { value: "consistent", label: "Consistente con manejo" },
  { value: "inconsistent", label: "Inconsistente — patrón estático/implausible" },
] as const;

export type TelemetryLabel = (typeof TELEMETRY_LABELS)[number]["value"];
const TELEMETRY_VALUES = TELEMETRY_LABELS.map((t) => t.value) as [
  TelemetryLabel,
  ...TelemetryLabel[],
];

export const STATUS_LABELS: Record<string, string> = {
  verified: "Verificado",
  flagged: "Marcado",
};

// Qué tan lejos puede estar la velocidad promedio que reporta la
// telemetría del teléfono de la velocidad que implica el tiempo real de
// viaje, antes de tratarse como una segunda señal de alerta independiente
// del chequeo de duración/geometría — así la telemetría de verdad influye
// en la decisión en vez de ser un campo capturado y nunca usado.
//
// 0.55, no 0.35: con 0.35, cualquier telemetría dentro del rango GENERAL
// de la ruta (20-28 km/h) podía marcarse solo por caer en el extremo
// opuesto de la duración reportada — el peor caso matemático es
// duración=55min con telemetría=28km/h (computedAvgSpeedKmh≈20.18,
// delta≈38.7%), y el persona test (Feature 5) lo confirmó con datos
// reales: 2 de 3 viajes de prueba se marcaron, incluyendo uno con
// velocidad "limpia" dentro del rango esperado. Eso rompe la promesa de
// "este reporte es tuyo" desde el primer uso. 0.55 dejan ~16 puntos de
// margen sobre ese peor caso (así que variación normal dentro del rango
// de la ruta nunca dispara el flag) y sigue marcando telemetría
// claramente implausible (ej. 5 km/h en un viaje de 47 min, delta≈79%).
const TELEMETRY_SPEED_TOLERANCE = 0.55;

export const tripInputSchema = z
  .object({
    startTime: z
      .string()
      .trim()
      .min(1, "La hora de inicio es requerida.")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Hora de inicio inválida."),
    endTime: z
      .string()
      .trim()
      .min(1, "La hora de fin es requerida.")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Hora de fin inválida."),
    telemetryAvgSpeedKmh: z.coerce
      .number({ invalid_type_error: "Velocidad promedio inválida." })
      .positive("La velocidad promedio debe ser mayor a 0."),
    telemetryLabel: z.enum(TELEMETRY_VALUES, {
      errorMap: () => ({ message: "Elige el resultado de la telemetría simulada." }),
    }),
  })
  .refine((data) => Date.parse(data.endTime) > Date.parse(data.startTime), {
    message: "La hora de fin debe ser posterior a la hora de inicio.",
    path: ["endTime"],
  });

export type TripInput = z.infer<typeof tripInputSchema>;

export type ParseTripResult =
  | { success: true; data: TripInput }
  | { success: false; error: string };

export function parseTripForm(formData: FormData): ParseTripResult {
  const result = tripInputSchema.safeParse({
    startTime: formData.get("start_time"),
    endTime: formData.get("end_time"),
    telemetryAvgSpeedKmh: formData.get("telemetry_avg_speed_kmh"),
    telemetryLabel: formData.get("telemetry_label"),
  });

  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return { success: true, data: result.data };
}

export interface TripEvaluation {
  durationMin: number;
  computedAvgSpeedKmh: number;
  status: "verified" | "flagged";
  flagReason: string | null;
}

// Única fuente de verdad para "¿este viaje cuenta?" — nunca un status
// precomputado en el cliente (mismo principio que calcularRiesgo en
// w05-timing-caf). Combina las dos señales del Dragon Stack de esta
// semana en una sola decisión, no como features separadas sin usar:
//   1. Geodata: duración real vs. el rango esperado de la ruta conocida.
//      Ese rango ya implica el rango de velocidad esperado, porque la
//      distancia de la ruta es fija — duración y velocidad promedio son
//      la misma variable vista desde dos ángulos, por eso no se checan
//      como dos condiciones independientes.
//   2. Telemetría: la etiqueta sintética del teléfono, y que la
//      velocidad promedio que reporta el teléfono no se aleje demasiado
//      de la velocidad que implica el tiempo real de viaje — si el
//      teléfono "vio" una velocidad muy distinta a la que el reloj
//      implica, es una señal de alerta aunque la duración sola pase.
export function evaluarViaje(route: Route, input: TripInput): TripEvaluation {
  const startMs = Date.parse(input.startTime);
  const endMs = Date.parse(input.endTime);
  const durationMin = (endMs - startMs) / 60000;
  const computedAvgSpeedKmh = route.distance_km / (durationMin / 60);

  const motivos: string[] = [];

  if (durationMin < route.expected_duration_min_low) {
    motivos.push(
      `muy corto para completar la ${route.name} (esperado ${route.expected_duration_min_low}-${route.expected_duration_min_high} min, reportado ${Math.round(durationMin)} min)`
    );
  } else if (durationMin > route.expected_duration_min_high) {
    motivos.push(
      `muy largo para la ${route.name} (esperado ${route.expected_duration_min_low}-${route.expected_duration_min_high} min, reportado ${Math.round(durationMin)} min)`
    );
  }

  if (input.telemetryLabel === "inconsistent") {
    motivos.push("telemetría del teléfono marcada como inconsistente");
  }

  const delta =
    Math.abs(input.telemetryAvgSpeedKmh - computedAvgSpeedKmh) / computedAvgSpeedKmh;
  if (delta > TELEMETRY_SPEED_TOLERANCE) {
    motivos.push(
      `velocidad de telemetría (${input.telemetryAvgSpeedKmh} km/h) no coincide con el tiempo reportado (~${computedAvgSpeedKmh.toFixed(1)} km/h esperada)`
    );
  }

  return {
    durationMin,
    computedAvgSpeedKmh,
    status: motivos.length === 0 ? "verified" : "flagged",
    flagReason: motivos.length ? motivos.join(" · ") : null,
  };
}
