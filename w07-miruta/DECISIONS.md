# Decisiones — MiRuta (Week 7)

## 2026-09-23 — Feature 1: auth + shell vacío + ruta sembrada

**Qué cambió:** scaffold de Next.js 16 + Tailwind v4 + TS (mismo patrón
que w05-timing-caf/w06-evidenciapc), y el flujo de Supabase Auth con
Google usando `@supabase/ssr`: `proxy.ts` protege todas las rutas salvo
`/`, `/login`, `/auth/callback` y `/auth/signout`, redirigiendo a
`/login` si no hay sesión. `sql/schema.sql` crea `routes` (geometría fija
de Ruta 47: distancia, rango de duración esperada, rango de velocidad
promedio esperada) con RLS restringido a `authenticated` (sin policy de
insert/update/delete — la fila se siembra a mano corriendo el script en
el SQL Editor). El dashboard vacío muestra esa ruta sembrada.

**Una decisión de diseño que no estaba explícita en el packet:**
a diferencia de w06-evidenciapc, aquí **no hay concepto de organización**
— el packet describe una sola audiencia (el conductor) y el aislamiento
que pide el piso de seguridad es "cada conductor ve solo sus propios
viajes", no "miembros de la misma organización comparten datos". Por eso
se sigue el patrón más simple de w05-timing-caf (`operator_id` con RLS
directo por `auth.uid()`) en vez del patrón `orgs`/`profiles` de w06:
`trips` (Feature 2) tendrá `driver_id uuid references auth.users` con
policies `auth.uid() = driver_id`, sin tabla intermedia. `routes` es
geometría de referencia compartida (no un dato del conductor), así que su
policy de select es `to authenticated using (true)` en vez de filtrar por
dueño — pero sigue exigiendo sesión, para cumplir "ninguna tabla legible
sin auth" del piso de seguridad.

`app/page.tsx` solo decide sesión sí/no (`/login` o `/dashboard`) — sin
`/onboarding`, porque no hay perfil ni organización que crear.

**Piso de seguridad — estado tras Feature 1:**
1. Sin llaves en el repo — ✅ (`.env.local` ignorado,
   `.env.local.example` sin valores).
2. Google sign-in — ✅ desde este commit.
3. RLS en `routes` — ✅ (select solo `authenticated`, sin escritura desde
   el cliente). RLS en `trips` — ⏳ diferido a Feature 2 (la tabla no
   existe todavía).
4. Validación server-side — ⏳ diferido a Feature 2 (no hay formulario de
   viaje todavía).
5. Datos simulados etiquetados en pantalla — ✅ aviso en login y
   dashboard.
6. Deployment Protection de Vercel apagado — ⏳ pendiente de que
   configures el proyecto en Vercel (ver abajo); no puedo verificarlo
   sin URL de producción.

**Pendiente de que hagas tú (no puedo crear el proyecto de Supabase, el
cliente OAuth de Google, ni el proyecto de Vercel desde aquí):**
1. Crear un proyecto en [supabase.com](https://supabase.com), correr
   `sql/schema.sql` completo en el SQL Editor.
2. Configurar el provider de Google en Supabase (Authentication →
   Providers → Google), con credenciales OAuth de Google Cloud Console.
3. Copiar `.env.local.example` a `.env.local` y llenar
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` desde
   Project Settings → API.
4. `npm install && npm run dev`, confirmar que `/` sin sesión manda a
   `/login`, que el login con Google funciona, y que el dashboard muestra
   Ruta 47 con los rangos sembrados.
5. Crear el proyecto en Vercel con **Root Directory = `w07-miruta`**,
   agregar las dos variables de entorno, agregar la callback URL de
   producción a Redirect URLs en Supabase, y confirmar **Deployment
   Protection = OFF** en un incógnito sin sesión de Vercel.

**Siguiente movimiento (próxima sesión):** Feature 2 — pantalla de
registro de viaje (mockup 1) + `trips` table + chequeo de plausibilidad
(duración/velocidad reales vs. rango de `routes`, combinado con la señal
de telemetría simulada) que marca cada viaje verificado o flagged.

## 2026-09-23 — Feature 2: registro de viaje + chequeo de plausibilidad

**Qué cambió:** `sql/schema.sql` agrega `trips` (`driver_id`, `route_id`,
`start_time`/`end_time`, telemetría simulada, `status`/`flag_reason`) con
RLS `auth.uid() = driver_id` y sin policy de update/delete (registro
inmutable, mismo patrón que `screenings` en w05-timing-caf). `/trips`
(mockup 1) combina el formulario de registro con la lista de viajes del
conductor y el resumen "N verificados · M marcados".

`lib/trips.ts` (`evaluarViaje`) es la única fuente de verdad del status —
se calcula siempre en el server action (`app/(app)/trips/actions.ts`)
antes del insert, nunca confiado del cliente. Combina las dos señales del
Dragon Stack en una sola decisión, no como features separadas:
1. **Geodata:** duración real vs. rango esperado de la ruta sembrada.
   Duración y velocidad promedio son la misma variable vista desde dos
   ángulos (la distancia de la ruta es fija), así que no se checan como
   dos condiciones independientes — solo duración.
2. **Telemetría:** la etiqueta sintética ("consistente"/"inconsistente")
   marcada en el formulario, y que la velocidad promedio que reporta esa
   telemetría no se aleje más de 35% de la velocidad que implica el
   tiempo real de viaje. Un viaje con duración plausible pero telemetría
   que no cuadra igual queda marcado — así la telemetría de verdad pesa
   en la decisión.

Verificado a mano contra los números exactos del mockup 1 (no contra
Supabase real todavía, ver pendiente abajo): 47 min → dentro de
40–55 → verificado; 7 min → fuera de rango → "muy corto para completar
la Ruta 47 (esperado 40-55 min, reportado 7 min)", el mismo texto que
pide el mockup.

**Piso de seguridad — estado tras Feature 2:**
3. RLS en `trips` — ✅ (`auth.uid() = driver_id`, select+insert, sin
   update/delete).
4. Validación server-side — ✅ hora de inicio/fin requeridas y
   validadas como rango real (`lib/trips.ts`, zod) antes de calificar el
   viaje; el status nunca lo decide el cliente.

**Todavía no probado contra una base de datos real** — Feature 1 seguía
pendiente de que se conectara Supabase cuando se construyó esto (ver
sección anterior). No confirmes esta feature como probada hasta correr
el pase mecánico del packet con cuentas reales: viaje plausible →
verificado, viaje implausible → marcado y excluido del total, segundo
conductor no ve los viajes del primero.

**Siguiente movimiento (próxima sesión):** Feature 3 — reporte de
ingresos verificado (mockup 2): rango de fechas, conteo
verificados/marcados, ingreso estimado (viajes verificados × tarifa
promedio de la ruta), método de verificación visible en el reporte.

## 2026-09-23 — Feature 1 probado contra Supabase real: bug de OAuth encontrado y arreglado

**Qué pasó:** con `.env.local` ya lleno y el proyecto de Supabase creado,
el login con Google fallaba en cada intento, regresando a `/login` sin
ningún error visible en la UI. El log del dev server mostraba el error
real en cada uno:

```
GET /auth/callback?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code...
```

Fallaba desde el primer intento (no en un reintento), lo que descartaba
un código de un solo uso consumido dos veces — apuntaba a un mismatch
entre Google Cloud Console y Supabase, no a un bug de este repo (`proxy.ts`
y `app/auth/callback/route.ts` se comportaron como estaba diseñado:
redirigieron a `/login?error=auth` en vez de crashear).

**Causa raíz:** el "Authorized redirect URI" configurado en el OAuth
Client de Google Cloud Console no coincidía con la URL de callback que
Supabase realmente usa (`https://<project-ref>.supabase.co/auth/v1/callback`
— nunca `localhost:3000/auth/callback`, esa va en Redirect URLs del lado
de Supabase, que ya estaba bien). Se corrigió el redirect URI en Google
Cloud Console.

**Confirmado tras el fix:** login con Google completo en local
(`/auth/callback?code=...` → `/` → `/dashboard 200` en el log), y el
dashboard muestra la tarjeta de Ruta 47 con los datos reales leídos de
Supabase vía RLS (18.5 km, 40–55 min, 20–28 km/h) — confirma que
`sql/schema.sql` se corrió bien y que la policy de select de `routes`
funciona con una sesión real.

**Piso de seguridad — Feature 1, actualizado:**
3. RLS en `routes` — ✅ confirmado con datos reales (no solo revisado en
   el SQL), sesión real de Google leyendo la ruta sembrada.
6. Deployment Protection de Vercel — sigue ⏳, Vercel todavía no se ha
   configurado.

**No probado todavía:** el pase mecánico completo de Feature 2 contra
Supabase real (viaje plausible → verificado, viaje implausible →
marcado, segundo conductor no ve viajes del primero) — sigue pendiente,
independiente de este fix de login.

## 2026-09-23 — Feature 3: reporte de ingresos verificado

**Qué cambió:** `/report` (mockup 2) — formulario de rango de fechas
(`?from=&to=`, GET, sin JS) + tarjeta de reporte: chofer (nombre de
Google o email), ruta, periodo, "N verificados de M registrados", "K
marcados por inconsistencia no se incluyen", ingreso estimado, y la caja
de método de verificación. Botón "Descargar / Compartir" con
`window.print()` (mismo patrón que `PrintButton` de w05-timing-caf) en
vez de generar un PDF con una librería — cubre "descargable" y
"compartible" sin una dependencia nueva.

`sql/schema.sql` agrega `avg_fare_mxn` a `routes` vía `alter table` (la
tabla ya existe en producción desde la Feature 1, así que no podía ir en
el `create table`) — $150 MXN simulados por viaje verificado de Ruta 47,
mismo orden de magnitud que el mockup (124 × ~150 ≈ $18,600). Correr
`sql/schema.sql` completo de nuevo es seguro: es idempotente
(`add column if not exists`).

`lib/report.ts` (`calcularReporte`) es la única fuente de verdad del
total — filtra por `status === 'verified'` sobre los viajes que ya
trajo la query (nunca vuelve a evaluar plausibilidad), así que un viaje
marcado estructuralmente no puede colarse al ingreso estimado.

**Piso de seguridad — estado tras Feature 3:** sin cambios de fondo — el
reporte solo lee `trips`/`routes`, protegido por las mismas RLS de las
Features 1 y 2. Sigue pendiente únicamente Vercel (Deployment
Protection).

**Pendiente de que pruebes tú:** correr `sql/schema.sql` de nuevo en el
SQL Editor (para la columna `avg_fare_mxn`), luego el pase mecánico
completo: loguear un viaje verificado y uno marcado, confirmar que
`/report` cuenta solo el verificado en el total y en el ingreso
estimado, y confirmar que un segundo conductor no ve ni los viajes ni
el reporte del primero.

**Siguiente movimiento (próxima sesión):** Feature 4 — revisión del
lenguaje de `/trips` y `/report` contra la Condición 1 del Blueprint
(nunca debe leerse como vigilancia con etiqueta amigable), más una
explicación explícita del beneficio para el conductor en la pantalla de
registro.

## 2026-09-23 — Feature 3, hallazgo del pase mecánico: telemetría marcada por sorpresa

**Qué pasó:** probando el pase mecánico, un viaje de 55 min con
telemetría de 28 km/h se marcó — pero 28 está dentro del rango general
de la ruta (20-28 km/h), así que a primera vista parecía un bug.

**No era un bug de cálculo:** `evaluarViaje` compara la telemetría
contra la velocidad que implica LA DURACIÓN de ESE viaje específico
(`distance_km / duración`), no contra el rango general de la ruta —
55 min a 18.5 km implica ~20.2 km/h, y 28 está 38.6% por encima de eso
(tolerancia: 35%). Es matemáticamente correcto y es justo el cruce de
señales que pide el Dragon Stack ("telemetría... como señal secundaria
junto al GPS"): a 28 km/h reales por 55 min se recorrerían ~25.7 km, no
18.5 — las dos señales sí son físicamente inconsistentes entre sí,
aunque cada una por separado caiga dentro de "lo plausible para la
ruta en general".

**Lo que sí estaba mal:** nada en la pantalla explicaba esa distinción,
así que un conductor de prueba razonablemente asume que "cualquier
número dentro del rango de la ruta" debería pasar. Se agregó una nota
bajo el campo de velocidad de telemetría en `TripForm` explicándolo con
el mismo ejemplo numérico. La lógica de `evaluarViaje` no cambió — se
decidió con el usuario mantener el cross-check real en vez de
simplificarlo al rango general (que sería más predecible pero dejaría
de cruzar las dos señales de verdad entre sí) o subirle la tolerancia.

## 2026-09-23 — Vercel desplegado

Deployment Protection confirmado apagado por el usuario en incógnito
sin sesión de Vercel activa. Piso de seguridad punto 6 (item 6 de la
Feature 1) — ✅ completo. No se registró la URL de producción aquí (no
es información persistente del proyecto en sí, vive en el dashboard de
Vercel/GitHub).

## 2026-09-23 — Feature 4: revisión driver-first del lenguaje

**Qué cambió:** revisión de `/dashboard`, `/trips` y `/report` contra la
Condición 1 del Blueprint ("el sistema no puede pedirle datos al
conductor solo para que alguien más los vea"). Dos cambios de copy, cero
cambios de lógica:

1. **`/trips` no explicaba el beneficio antes de pedir los datos** — el
   conductor llegaba a un formulario pidiendo hora de inicio/fin y
   telemetría sin que la pantalla dijera para qué. Se agregó un párrafo
   arriba del formulario: qué construye cada viaje registrado (su propio
   historial de ingresos), para qué sirve después (crédito, renta,
   arrendamiento), y quién más lo ve (nadie — sin dueño de ruta ni
   supervisor mirando la pantalla).
2. **`/dashboard` decía "se marcará para revisión"** — un viaje
   implausible no pasa por ninguna revisión humana en este sistema (todo
   el chequeo es automático, `evaluarViaje`), así que esa frase sugería
   falsamente un supervisor mirando cada viaje marcado. Se corrigió a
   "se excluye automáticamente... sin que nadie más lo revise" — más
   preciso Y más alineado con Condición 1 en el mismo cambio.

`/report` y `/login` ya framaban bien (reporte explícitamente "tuyo",
método de verificación visible, sin lenguaje de vigilancia) — no se
tocaron.

**Piso de seguridad:** sin cambios — Feature 4 es puramente de copy.

**Siguiente movimiento (próxima sesión):** Feature 5 — pase mecánico
completo documentado (bug de OAuth y el hallazgo de telemetría ya
cuentan como bugs encontrados/arreglados de esta semana), persona test
Layer 1 con las capturas de `/trips` y `/report`, y confirmar que el
deploy de Vercel refleja el estado final tras cualquier fix.
