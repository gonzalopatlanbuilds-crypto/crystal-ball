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
