# Decisiones — First Proof (Week 9)

## 2026-10-11 — Feature 1: auth + organización + shell phone-first, y piso de seguridad completo

**Qué cambió:** scaffold copiado de la base probada de w08-costoreal
(`proxy.ts`, `lib/supabase/*`, callback/signout de Google, `orgs`/
`profiles`/`my_org_id()`, onboarding crear-organización / unirme-con-código,
reenvío de `?code=` de `/` a `/auth/callback`). Layout protegido de ancho
de teléfono (`max-w-md`) con el aviso fijo "Práctica con caso ficticio. No
es trabajo real ni garantiza empleo. No pagas nada." y el de "Datos
simulados" en todas las pantallas protegidas (`lib/avisos.ts`, texto en
código, nunca de la IA). `/dashboard` es un shell vacío con el "cómo
funciona".

**Nombre "First Proof":** sale del nombre de la carpeta; el packet no
nombra el producto. Cambiarlo es solo texto (`app/layout.tsx`,
`app/login/page.tsx`, `components/AppHeader.tsx`).

**El piso de seguridad entero va en este commit, no solo auth.** El prompt
pide confirmarlo antes de cualquier feature, así que `submissions` y
`reviews` se crean ya, con su RLS, la función ciega y el trigger, aunque
sus pantallas lleguen en las Features 2–4. Estado de cada punto:

1. Sin secretos en el repo: `.env*` ignorado salvo `.env.local.example`
   (vacío). ✅
2. Google Auth, candidato y revisor = usuarios de la misma org, sin
   columna de rol. ✅ (código; falta probar login en producción)
3. RLS en `submissions` y `reviews`; el candidato ve solo sus filas. ✅
   probado en PGlite
4. Validación server-side de formularios: la base ya tiene los `check`
   (respuestas en rango, explicación 80–800, nota 1–400); la validación
   del server action con errores bajo cada campo llega con los
   formularios en las Features 2 y 4. ⏳ parcial, a propósito
5. Datos simulados etiquetados, nunca se pide CV, historial ni
   identificación. ✅
6. Revisor ciego y distinto del candidato: `blind_pending_submissions()`
   y `blind_submission()` (security definer) devuelven solo seudónimo,
   respuestas, explicación, observaciones y status; el trigger
   `validar_revision` rechaza revisor = candidato. El chequeo amistoso en
   el server action llega con la Feature 4. ✅ base / ⏳ server action
7. Guardia de la IA: llega con la Feature 3 (no hay ninguna llamada a la
   IA todavía). ⏳

**Decisiones de diseño del schema:**

- **`blind_submission()` no devuelve `created_at`.** En un piloto de 5–10
  personas, "entregó el martes a las 10:42" puede identificar a alguien.
- **Seudónimo por trigger con contador en `orgs.next_pseudonym`**, nunca
  elegido por el cliente y nunca reciclado: si A-03 se borra, la siguiente
  entrega es A-04. Un seudónimo reusado haría que un revisor crea que dos
  personas son la misma. `UPDATE … RETURNING` bloquea la fila de la org,
  así que dos entregas simultáneas no chocan.
- **Privilegios por columna en `submissions`:** el cliente solo puede
  insertar `org_id, candidate_id, answer_*, explanation`. No puede escribir
  `pseudonym`, `status` ni `ai_observations`, ni hacer UPDATE de nada. Sin
  esto, un candidato con la llave pública podría fabricar "observaciones de
  IA" a su favor o marcarse como revisado. **Consecuencia para la
  Feature 3:** el servidor necesita una vía para escribir
  `ai_observations` que el candidato no tenga — pendiente de decidir ahí
  (opciones: `SUPABASE_SERVICE_ROLE_KEY` solo en Vercel, o generar las
  observaciones *antes* del insert y escribirlas desde una función
  security definer que no reciba el texto del cliente).
- **`reviews` sin ninguna policy de escritura:** la única puerta es
  `submit_review()`, que bloquea la entrega (`for update`), verifica que
  sea de la propia org y siga pendiente, inserta y marca `reviewed`. El
  trigger revisa revisor ≠ candidato y misma org *además*, para que la
  regla no dependa de que nadie agregue otra puerta después.
- **No existe la recomendación "rechazar"** (`check` en la base, no solo
  en la UI): este slice nunca cierra una puerta.
- **Los perfiles de la misma org son visibles** (necesario para mostrarle
  al candidato quién lo revisó). No rompe el ciego: el revisor nunca
  recibe `candidate_id`, así que no puede ligar un perfil a un seudónimo.
- **Policies con `to authenticated`** desde el inicio: en w08 quedaron
  sin rol y anon recibía "permission denied for my_org_id" en vez de `[]`
  (seguro, pero ruidoso).

**Prueba mecánica del schema (real, no inspección):** no hay Postgres
local, así que `scripts/probar-schema.mjs` (`npm run test:schema`) corre
`sql/schema.sql` en PGlite (Postgres 18 en WASM) con stub de Supabase:
roles `anon`/`authenticated`, `auth.uid()`/`auth.jwt()` y los default
privileges que le dan EXECUTE a anon en funciones nuevas (la causa del
bug de w08). Resultado: **49/49**, incluye correr el schema dos veces
(idempotente), A-01/A-02/A-03 sin reciclar, columnas prohibidas,
candidato ajeno, otra org, trigger con y sin el RPC, cascada de borrado,
y que anon no ejecuta ninguno de los 7 RPCs ni lee las 4 tablas.

Para confirmar que la prueba sí detecta fallas, se reintrodujeron a
propósito dos bugs (revocar `create_org` solo de `public`, como en w08, y
quitar el trigger): la prueba marcó exactamente esos 3 checks en FAIL
(46/49). Se restauró el schema.

**Lo que NO está probado todavía:** nada contra Supabase real ni en
producción — login de Google al primer clic, Redirect URLs, Deployment
Protection, `scripts/probar-anon.sh` contra el proyecto real. PGlite no
es Supabase (no hay PostgREST ni GoTrue), así que la prueba anon con la
llave pública sigue siendo obligatoria.

**`npm run build` limpio (`rm -rf .next`) y `npm run lint`: sin errores.**

**Siguiente paso (tuyo, deploy 1):**
1. Crear proyecto de Supabase, correr `sql/schema.sql` completo.
2. Activar Google en Authentication → Providers.
3. Crear proyecto en Vercel con Root Directory `w09-first-proof`, poner
   `NEXT_PUBLIC_SUPABASE_URL` (URL pelona, sin `/rest/v1/`),
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `ANTHROPIC_API_KEY`.
4. Settings → Deployment Protection: ambos switches apagados.
5. En Supabase, Site URL y Redirect URLs = el alias de producción de
   Vercel (`https://<proyecto>.vercel.app` y `…/auth/callback`).
6. Llenar `.env.local` y correr `bash scripts/probar-anon.sh`; yo verifico
   Deployment Protection con `curl` desde fuera.

## 2026-10-11 — Deploy 1: dos problemas de configuración (Vercel y Supabase)

**URL de producción (alias usado en Supabase):**
`https://crystal-ball-w09-first-proof.vercel.app`. (`w09-first-proof.vercel.app`
da 404: no es nuestro, igual que pasó en w08.)

**Problema 1 — el build fallaba con "No Output Directory named 'public'".**
El proyecto de Vercel se creó cuando la carpeta `w09-first-proof` en GitHub
solo tenía `docs/` y `assets/` (commit bfe191d), así que Vercel detectó el
framework como "Other". Después el proyecto ya decía Next.js, pero el
deploy de producción seguía con el preset "Other" ("Production
Overrides"), que busca una carpeta `public/`. Se arregló con **Redeploy**
de e3c3736, que usa la configuración actual del proyecto. Diagnóstico
hecho en el dashboard de Vercel (log del build y panel de overrides), no
adivinado.

**Además, nombres de proyectos cruzados en Vercel:** había un proyecto
llamado `w09-first-proof` cuyo Root Directory era `w02-el-traductor`
(dominio `crystal-ball-psi.vercel.app`), y el de w09 real se llamaba
`crystal-ball-w09-first-proof`. Se renombraron a `w02-el-traductor` y
`w09-first-proof` (decisión tuya: renombrar, no borrar). Renombrar no
cambia los dominios: se verificó con curl que ambos siguen respondiendo
igual después del cambio.

**Problema 2 — Supabase con Site URL `http://localhost:3000` y sin
Redirect URLs.** El login en producción habría regresado a localhost. Tú
agregaste las Redirect URLs (producción y localhost `/auth/callback`,
verificado en el dashboard). **La Site URL sigue en localhost**: no rompe
el login porque el redirect sí está en la lista, pero la lección 6 pide el
alias de producción ahí también.

**Verificado desde fuera con curl, sin sesión:**
- `/login` → 200, título "First Proof", sin muro de login de Vercel →
  **Deployment Protection apagado** (también se ve "Disabled" en la
  configuración del deploy).
- `/dashboard` y `/` → 307 a `/login`.
- `/?code=x` → 307 a `/auth/callback?code=x` (lección 3).
- `/auth/callback?code=falso` → `/login?error=auth`: el servidor sí llega a
  Supabase, o sea que las env vars están en producción (nombres exactos
  confirmados en Vercel; los valores están cifrados y no se revisaron).
- Proveedor Google activo (`/auth/v1/settings` → `google: true`) y
  `/auth/v1/authorize` redirige a Google con
  `redirect_uri=https://vzrjpntpglybinaptogi.supabase.co/auth/v1/callback`.

**NO verificado todavía:** login con Google al primer clic en incógnito
en producción (prueba tuya). Es lo único que confirma que Google Cloud
tiene autorizado el redirect URI de Supabase.
