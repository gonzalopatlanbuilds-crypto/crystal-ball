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

## 2026-11-01 — Vercel: las semanas viejas ya no se reconstruyen sin cambios

**Problema:** el repo tiene 11 proyectos de Vercel (w02-w12) y cada push
desplegaba los 11 aunque solo cambiara una carpeta. En w11 eso agotó el
límite diario de deploys. Gonzalo pidió que las semanas viejas no se
reconstruyan si su carpeta no cambió.

**Qué se hizo:** un `vercel.json` idéntico en cada carpeta `wNN-*` (la raíz
de cada proyecto), con `ignoreCommand`. Vercel lo corre antes de cada
build: si sale con 0, cancela el build; con 1, construye. El comando
compara `$VERCEL_GIT_PREVIOUS_SHA` (el último deploy exitoso de ese
proyecto) con `HEAD`, solo en la carpeta del proyecto (`-- .`). Si no hay
SHA previo o no está en el clon (Vercel clona con historial corto),
intenta `git fetch --deepen=500` (el repo es público) y, si aun así no
puede comparar, construye. Ante cualquier duda, construye.

Se eligió el archivo en el repo y no el campo "Ignored Build Step" del
dashboard: queda versionado, igual para los 11 proyectos, sin configurar
11 pantallas a mano. Si un proyecto tuviera algo escrito en ese campo del
dashboard, `vercel.json` tiene prioridad.

**Probado local** (simulando la variable): w05 contra 057da08 → 0
(saltar); w12 contra 057da08 → 1 (F2 cambió w12); w12 contra 5f53ec1 → 0;
sin SHA → 1; SHA inexistente → 1.

**Todavía no probado en Vercel:** el push que lo sube cambia las 11
carpetas (agrega el archivo), así que ese push construye todo una última
vez. El efecto se verá en el push siguiente: solo debería construir lo que
cambió. Falta comprobar si un build cancelado por este comando cuenta o no
para el límite diario de deploys; aun si cuenta, ahorra los minutos de
build de 10 proyectos por push.

## 2026-11-01 — Feature 3: motor determinista de hallazgos

**Qué cambió:** portado de w11 tal como quedó en su commit de F3
(7c9ca0e). `lib/validador.ts` no cambió en w11 después de eso. Ver la
entrada de F3 en el DECISIONS.md de w11 para el detalle de las reglas.

- `lib/validador.ts`: funciones puras, sin IA. Compara la carga nueva
  contra la **última evidencia aceptada** de cada SKU + proveedor (regla
  confirmada por Gonzalo, ver arriba) y produce `missing_supplier`,
  `value_conflict` (los dos valores y las dos procedencias),
  `late_revision` y `possible_duplicate` (etiqueta fija "Posible
  duplicado, sin verificar"; nunca "verificado").
- La server action lee historial y hallazgos con la sesión (RLS aplica),
  corre el motor y guarda versión + hallazgos en una sola transacción con
  `registrar_version()` de 6 argumentos (`p_findings`, `p_base_seq`; si
  entró otra carga en medio, `CAMBIO_CONCURRENTE` y reintenta una vez).
- `/validador` muestra "Hallazgos de esta carga" (SKU, tipo, descripción
  armada por código, "Pendiente").
- SQL: `fingerprint` único por org (un hallazgo no se crea dos veces);
  trigger `hallazgo_protegido`: todo hallazgo nace `pending` (también
  desde el SQL Editor), no se borra ni se hace truncate, y su estado solo
  cambia desde el flujo de decisiones (Feature 4). Una versión idéntica a
  la anterior no guarda hallazgos aunque el cliente los mande.
- En `sql/schema.sql` la `registrar_version()` de 4 argumentos de la F2
  se quitó del archivo (la de 6 la reemplaza y la sección F3 borra la
  vieja con `drop function if exists`), igual que en el schema final de
  w11.
- `scripts/verificar-deploy.mjs` (nuevo, para el deploy 1): además de lo
  de w11, revisa la home pública (`/` 200, cláusula de sombra, sin
  llaves) y que `/login` muestre la cláusula. Contra la producción actual
  (F1): 10/10.

**Pruebas:** `test:logica` 114/114 (cada tipo con sus bordes, recarga
idéntica = 0 hallazgos, dedup, aceptación según el estado, textos sin
"verificado" ni afirmaciones de cumplimiento). `test:schema` 133/133
(flujo de punta a punta con los 4 tipos guardados y pendientes, recarga
idéntica = 0 hallazgos aunque el cliente mande uno, nadie cambia el
estado ni borra hallazgos, `CAMBIO_CONCURRENTE`, otra org no ve nada).
Build limpio, lint sin errores.

**Límite conocido (de w11):** `late_revision` en la app real necesita
evidencia aceptada subida un día anterior (una fecha de revisión no puede
estar en el futuro). Las versiones de la org de prueba son de hoy, así que
se prueba en la app real a partir del 2026-11-02; mientras tanto está
cubierta por las dos suites.

**Contra el proyecto real** (Gonzalo corrió `sql/schema.sql` con la
sección F3):

- `probar-anon.sh`: `registrar_version` de 6 argumentos → 401 (existe y
  anon no la ejecuta); `hallazgo_protegido` → 404 (trigger, no expuesta);
  tablas, escrituras y cambio de estado → permission denied.
- Navegador (build local con F3, sesión de gonzalo.patlan5, org
  "Validator Simulado W12", historial: ejemplo, ejemplo idéntico,
  `prueba-f2-filas-malas.csv`):
  1. `f3-1-faltante-conflicto-duplicado.csv` → 9 filas, **4 hallazgos
     nuevos pendientes**: falta Alfa en SIM-4821 (con su procedencia,
     `ejemplo-simulado.csv` fila 6), "Posible duplicado, sin verificar" en
     SIM-1190 y SIM-2034 (FOL-SIM-0001), conflicto de peso SIM-1190/Alfa
     18.2 → 24.5 g. Lo mismo que predice el motor.
  2. El mismo archivo otra vez → versión nueva "Idéntica a la anterior",
     "no se crearon hallazgos".
  3. `f3-3-un-cambio-mas.csv` → **1 hallazgo nuevo** (SIM-6018/Beta 55 →
     60 g), sin repetir los 4 anteriores.
- Con la sesión real (desde la consola, sin imprimir llave ni token):
  PATCH del estado a `confirmed`, DELETE e INSERT de un hallazgo con
  `status: confirmed` → 403; los 5 hallazgos siguen `pending`.

**Incidente en la prueba (no es bug del código):** el primer intento dio
"No se pudo guardar la versión". El log mostró `PGRST202`: la página
llamaba a `registrar_version` de 4 argumentos. Era el servidor local de la
prueba de F2, que seguía vivo en el puerto 3000 (el nuevo no arrancó por
`EADDRINUSE`). No se guardó nada. **Consecuencia real:** desde que el SQL
de F3 borró la función de 4 argumentos, la carga en producción (que corre
F2) falla hasta que se despliegue F3. Por eso F3 se sube enseguida.
Lección para los siguientes cambios de firma: desplegar el código casi al
mismo tiempo que se corre el SQL.

**Lista de hallazgos:** en `/validador` cada hallazgo muestra los dos
valores; las dos procedencias completas (archivo, fila, quién, cuándo)
están en `details` y se muestran en el detalle del hallazgo de la Feature
4 (`/validador/hallazgos/[id]`), como en w11.
