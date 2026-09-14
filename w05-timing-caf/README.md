# Folio CAF

Semana 5 de Crystal Ball. Un resultado de tamizaje capturado en un CAF
(clínica adyacente a farmacia) se vuelve un registro portátil, propiedad
del paciente, que funciona sin smartphone, sin cuenta y sin identidad
digital previa — pensado desde el día uno para poder entrar al sistema de
salud público si llega la interoperabilidad (NOM-024). Ver
`docs/PACKET.md` para el spec completo.

## Seguridad — piso no negociable

- **Sin llaves en el código ni en el repo.** Las credenciales de Supabase
  y la `ANTHROPIC_API_KEY` viven en `.env.local` (ignorado por git) en
  desarrollo, y en las Environment Variables del dashboard de Vercel en
  producción.
- **Supabase Auth con Google solo para el operador del CAF.** La consulta
  pública del paciente (`/consulta`) nunca requiere login, cuenta, ni
  ninguna app — vive fuera del grupo de rutas protegido por auth desde el
  primer commit, para no envolverla por accidente.
- **Row Level Security en `screenings`** (desde la Feature 2): un operador
  de CAF solo puede ver los tamizajes que él mismo capturó.
- **Validación server-side en todo formulario** (desde la Feature 2): el
  valor de glucosa es numérico en un rango plausible, las respuestas del
  cuestionario son opciones cerradas, y la consulta pública por
  folio+apellido está limitada en tasa para evitar enumeración de folios.
- **Todos los datos de pacientes son inventados**, etiquetados en pantalla
  como "Datos simulados" — nunca nombres o datos personales reales.

## Estado actual: Feature 3 (consulta pública por folio + apellido)

Implementado: Feature 1 (auth), Feature 2 (captura + scoring + folio) y
Feature 3 — `/consulta` ahora busca de verdad. La única puerta pública de
lectura a `screenings` es la función de Postgres `security definer`
`consultar_tamizaje` (`sql/schema.sql`): filtra por folio **y** apellido
en el mismo `WHERE`, así que un folio real con apellido equivocado y un
folio inventado devuelven exactamente el mismo resultado (cero filas) —
`buscarTamizaje` (`app/consulta/actions.ts`) siempre responde con el
mismo mensaje genérico en ambos casos, y aplica un rate limit por IP
(`lib/rateLimit.ts`, 5 intentos/minuto) antes de consultar.

**Pendiente de que hagas tú (no puedo correr SQL en tu proyecto desde
aquí):**
- Correr el bloque de Feature 3 de `sql/schema.sql` en el SQL Editor de
  Supabase (crea la función `consultar_tamizaje` y sus grants).
- En `/consulta`, probar folio+apellido correctos (debe mostrar el
  resultado), y folio correcto con apellido equivocado / folio inventado
  (ambos deben dar el mismo "no encontrado").
- Probar el rate limit con 6+ búsquedas seguidas en menos de un minuto.

## Desarrollo local

```bash
npm install
npm run dev
```

## Deploy

Proyecto pensado para Vercel (free tier). Variables de entorno
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY`) se configuran en el dashboard de Vercel, nunca en el
repo.
