# Decisiones — Evidencia PC (Week 6)

## 2026-09-17 — Feature 1: auth + organizaciones + shell vacío

**Qué cambió:** scaffold de Next.js 16 + Tailwind v4 + TS (mismo patrón
que w04-proof-of-skill/w05-timing-caf), y el flujo de Supabase Auth con
Google usando `@supabase/ssr`: `proxy.ts` protege todas las rutas salvo
`/`, `/login`, `/auth/callback` y `/auth/signout`, redirigiendo a
`/login` si no hay sesión.

Dos decisiones que no estaban explícitas en el packet, resueltas con el
usuario antes de escribir código (quedaron en el plan aprobado):

1. **Organizaciones con código de invitación.** El packet solo tiene 2
   mockups (loguear hallazgo, revisión de verificador) y ninguno muestra
   una pantalla de "elegir organización" — pero el piso de seguridad pide
   RLS por "organización escolar propia", y probar eso de verdad necesita
   una segunda organización real, no solo una simulada por SQL a mano. Se
   agregó `/onboarding`: tras el primer login con Google, quien no tiene
   perfil todavía puede "Crear organización" (genera un código corto,
   ej. `ABC-234`) o "Unirme con código" (pega el código de alguien más).
   Dos tablas nuevas: `orgs` (nombre + `join_code` único) y `profiles`
   (liga `auth.users` a un `org_id`). Ninguna de las dos tiene policy de
   insert — la única puerta de escritura son dos funciones
   `security definer`, `create_org()` y `join_org()`
   (`sql/schema.sql`), mismo patrón de "función controlada como única
   puerta" que `consultar_tamizaje()` en w05.
2. **Sin verificador pre-asignado.** El mockup 1 solo pide descripción,
   acción correctiva, owner y fecha límite — no un campo de verificador.
   Se decidió que cualquier miembro de la organización que no sea el
   owner puede revisar un cierre pendiente; la regla owner≠verificador se
   valida en el momento de aprobar/rechazar (Feature 4), no contra un
   campo pre-asignado. Queda anotado aquí porque cambia cómo se lee la
   Feature 3 del prompt original del usuario.

`app/(app)/layout.tsx` es el grupo de rutas protegido — revisa sesión
*y* que ya exista un `profile` (si no, manda a `/onboarding`), defensa en
profundidad además del middleware. `app/page.tsx` nunca renderiza nada:
solo decide a dónde mandar a quien llega (`/login`, `/onboarding` o
`/dashboard`) según sesión y perfil — a diferencia de w05, aquí hay una
sola audiencia (todos entran con Google, el rol es solo la acción que
toman), así que no hace falta una landing con dos links.

**Piso de seguridad — estado tras Feature 1:**
1. Sin llaves en el repo — ✅ (`.env.local` ignorado,
   `.env.local.example` sin valores).
2. Google sign-in para todos — ✅ desde este commit.
3. RLS en `orgs`/`profiles` — ✅ (policies de select por `org_id`
   propio, sin insert directo). RLS en `findings`/`closures` — ⏳
   diferido a Feature 2 (las tablas no existen todavía).
4. Validación server-side — ✅ nombre de org y formato de join_code
   (`lib/orgs.ts` + los `check` de `sql/schema.sql`). El resto (campos
   de hallazgo, foto de cierre) diferido a Features 2 y 3.
5. Datos simulados etiquetados en pantalla — ✅ aviso en login,
   onboarding y dashboard.
6. Owner nunca puede ser también verificador — ⏳ diferido a Feature 4
   (no hay `findings`/`closures` todavía).

**Pendiente de que hagas tú (no puedo crear el proyecto de Supabase ni
el cliente OAuth desde aquí):**
- Crear el proyecto de Supabase (nuevo o reusado) y el cliente OAuth de
  Google (Authentication → Providers → Google).
- Correr el bloque de Feature 1 de `sql/schema.sql` completo en el SQL
  Editor de Supabase (crea `orgs`, `profiles`, `create_org()`,
  `join_org()`).
- Llenar `.env.local` desde `.env.local.example`.
- Confirmar sign-in real end-to-end en local: Google → aterriza en
  `/onboarding` (primera vez) → crear una organización → ver el código
  → "Ir al panel" → `/dashboard` vacío.
- Con una segunda cuenta de Google de prueba, confirmar que "Unirme con
  código" usando el código de la primera cuenta la mete a la misma
  organización (mismo nombre de org en el header).

**Primer movimiento de la próxima sesión:** Feature 2 (pantalla de
captura del hallazgo crítico — mockup 1 — con tabla `findings` y su
RLS).
