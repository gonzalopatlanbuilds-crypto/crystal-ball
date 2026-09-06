# Decisiones — Proof of Skill (Week 4)

## 2026-09-06 — Feature 1: auth + shell vacío

**Qué cambió:** scaffold de Next.js 16 + Tailwind v4 + TS (mismo patrón que
w02/w03), y el flujo completo de Supabase Auth con Google usando
`@supabase/ssr`: `middleware.ts` protege todas las rutas salvo `/login` y
`/auth/callback`, redirigiendo a `/login` si no hay sesión y a `/dashboard`
si ya la hay. `app/dashboard/page.tsx` es el shell vacío autenticado.

**Por qué:** el packet (Condición 1: confianza del empleador desde el día
uno) exige que Row Level Security separe de verdad los datos de cada
empleador — eso solo es verificable con autenticación real, no con el
fallback de `localStorage` que usamos en w02/w03 cuando Supabase estaba
caído. Aquí Supabase Auth + RLS no son un detalle técnico, son el mecanismo
que la Feature 2 va a probar (que un segundo empleador no vea los datos del
primero).

**Sin resolver / requiere acción tuya (no puedo hacerlo desde aquí):**
- Crear el proyecto de Supabase (nuevo, recomendado, para no heredar el
  historial de fallos del proyecto "semestre").
- Crear las credenciales OAuth de Google en Google Cloud Console y
  configurarlas en Supabase Auth → Providers → Google.
- Llenar `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Probar el sign-in real con Google en el navegador (no puedo hacer OAuth
  interactivo desde este entorno).
- Ver instrucciones paso a paso en README.md.

**Primer movimiento de la próxima sesión:** una vez que confirmes que el
sign-in con Google funciona localmente y en Vercel, seguimos con Feature 2
(pantalla de criterios ponderados + tabla `criteria_sets` con RLS).
