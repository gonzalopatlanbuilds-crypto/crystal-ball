# Decisiones — Libro Abierto (Week 10)

## 2026-10-18 — Feature 1: base, auth y schema (RLS, my_org_id, revokes)

**Qué cambió:** scaffold copiado de la base probada de w09-first-proof
(`proxy.ts`, `lib/supabase/*`, callback/signout de Google con logs por
motivo, `create_org`/`join_org` con código `ABC-234`, reenvío de `?code=`
de `/` a `/auth/callback`). Rutas: `/login` (Google con
`prompt: 'select_account'`), `/onboarding` (crear organización o unirse
con código), `/modelo` protegida (middleware + layout: sin sesión →
`/login`, sin organización → `/onboarding`) y "Cerrar sesión" (POST →
303 a `/login`, el fix de w09). `/financiamiento` ya está en la lista de
rutas públicas del middleware; la página llega en la Feature 4.

**Schema (`sql/schema.sql`), las 5 tablas del prompt desde el inicio, todas
con RLS:**

- `organizations`, `profiles`: lectura solo de la propia org vía
  `my_org_id()` (security definer; ninguna policy de `profiles` consulta
  `profiles`). Sin ningún privilegio de escritura para el cliente:
  `create_org()`/`join_org()` son la única puerta.
- `assumptions` (`key`, `value_num`, `unit`, `status` enum
  `sustained|weak|invented`, `source_url`, `source_date`, `note`,
  `org_id`): CRUD solo dentro de la propia org. La regla "sustained exige
  fuente" llega en la Feature 2.
- `payer_evidence`: lectura e inserción en la propia org. `recorded_by`
  lo pone la base (`default auth.uid()`) y el cliente no tiene permiso de
  escribir esa columna; la policy además exige `recorded_by = auth.uid()`.
  Sin update/delete por ahora (se decide en la Feature 4).
- `published_ledger`: la única tabla que `anon` puede leer. `authenticated`
  lee solo la de su org. Nadie puede escribir todavía (la puerta de
  publicación y la inmutabilidad llegan en la Feature 4).
- `revoke all ... from anon` en todas las tablas privadas, no solo RLS:
  defensa en profundidad (si alguien apaga el RLS de una tabla por
  error, anon sigue sin leerla — lo confirmó la prueba de mutación de
  abajo).
- Toda función: `revoke all ... from public, anon`; `generar_join_code()`
  también de `authenticated` (solo la usa `create_org()`).

**Prueba mecánica (`npm run test:schema`), real, no inspección:**
`sql/schema.sql` corrido dos veces (idempotente) en PGlite (Postgres en
WASM) con stub de Supabase: roles, `auth.uid()`/`auth.jwt()` y los
default privileges que le dan EXECUTE y ALL a anon en objetos nuevos (la
causa del bug de w08). **38/38**: crear/unirse, no cambiar de org,
aislamiento entre dos orgs en las 5 tablas (lectura y escritura), anon
solo lee `published_ledger` y no escribe nada, anon no ejecuta ninguno
de los 4 RPCs, y dos chequeos genéricos que no dependen de una lista a
mano: **ninguna función de `public` es ejecutable por anon** y **toda
tabla de `public` tiene RLS**.

Prueba de que la prueba detecta fallas: se reintrodujeron a propósito 3
bugs (revocar `create_org` solo de `public` como en w08, apagar RLS de
`payer_evidence`, quitar el revoke de anon en `assumptions`) → 5 FAIL,
exactamente esos. Schema restaurado → 38/38.

**Rutas por HTTP:** con `BASE_URL`, la misma prueba pide `/login` y
`/modelo` sin cookies. Local (`next start` con una URL de Supabase falsa:
sin cookies, `getUser()` no sale a la red): **40/40**, `/login` → 200,
`/modelo` → 307 a `/login`. Ese build se borró después.

**`npm run test:logica`: 15/15** (código de organización: normalización
`abc234` → `ABC-234`, forma `ABC-234` sin 0 ni 1, nombre de 2–120
caracteres). Una primera versión de la prueba esperaba que `ABI-234` se
rechazara y falló: el error era de la prueba, no del código. El regex
valida solo la forma (`[A-Z2-9]` incluye I y O); el generador nunca las
produce, así que un código con I da "Código no encontrado", que es lo
correcto. Se corrigió la prueba.

**Lint y build limpio (`rm -rf .next && npm run build`): sin errores ni
warnings.**

**Lo que NO está probado todavía:** nada contra Supabase real ni en
producción — login de Google, Redirect URLs, `scripts/probar-anon.sh`
con la llave pública real, Deployment Protection. PGlite no es Supabase
(no hay PostgREST ni GoTrue). Se prueba en el deploy 1 (después de la
Feature 4, según el plan de commits).

**Siguiente paso:** Feature 2 (registro de supuestos).

## 2026-10-18 — Fórmula del ingreso por suscripción: sin /12

**Decisión (confirmada por Gonzalo):** ingreso mensual por suscripción =
estudiantes atendidos al año × conversión × precio mensual.

1. **El `/12` del prompt de implementación no cuadraba con las unidades y
   se quitó.** El precio ya es mensual (MXN 49 / mes): dividir entre 12
   solo tendría sentido si el precio fuera anual. Con `/12` el ingreso
   daba MXN 245 / mes y contradecía el mockup del operador.
2. **La fórmula supone que los 60 suscriptores (2,000 × 3%) pagan todos
   los meses del año.** Es un supuesto inventado, no un dato: no hay
   evidencia de retención ni de que algún estudiante pague.
3. **Unidad de cada insumo:**
   - estudiantes atendidos: estudiantes por año
   - conversión a suscripción: porcentaje (3 = 3%)
   - precio: MXN por mes

Con los valores sembrados (todos `invented`):

- Costo mensual = 40 h × MXN 150 + MXN 1,000 + MXN 500 = **MXN 7,500**
- Ingreso mensual = 2,000 × 3% × MXN 49 = **MXN 2,940**
- Faltante = 7,500 − 2,940 = **MXN 4,560**

Coincide con el mockup. La prueba con estos tres valores ya está escrita
pero **fuera del repo y sin commit**: importa `lib/modelo.ts`, que no
existe hasta la Feature 3, y rompería `test:logica` y el typecheck del
build. Entra a `test:logica` en la Feature 3. Regla: ningún commit deja `test:logica` en rojo.

## 2026-10-18 — Chequeo 10:1: pérdida evitada vs. lo que paga el suscriptor

**Decisión (confirmada por Gonzalo):** el 10:1 compara la **pérdida
evitada por suscriptor al año** (MXN por suscriptor por año) contra **lo
que paga el suscriptor al año**: MXN 49 × 12 = **MXN 588**. Se cumple si
pérdida evitada ≥ 10 × 588.

- **El 588 supone que el suscriptor paga los 12 meses.** Mismo supuesto
  inventado que el ingreso (no hay evidencia de retención).
- **El costo por estudiante atendido (MXN 7,500 × 12 ÷ 2,000 = MXN 45 al
  año) se muestra por separado, como costo**, y no entra al 10:1. Son
  preguntas distintas: el 10:1 es "¿le conviene pagar a quien paga?", el
  costo por estudiante es "¿cuánto cuesta operar?".
- **El umbral se muestra aunque falte el insumo:** "para cerrar el 10:1,
  cada suscriptor tendría que evitar MXN 5,880 al año". El umbral sale
  solo del precio, que sí existe.
- **Sin el insumo de pérdida evitada, el resultado del 10:1 sigue siendo
  "no calculable".** Nunca se inventa ni se usa un valor por defecto.

## 2026-10-18 — Regla de push

Cada feature se sube cuando pasa sus pruebas, **excepto si cambia el
esquema de Supabase: entonces no hay push hasta que Gonzalo confirme que
corrió `sql/schema.sql`.** Antes de cada push: build, lint y pruebas en
verde; ningún `.env` en el commit; se muestran `git status` y
`git log -1`.

La Feature 1 crea el esquema completo, así que su push espera a que
exista el proyecto de Supabase y se haya corrido el SQL.
