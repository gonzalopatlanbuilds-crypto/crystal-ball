// Rate limiter en memoria del proceso — suficiente para el alcance de
// esta semana (así lo permite el implementation prompt), pero con una
// limitación real que hay que tener presente: en Vercel cada instancia
// serverless tiene su propia memoria, así que esto NO comparte el conteo
// entre instancias ni sobrevive un cold start. Para producción de verdad
// esto tendría que vivir en una tabla de Supabase o en Upstash Redis,
// compartido entre instancias. Documentado como límite conocido, no un
// bug oculto.

const VENTANA_MS = 60_000;
const MAX_INTENTOS_POR_VENTANA = 5;

const intentosPorClave = new Map<string, number[]>();

export function excedeLimite(clave: string): boolean {
  const ahora = Date.now();
  const historial = (intentosPorClave.get(clave) ?? []).filter(
    (marca) => ahora - marca < VENTANA_MS
  );
  historial.push(ahora);
  intentosPorClave.set(clave, historial);
  return historial.length > MAX_INTENTOS_POR_VENTANA;
}
