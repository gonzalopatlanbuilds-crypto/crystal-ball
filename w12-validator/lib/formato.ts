// Fechas siempre en hora de Ciudad de México, sin depender de la zona del
// servidor (Vercel corre en UTC).
const FECHA_HORA = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function fechaHora(iso: string): string {
  return FECHA_HORA.format(new Date(iso));
}
