# Decisiones — Proof of Skill (Week 4)

## 2026-09-06 — Feature 1: auth + shell vacío

**Qué cambió:** scaffold de Next.js 16 + Tailwind v4 + TS (mismo patrón que
w02/w03), y el flujo completo de Supabase Auth con Google usando
`@supabase/ssr`: `proxy.ts` (convención actual de Next 16 — `middleware.ts`
está deprecado) protege todas las rutas salvo `/login` y `/auth/callback`,
redirigiendo a `/login` si no hay sesión y a `/dashboard` si ya la hay.
`app/dashboard/page.tsx` es el shell vacío autenticado. Commit `f593713`,
pusheado a `origin/main`.

**Por qué:** el packet (Condición 1: confianza del empleador desde el día
uno) exige que Row Level Security separe de verdad los datos de cada
empleador — eso solo es verificable con autenticación real, no con el
fallback de `localStorage` que usamos en w02/w03 cuando Supabase estaba
caído. Aquí Supabase Auth + RLS no son un detalle técnico, son el mecanismo
que la Feature 2 va a probar (que un segundo empleador no vea los datos del
primero).

**Cerrado:** el usuario creó el proyecto de Supabase y el cliente OAuth de
Google, y confirmó sign-in real end-to-end en local (selecciona cuenta →
confirma correo → aterriza en `/dashboard` con su email). Feature 1
verificada.

## 2026-09-06 — Alcance de Feature 4: el LLM solo redacta, nunca decide

**Qué cambió (decisión de alcance, sin código todavía):** se reincorpora la
fila "AI layer" del packet, pero acotada: una llamada a un LLM en Feature 4
que **únicamente redacta el texto explicando por qué un criterio quedó
borderline**. El score ponderado y el umbral que decide si algo se marca
"Flagged for human review" siguen siendo 100% lógica de reglas pura (sin
IO, determinística, testeable a mano) — el LLM nunca calcula el score ni
decide el flag, solo genera la frase que se le muestra al empleador junto
al resultado, etiquetada en pantalla como "AI-generated, simulated".

**Por qué:** así lo pidió el usuario explícitamente, para no romper el
piso de seguridad ("no AI grading engine") ni el Condition 2 del Blueprint
(ningún resultado borderline se auto-certifica) — la IA describe, no
decide.

**Implicación de seguridad a resolver cuando se construya:** esto agrega
una llamada de servidor a una API de LLM, o sea una nueva credencial
(API key) que debe vivir solo en variables de entorno de Vercel — nunca en
el cliente ni en el repo — y la llamada debe hacerse server-side (route
handler o server action), no desde el navegador.

## 2026-09-06 — Feature 2: criteria builder + RLS

**Qué cambió:** tabla `criteria_sets` (`sql/schema.sql`) con RLS —
policies separadas para select/insert/update/delete, todas comparando
`auth.uid() = employer_id`, más un CHECK a nivel de base de datos
(`criteria` debe ser un array jsonb de al menos 3 elementos) como respaldo,
no como la validación principal. Pantallas `/criteria/new` y
`/criteria/[id]` (mockup 1 del packet) construidas sobre un componente
compartido `CriteriaBuilder` — permite agregar/editar/quitar criterios
antes de guardar — y server actions (`createCriteriaSet`,
`updateCriteriaSet`) que validan con zod (`lib/criteria.ts`) antes de
tocar la base de datos: peso entero 0–100, etiqueta máximo 80 caracteres,
mínimo 3 criterios. `/dashboard` ahora lista los roles guardados del
empleador en sesión.

**Por qué el peso es un input de texto y no solo un slider:** la Feature 2
pide explícitamente que un peso no numérico dispare un error visible — un
`<input type="number">` nativo bloquea letras en silencio (nunca dispara
ese error), así que el campo de peso es texto libre validado a mano
(cliente y servidor), con un slider al lado como atajo visual sincronizado
al mismo estado.

**Decisión de esquema:** los criterios viven como un array `jsonb` dentro
de la fila `criteria_sets`, no en una tabla aparte — así lo describe la
tabla de arquitectura del packet (solo `criteria_sets` y
`candidate_scores`), y no hay necesidad de un criterio con vida propia
fuera de su set en este slice.

**Pendiente de que hagas tú (no puedo correr SQL en tu proyecto desde
aquí):**
- Correr `sql/schema.sql` completo en el SQL Editor de Supabase.
- Crear un rol con 3+ criterios y confirmar que persiste al recargar.
- Crear una segunda cuenta de Google de prueba y confirmar que no ve los
  `criteria_sets` de la primera (ni en `/dashboard` ni entrando directo a
  la URL de edición — debe dar 404).

**Primer movimiento de la próxima sesión:** una vez confirmes RLS con las
dos cuentas de prueba, seguimos con Feature 3 (datos simulados de
candidatos + scoring ponderado contra un `criteria_sets`).
