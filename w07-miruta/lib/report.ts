import type { Route } from "@/lib/routes";

export interface TripStatusRow {
  status: "verified" | "flagged";
}

export interface IncomeReport {
  totalTrips: number;
  verifiedTrips: number;
  flaggedTrips: number;
  estimatedIncomeMxn: number;
}

// El total de ingresos SOLO cuenta viajes verificados — un viaje marcado
// nunca entra al cálculo, ni siquiera parcialmente. La única fuente de
// verdad de qué cuenta como "verificado" sigue siendo evaluarViaje en
// lib/trips.ts (ya decidido al momento de guardar el viaje); este archivo
// nunca vuelve a evaluar plausibilidad, solo agrega lo que ya se decidió.
export function calcularReporte(trips: TripStatusRow[], route: Route): IncomeReport {
  const verifiedTrips = trips.filter((t) => t.status === "verified").length;
  return {
    totalTrips: trips.length,
    verifiedTrips,
    flaggedTrips: trips.length - verifiedTrips,
    estimatedIncomeMxn: verifiedTrips * route.avg_fare_mxn,
  };
}

export function formatearMXN(amount: number): string {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });
}

export function formatearFechaCorta(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function primerDiaDelMes(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
