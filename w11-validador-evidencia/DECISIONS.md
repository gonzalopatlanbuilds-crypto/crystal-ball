# Decisiones — Validador de Evidencia de Empaque (Week 11)

## 2026-10-25 — Decisiones de alcance antes de escribir código

El prompt dice "si algo no está claro, detente y pregunta". Dos huecos del
packet cambian el motor de la Feature 3, así que se preguntaron antes de
empezar (respuestas de Gonzalo):

1. **¿Qué es la "última evidencia aceptada" de un SKU?** El packet no lo
   define. Decisión: la primera carga es la base. Una fila posterior de un
   SKU+proveedor pasa a ser la aceptada cuando no produjo ningún hallazgo,
   o cuando quien revisa **descartó** todos sus hallazgos (descartar = "no
   es un problema real, toma el valor nuevo"). Un hallazgo **confirmado**
   significa que el valor nuevo NO se acepta: la referencia sigue siendo el
   valor anterior. No hace falta un botón extra de "aceptar versión" (eso
   sería alcance que el prompt no pide).
2. **Duplicado de folio.** Literalmente, "un folio que aparece en más de
   una versión" marcaría todas las filas que no cambiaron cada vez que un
   proveedor reenvía su archivo (mismo SKU, mismo folio). Decisión: se
   marca `possible_duplicate` cuando un folio ya usado en una versión
   anterior aparece en **otro SKU u otro proveedor**, o cuando se repite
   dentro de la misma carga. Una fila que se reenvía con el mismo
   SKU+proveedor+folio es la misma prueba, no una reutilización. La prueba
   4 del packet sigue funcionando (reutilizar un folio viejo en otro SKU).

## 2026-10-25 — Feature 1: base, auth y schema (RLS, my_org_id, revokes)

**Qué cambió:** scaffold copiado de la base probada de w10-libro-abierto
(`proxy.ts`, `lib/supabase/*`, callback/signout de Google con logs por
motivo, `create_org`/`join_org` con código `ABC-234`, reenvío de `?code=`
de `/` a `/auth/callback`, signout POST → 303). Rutas: `/login` (Google con
`prompt: 'select_account'`), `/onboarding` (crear organización o unirse con
código), `/validador` protegida (middleware + layout: sin sesión →
`/login`, sin organización → `/onboarding`) y "Cerrar sesión". No hay
ninguna página pública con datos: `RUTAS_PUBLICAS` solo tiene `/`,
`/login` y las dos rutas de auth. Aviso fijo de datos simulados
(`lib/avisos.ts`) en login, onboarding, error, 404 y todo `/validador`.

**Schema (`sql/schema.sql`), las 5 tablas desde el inicio, todas con RLS:**

- `organizations`, `profiles`: lectura solo de la propia org vía
  `my_org_id()` (security definer; ninguna policy de `profiles` consulta
  `profiles`). Sin escritura del cliente: `create_org()`/`join_org()` son
  la única puerta.
- `evidence_versions` (id, org_id, uploaded_by, uploaded_at,
  source_filename, raw_rows jsonb + `invalid_rows`, `content_sha256`,
  `is_example`). Las filas válidas guardan su número de fila del archivo
  original: archivo + fila + quién + cuándo = procedencia de cada valor.
- `findings` (org_id, evidence_version_id, type con check de los 4 tipos,
  sku, supplier, details jsonb, status `pending|confirmed|discarded`
  default `pending`, created_at).
- `decisions` (org_id, finding_id, decided_by, decision
  `confirmed|discarded`, note con check `btrim(note)` de 1 a 1000
  caracteres, decided_at).
- Por ahora el cliente solo **lee** su org en las 3 tablas nuevas; no hay
  ningún privilegio de insert/update/delete para `authenticated` ni para
  `anon`. Las puertas de escritura llegan con su feature (carga en la 2,
  hallazgos en la 3, decisiones en la 4): así nada queda escribible "por
  si acaso" antes de tener su validación.
- `revoke all ... from anon` en todas las tablas, además de RLS (defensa en
  profundidad). Toda función: `revoke all ... from public, anon`;
  `generar_join_code()` también de `authenticated`.

**Prueba mecánica (`npm run test:schema`), real, no inspección:** schema
corrido dos veces (idempotente) en PGlite con stub de Supabase (roles,
`auth.uid()`/`auth.jwt()`, default privileges que dan EXECUTE/ALL a anon).
**48/48**: crear/unirse, no cambiar de org, aislamiento entre dos orgs en
las 5 tablas (C no ve nada de A; B, de la misma org, sí), el cliente no
puede escribir ninguna de las 3 tablas nuevas, anon no lee ni escribe
nada, anon no ejecuta ningún RPC, y dos chequeos genéricos: **ninguna
función de `public` es ejecutable por anon** y **toda tabla de `public`
tiene RLS**. Además: nota de puros espacios, tipo de hallazgo inventado
(`cumple`) y estado inventado (`resuelto`) los rechaza la base.

Prueba de que la prueba detecta fallas: se reintrodujeron a propósito 3
bugs (revocar `create_org` solo de `public` como en w08, apagar RLS de
`findings`, quitar el revoke de anon en `evidence_versions`) → 5 FAIL,
exactamente esos. Schema restaurado → 48/48.

**Rutas por HTTP:** build limpio (`rm -rf .next && npm run build`, lint sin
warnings), `next start` con una URL de Supabase falsa (sin cookies,
`getUser()` no sale a la red) y `BASE_URL=http://localhost:3111 npm run
test:schema`: **50/50**, `/login` → 200, `/validador` → redirect a
`/login`. Ese build se borró después.

**Falta para cerrar la Feature 1 (no verificado todavía):** proyecto de
Supabase nuevo para esta semana, proveedor Google, correr `sql/schema.sql`
y `bash scripts/probar-anon.sh` con la llave pública real.
