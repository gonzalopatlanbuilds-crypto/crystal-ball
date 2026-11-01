# Decisiones — Validator (Week 12, Core Build)

## 2026-11-01 — Punto de partida: reconstrucción sobre el código probado de w11

Validator es el venture que sale de w11 (CHARTER: "extracted from Week 11").
En lugar de reescribir desde cero, cada feature se porta desde
`w11-validador-evidencia` (ya probado en producción, con dos bugs reales
corregidos en su prueba mecánica) y se adapta a lo que piden PACKET.md y
el IMPLEMENTATION_PROMPT de esta semana. Igual que w11 partió de w10. Lo
que cambia respecto a w11 queda anotado en cada entrada.

Dos decisiones de alcance de w11 se mantienen porque el PACKET de w12
tampoco las define (ver DECISIONS.md de w11, 2026-10-25). Confirmadas por
Gonzalo el 2026-11-01 ("igual que w11"):

1. "Última evidencia aceptada" de un SKU: la primera carga es la base; una
   fila posterior pasa a ser la aceptada si no produjo hallazgos o si todos
   sus hallazgos se descartaron. Confirmar un hallazgo conserva el valor
   anterior como referencia.
2. `possible_duplicate`: folio reutilizado en **otro** SKU o proveedor, o
   repetido dentro de la misma carga. Reenviar el mismo SKU+proveedor+folio
   no es duplicado.

## 2026-11-01 — Feature 1: base, auth y schema (RLS, my_org_id, revokes)

**Qué cambió:** sobre el esqueleto de Next.js (commit ab197ef):

- Supabase (`@supabase/ssr`), `proxy.ts` + `lib/supabase/*`, callback y
  signout de Google con logs por motivo, reenvío de `?code=` de `/` a
  `/auth/callback`, signout POST → 303. Portados de w11 sin cambios de
  lógica.
- Google con `queryParams: { prompt: 'select_account' }`
  (`components/BotonGoogle.tsx`, un solo botón para `/` y `/login`).
- **Home pública nueva** (`/`), según `assets/w12-mockup-home.png`: en w11
  `/` solo redirigía. Sin sesión muestra la home; con sesión manda a
  `/onboarding` (sin organización) o a `/validador`. No lee ni muestra
  ningún dato.
- `/onboarding`: crear organización o unirse con código (`join_org`).
  Textos ajustados a una sola persona que carga y revisa (Blueprint,
  condición 2): el código sirve para entrar con otra cuenta de Google a la
  misma organización, no para invitar a una segunda revisora.
- `/validador` protegida dos veces (middleware y layout): sin sesión →
  `/login`, sin organización → `/onboarding`. Por ahora solo un estado
  vacío; la carga llega en la Feature 2. La navegación solo enlaza rutas
  que ya existen ("Hallazgos" vuelve con la Feature 4).
- **Aviso en todas las pantallas** (`components/Aviso.tsx`, texto en
  `lib/avisos.ts`): "Datos simulados: proveedores, SKUs y folios son
  inventados. Validator no certifica cumplimiento ni reciclaje." Une el
  banner de datos simulados con la cláusula de sombra que el prompt pide
  en toda pantalla, incluida la home pública. Está en `/`, `/login`,
  `/onboarding`, todo `/validador`, error y 404.

**Schema (`sql/schema.sql`):** la sección de la Feature 1 de w11 (5 tablas,
RLS, `my_org_id()` security definer, ninguna policy de `profiles` consulta
`profiles`, revokes de `public, anon` en toda función, el cliente solo lee
su org y no escribe nada todavía). Un cambio: el check de la nota de
`decisions` nace estricto (al menos una letra o dígito, máximo 1000). En
w11 empezó con `btrim()` y la prueba mecánica encontró dos bugs (notas de
`\n\t` y de nbsp/zero-width). Como este proyecto de Supabase es nuevo, no
hace falta `NOT VALID`.

**Cifra de Specright en la home:** el mockup dice "Specright cobra ≈
US$60,000/año† (cifra sin verificar)", y el PACKET (§6) y el Blueprint
(condición 1) piden verificarla antes de usarla en material público. Se
preguntó: Gonzalo la verificó buscando cuánto cobra Specright (2026-11-01),
así que la home la muestra sin la marca de "sin verificar". PACKET §6
todavía la llama sin verificar: falta actualizarlo y anotar la fuente.

**Pruebas:**

- `npm run test:schema` (PGlite, Postgres real en WASM, con los default
  privileges de Supabase simulados): 63/63. Cubre org/join_org, aislamiento
  entre organizaciones en las 5 tablas, el cliente no escribe (insert,
  update ni delete) en ninguna tabla, anon no lee ni escribe nada, anon no
  ejecuta ninguna función de `public` (chequeo genérico), RLS encendido en
  todas las tablas, y la regresión de las notas invisibles (vacía,
  espacios, `\n\t`, nbsp, zero-width, em space, solo puntuación).
- Con `BASE_URL=…` prueba también por HTTP: `/` y `/login` 200 sin sesión,
  `/validador` y `/onboarding` → `/login`.

**Contra el proyecto real de Supabase** (nuevo para Validator; Gonzalo lo
creó, corrió `sql/schema.sql` y llenó `.env.local`):

- `bash scripts/probar-anon.sh` con la llave pública: los 4 RPC → 401
  "permission denied for function"; las 5 tablas → "permission denied";
  insert en `evidence_versions` y `decisions` y update de `findings` → 401.
- `BASE_URL=http://localhost:3000 npm run test:schema` sobre un build
  limpio (`next start`): 67/67 (`/` y `/login` 200 sin sesión;
  `/validador` y `/onboarding` → `/login`).
- Navegador (Chrome, build de producción local): la home pública se ve
  como el mockup; "Iniciar sesión con Google" abre el selector de cuentas
  (`prompt=select_account`, regreso a `/auth/callback`). Gonzalo eligió la
  cuenta (la extensión no puede operar en accounts.google.com). Llegó a
  `/onboarding`; se creó la org "Validator Simulado W12" (código
  `9A2-DPD`); "Ir al validador" → `/validador` con el correo, el aviso y el
  estado vacío; `/` con sesión → `/validador`; "Cerrar sesión" → `/login`;
  `/validador` después de cerrar sesión → `/login`.

**No verificado todavía:** `join_org` con una segunda cuenta real (solo en
PGlite) y nada en Vercel (primer deploy después de la Feature 3).

**Push de F1:** 057da08, con el visto bueno de Gonzalo (ya había creado el
proyecto w12 en Vercel con Root Directory, variables, Deployment
Protection apagado y Redirect URL de Vercel en Supabase).

## 2026-11-01 — Feature 2: carga y versionado append-only

**Qué cambió:** portado de w11 tal como quedó al cerrar su Feature 2
(commit 51261ea, que ya incluía la corrección de la recarga idéntica):

- `lib/csv.ts`: el servidor valida extensión, tipo, tamaño (200 KB), UTF-8,
  cabecera con las 6 columnas, y cada fila. Las filas malas se reportan con
  su número de línea y motivo y se guardan en `invalid_rows`; nunca se
  tiran en silencio. Números: punto o coma decimal; se rechazan `1e3`,
  `NaN`, `Infinity`, signos y separadores de miles (`1,500` y `1.500` son
  ambiguos y se rechazan con ese motivo). Separador `;` de Excel en
  español. Texto que empieza con `= + - @` (fórmula) se rechaza.
- `app/validador/actions.ts`: el archivo subido y "Cargar ejemplo" pasan
  por el mismo camino de validación. `lib/ejemplo.ts`: CSV inventado
  (proveedores "Simulado Alfa/Beta", SKUs `SIM-…`), marcado "Ejemplo
  simulado".
- `/validador`: formulario de carga (como el mockup) e historial de
  versiones con archivo, quién, cuándo, filas aceptadas/rechazadas y las
  marcas "Idéntica a la anterior" y "Ejemplo simulado".
- SQL: `registrar_version()` (security definer) es la única puerta de
  escritura. La base vuelve a validar cada fila, calcula ella misma la
  huella (`content_sha256`) y la marca `identical_to_previous`, y asigna
  `seq` (orden exacto, para la Feature 3). Triggers impiden update,
  delete y truncate en `evidence_versions`, incluso desde el SQL Editor.
- **Toda carga válida es una versión nueva**, aunque sea idéntica a la
  anterior (bug real de w11: la primera versión la saltaba). La regresión
  está en `test:schema`.

**Pruebas:** `npm run test:logica` (nuevo) 71/71: archivo, números, fechas,
CSV mixto con cada motivo por fila, separador `;`, ejemplo. `npm run
test:schema` 104/104: lo de F1 más procedencia, recarga idéntica guardada
y marcada, reorden de filas = idéntica, contenido cambiado = no idéntica,
otra org = no idéntica, append-only contra A, B (misma org), C (otra org),
anon y el service role, la base rechaza 11 tipos de filas basura por RPC
directo, usuario sin org y anon no registran, y anon sigue sin EXECUTE en
ninguna función. Build limpio y lint sin errores.

**Contra el proyecto real** (Gonzalo corrió `sql/schema.sql` otra vez):

- `bash scripts/probar-anon.sh`: `registrar_version`,
  `validar_filas_evidencia` y `huella_evidencia` → 401 "permission
  denied"; las funciones de trigger → 404 (PostgREST no las expone);
  PATCH y DELETE de `evidence_versions` con la llave pública → 401.
- Navegador (build de producción local, sesión de gonzalo.patlan5, org
  "Validator Simulado W12"): "Cargar ejemplo" → versión nueva de 10 filas,
  marcada "Ejemplo simulado". Otra vez "Cargar ejemplo" → **versión nueva**
  marcada "Idéntica a la anterior" ("no hay cambios que revisar").
  `prueba-f2-filas-malas.csv` (2 válidas, 5 malas) → versión con 2 filas y
  las 5 rechazadas con su fila y motivo: `1e3` (fila 3), `1,500` ambiguo
  (4), `NaN` (5), proveedor `=HYPERLINK(1)` (6), `2026-02-30` (7).
- Con la sesión real (llave pública + token de la sesión, desde la
  consola, sin imprimir ninguno): PATCH, DELETE e INSERT directo sobre
  `evidence_versions` → 403 "permission denied"; la versión quedó con su
  nombre original y siguen siendo 3 versiones.

**No verificado en el proyecto real:** la misma prueba con una sesión de
otra persona de la org (no dueña de la versión). Está cubierta en PGlite
(B y C), y el bloqueo es por privilegios del rol `authenticated` (no hay
UPDATE/DELETE/INSERT para nadie), no por quién subió la versión; aun así
falta hacerla con una segunda cuenta real.

**F1 en producción:** el deploy de 057da08 en Vercel terminó bien.
Validator vive en https://www.packvalidator.online (el apex redirige con
308 a `www`). `BASE_URL=https://www.packvalidator.online npm run
test:schema` → 108/108 (`/` y `/login` 200, `/validador` y `/onboarding`
→ `/login`); la home de producción muestra el aviso y la cláusula de
sombra. Login con Google en producción todavía no probado.
