# Decisiones — Folio CAF (Week 5)

## 2026-09-13 — Feature 1: auth + shell vacío

**Qué cambió:** scaffold de Next.js 16 + Tailwind v4 + TS (mismo patrón
que w04-proof-of-skill), y el flujo de Supabase Auth con Google usando
`@supabase/ssr`: `proxy.ts` protege todas las rutas salvo `/`, `/login`,
`/auth/callback` y todo el árbol de `/consulta`, redirigiendo a `/login`
si no hay sesión. `app/(caf)/layout.tsx` + `app/(caf)/dashboard/page.tsx`
son el grupo de rutas protegido (defensa en profundidad: el layout también
revisa la sesión server-side, no solo el middleware). `/consulta` vive
**fuera** de ese grupo de rutas a propósito, para que nunca quede envuelta
por accidente en el auth check — solo tiene el shell visual por ahora, la
Feature 3 le pone la lógica real.

**Por qué la landing (`/`) es pública y no redirige directo a
`/dashboard` como en w04:** este producto tiene dos audiencias desde el
día uno (operador de CAF y paciente sin cuenta), a diferencia de w04 que
solo tenía empleadores. Una landing con dos links deja explícito que
"paciente sin login" no es un caso especial, es la mitad del producto.

**Piso de seguridad — estado tras Feature 1:**
1. Sin llaves en el repo — ✅ (`.env.local` ignorado, `.env.local.example`
   sin valores).
2. Google sign-in solo para operador, `/consulta` sin login — ✅ desde
   este commit.
3. RLS en `screenings` — ⏳ diferido a Feature 2 (la tabla no existe
   todavía).
4. Validación server-side (glucosa, cuestionario, rate-limit de
   consulta) — ⏳ diferido a Features 2 y 3 (no hay formularios con datos
   reales todavía).
5. Datos simulados etiquetados en pantalla — ⏳ diferido a Feature 2 (no
   hay datos de pacientes todavía).

**Pendiente de que hagas tú (no puedo crear el proyecto de Supabase ni el
cliente OAuth desde aquí):**
- Crear el proyecto de Supabase (nuevo o reusado) y el cliente OAuth de
  Google.
- Llenar `.env.local` desde `.env.local.example`.
- Confirmar sign-in real end-to-end en local y que `/consulta` carga sin
  sesión.

**Primer movimiento de la próxima sesión:** una vez confirmes sign-in y
`/consulta` público, seguimos con Feature 2 (pantalla de captura del CAF +
tabla `screenings` con RLS + scoring por reglas + generación de folio).
