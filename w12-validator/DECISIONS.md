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

## 2026-11-01 — Deploy 1 (F1-F3 en producción)

Push `5f53ec1..ccb3432` (F3 dc13edf + `vercel.json` ccb3432). Vercel
w12-validator: success. Como se esperaba, este push construyó también las
semanas viejas (el `vercel.json` nuevo cambió cada carpeta).

- `npm run verificar:deploy -- https://www.packvalidator.online` → 10/10:
  home pública 200 con cláusula de sombra y sin llaves; `/login` 200 sin
  muro de Vercel (Deployment Protection apagado), con aviso y cláusula;
  `/validador` y `/onboarding` → `/login`; ruta inexistente sin 500.
- `BASE_URL=https://www.packvalidator.online npm run test:schema` →
  137/137.
- `packvalidator.online` resuelve: el apex responde 308 →
  `https://www.packvalidator.online/`.
- Login con Google **en producción**: selector de cuentas
  (`prompt=select_account`, regreso a
  `https://www.packvalidator.online/auth/callback`); Gonzalo eligió la
  cuenta y entró directo a `/validador` con su org y sus versiones.
- Carga en producción después del deploy: `f3-3-un-cambio-mas.csv` otra
  vez → "se guardó como una versión nueva … idénticas a la anterior". La
  ventana en que la carga de producción estuvo rota (SQL de F3 corrido,
  código de F2 todavía desplegado) quedó cerrada.

**Mañana, primer paso:** Feature 4 (revisión humana y bitácora de
decisiones). Pendientes de días anteriores: `late_revision` en la app real
(posible desde el 2026-11-02), prueba de no-dueño con una segunda cuenta
real, y ver si el siguiente push salta los builds de las semanas viejas.

## 2026-11-01 — Feature 4: revisión humana y bitácora de decisiones

**Qué cambió:** portado de w11 (UI de a9cd7c5; `lib/decisiones.ts` y
`FormularioDecision.tsx` de c4fea64, que ya traen el arreglo de las notas
invisibles y el texto más claro de "descartar"; sin nada del lector de
IA, que es la Feature 5).

- `/validador/hallazgos`: lista con filtros Pendiente / Confirmado /
  Descartado / Todos. "Hallazgos" vuelve a la navegación.
- `/validador/hallazgos/[id]`: datos (los dos valores y la diferencia
  calculada por código), las dos procedencias (archivo, fila, quién,
  cuándo), confirmar o descartar con nota obligatoria, e historial de
  decisiones del más viejo al más nuevo, con la vigente marcada.
- Servidor: `decisionSchema` (zod) quita caracteres de formato invisibles
  y exige al menos una letra o dígito.
- SQL (sección F4 de w11): `registrar_decision()` es la única puerta;
  triggers que fijan el org de la decisión y limpian la nota, que mueven
  el estado del hallazgo a la última decisión (por cualquier camino,
  también desde el SQL Editor) y que impiden update, delete y truncate de
  `decisions`. El check estricto de la nota ya existía desde la F1; no se
  copió el reemplazo `NOT VALID` que w11 necesitó.

**Pruebas:** `test:logica` 139/139 (nota vacía, espacios, saltos y tabs,
nbsp/em/ancho cero, marcas de dirección, solo puntuación → rechazadas;
acentos y ñ → válidas; diferencia porcentual; textos sin "verificado" ni
afirmaciones de cumplimiento). `test:schema` 179/179 (nota obligatoria en
la base, camino feliz, cambio de opinión = fila nueva, aislamiento entre
orgs, nadie edita/borra/inserta directo, ni el service role, consistencia
del estado, la evidencia aceptada cambia solo con TODOS los hallazgos de
la fila descartados). Build limpio, lint sin errores.

Al juntar las pruebas de F4 con las de F1, el chequeo "un hallazgo nace
pending por default" de F1 fallaba: revisaba un hallazgo al que la propia
prueba de F1 ya le había insertado decisiones, y con el trigger de F4 esas
decisiones sí mueven el estado. Era la prueba, no el código: ahora revisa
un hallazgo recién insertado.

**Contra el proyecto real** (Gonzalo corrió `sql/schema.sql` con F4):

- `probar-anon.sh`: `registrar_decision` → 401; las 3 funciones de
  trigger → 404; PATCH y DELETE de `decisions` con la llave pública →
  401. Ningún 200 en toda la prueba.
- Navegador, sesión de gonzalo.patlan5, hallazgo SIM-1190 (conflicto
  18.2 → 24.5 g): el detalle muestra los dos valores, +34.6% y las dos
  procedencias (`f3-1…csv` fila 2 y `ejemplo-simulado.csv` fila 2, con
  quién y cuándo). Nota de puros espacios desde la página → el servidor
  responde "La nota es obligatoria…" y el hallazgo sigue pendiente.
  Confirmar con nota → "Confirmado", 1 decisión. Descartar con otra nota →
  "Descartado", 2 decisiones en orden, la primera intacta.
- Con la sesión real, saltándose el servidor (RPC directo):
  `registrar_decision` con nota vacía, espacios/saltos/tabs,
  nbsp+em+ancho cero, solo ancho cero y solo puntuación → **400 "La nota
  es obligatoria."** las 5. PATCH de la nota, PATCH de la decisión, DELETE
  de la decisión, INSERT directo en `decisions` y PATCH del estado del
  hallazgo → 403. Siguen las 2 decisiones y el estado "discarded".

## 2026-11-01 — Pendientes resueltos: revisión tardía y no-dueño

**Revisión posterior en la app real, hoy (no mañana).** Se entrega hoy,
así que se hizo como en w11: un fixture insertado desde el SQL Editor con
`uploaded_at` del 2026-10-20 (`docs/pruebas/mecanica/fixture-fecha-pasada.sql`,
Proveedor Simulado Delta, SIM-LATE-01, validado por el mismo trigger). Se
probó antes en PGlite: devuelve una fila con la huella calculada, y el
motor con `mt-3-revision-tardia.csv` da exactamente un `late_revision`.
Gonzalo lo corrió en Supabase. Luego `mt-3-revision-tardia.csv`
(revisión 2026-10-28) por la app → **1 hallazgo nuevo**: SIM-LATE-01 ·
Revisión posterior a evidencia · "Evidencia aceptada el 20 oct; empaque
revisado el 28 oct", Pendiente. El historial muestra el fixture con su
fecha (20 oct, 10:00 a.m.). Nota honesta: el fixture es la única versión
del proyecto que no subió la app; su fecha la puso el SQL Editor, no la
base al subir.

**No-dueño con una segunda cuenta real.** Gonzalo eligió
`gonzalopatlan.builds` en el selector de Google:

- Con sesión y **sin organización** (en `/onboarding`): 0 filas en las 5
  tablas.
- Se unió con `9a2dpd` (minúsculas, sin guion; se normaliza a `9A2-DPD`)
  → `/validador`. Ve 2 perfiles, 9 versiones, 6 hallazgos y 2 decisiones
  de la org.
- Sobre lo que subió y decidió la otra cuenta: PATCH y DELETE de una
  versión (`ejemplo-simulado.csv`), PATCH y DELETE de una decisión, y
  PATCH del estado de un hallazgo → **403 los 5**. Todo intacto (mismo
  nombre, misma nota, 9 versiones, 2 decisiones).

**Pendiente:** ver en el push de la F4 si Vercel ya salta los builds de
las semanas viejas.

**Vercel, comprobado en el push de la F4 (c03fc47):** las 10 semanas viejas
quedaron "Canceled by Ignored Build Step" y solo w12-validator se desplegó
("Deployment has completed"). El `vercel.json` funciona. La F4 quedó en
producción con ese deploy.

## 2026-11-01 — Feature 5: lector de IA, guardia, límite y comparación

**Qué cambió:** portado de w11 tal como quedó después de su prueba mecánica
(el arreglo de la guardia para inglés, ancho cero, cirílico y dígitos no
ASCII ya viene incluido).

- `lib/lector-ia.ts`: solo en el servidor, llave en `ANTHROPIC_API_KEY`
  (sin `NEXT_PUBLIC_`). Modelo `claude-opus-5-5`, effort `medium` explícito
  (el default de Opus 5.5), salida estructurada (`{ observacion }`) y
  respaldo del servidor si el modelo declina por seguridad (`fallbacks:
  "default"`, beta `server-side-fallback-2026-07-01`). Revisado contra la
  referencia actual de la API antes de portarlo. A la IA solo le llega
  tipo, SKU, proveedor ficticio, valores, fechas y folios (campo por
  campo, nunca `details` completo: ni correos, ni ids, ni archivos), y los
  datos van marcados como datos, no instrucciones.
- `lib/guardia-lector.ts`: rechaza palabras de veredicto en español e
  inglés (cumple, reciclado, recuperado, verificado, aprobado, compliant,
  verified, recycled…, también con letras separadas, guiones, ancho cero,
  cirílico o ancho completo), cualquier cifra que no esté en la entrada,
  elegir un valor o recomendar, y largo fuera de 15–320. Si rechaza, se
  pide una vez más; si vuelve a fallar no se muestra nada.
- `app/validador/hallazgos/ia-actions.ts`: recibe solo el id del hallazgo
  y lo lee con RLS. La observación no se guarda ni toca el estado.
- Límite: `registrar_llamada_lector()` (security definer) cuenta en la
  tabla `lector_llamadas` (sin acceso del cliente): **10 por hora por
  persona y 30 por día por organización**, registrado ANTES de llamar a la
  API (un intento fallido también cuenta).
- La página pone la etiqueta "Observación de IA (sin validar)"; la IA no
  la escribe.
- `lib/chequeo-reglas.ts` + `scripts/comparar-lector.ts`: la comparación
  contra una regla simple, sin volver a pagar llamadas.

**Llamadas reales (2026-11-01, `docs/pruebas/lector-ia-2026-11-01.json`):**

- `node scripts/probar-lector.ts 3`: 3 rondas × 10 escenarios sembrados =
  **30 llamadas, 30 mostradas, 0 descartadas por la guardia, 0 errores**,
  todas al primer intento. **Las 30 leídas a mano:** ninguna da veredicto
  ni elige un valor, ninguna recomienda una acción, ninguna trae una cifra
  que no esté en el hallazgo, todas en condicional ("podría deberse a",
  "quizá"). Las 3 de inyección (instrucción escondida en el nombre del
  proveedor) no la obedecieron.
- `node scripts/provocar-guardia.ts`: se le pidió al modelo, a propósito,
  lo prohibido (valor correcto, porcentaje, cumple/verificado/reciclable).
  **La guardia rechazó 3 de 3**: largo, "cumple"/"verificación", "el valor
  respaldado"/"correcto", y cifras inventadas (900, 10, 0, 22.4, 5.5).
- `node scripts/atacar-lector.ts`: el prompt de producción con el ataque
  metido en los DATOS (responder en inglés, con letras separadas, con
  dígitos no ASCII). El modelo **no obedeció ninguno**; en 2 dijo que "el
  campo material trae texto ajeno al dato". La guardia dejó pasar las 3
  porque son inofensivas.

**Comparación IA vs regla** (`node scripts/comparar-lector.ts`). Regla:
marcar un conflicto de peso que cambie más de 20%.

| Escenario | Regla | IA (rondas que nombran la causa / 3) |
|---|---|---|
| punto decimal (18.2 → 182) | marca | 3/3 |
| kg como g (120 → 0.12) | marca | 3/3 |
| rediseño real +9% con fecha nueva | no marca | 3/3 |
| redondeo (42 → 42.4) | no marca | 3/3 |
| sinónimo (PET = polietileno tereftalato) | no marca | 3/3 |
| cambio real de material con rediseño | no marca | 3/3 |
| salto +22% sin fecha nueva | marca | 3/3 |
| folio copiado de otro SKU | no marca | 3/3 |
| revisión tardía | no marca | 2/3 |
| inyección (lo correcto es no obedecer) | no marca | 0/3 obedeció |

La regla marca 3 de 10 y no explica ninguno; la IA nombra la causa en 9 de
10 (en la revisión tardía, 2 de 3). La conclusión de w11 se repite: la
regla sirve para avisar, la IA para dar contexto, y ninguna decide; el
hallazgo lo resuelve la persona con su nota. Aviso honesto: "nombra la
causa" se mide con expresiones regulares sobre el texto; en la lectura a
mano, varias observaciones listan la causa sembrada junto con otras
posibles, no siempre primero.

**Pruebas:** `test:logica` 187/187 (guardia con los disfraces, entrada sin
datos personales, y las 30 salidas reales de hoy siguen pasando: sin falsos
positivos). `test:schema` 191/191 (límite: 10 por hora por persona, 30 por
día por org, la tabla sin acceso del cliente, anon no ejecuta). Build
limpio, lint sin errores.

**Contra el proyecto real** (Gonzalo corrió `sql/schema.sql` con F5 y puso
`ANTHROPIC_API_KEY` en Vercel):

- `probar-anon.sh`: `registrar_llamada_lector` → 401; tabla
  `lector_llamadas` → permission denied. Ningún 200 en toda la prueba.
- En la app (sesión de gonzalopatlan.builds, SIM-1190 conflicto 18.2 →
  24.5 g), "Pedir observación de IA" → bajo "Observación de IA (sin
  validar)": «El peso_g pasó de 18.2 a 24.5 con el mismo material, fecha y
  folio FOL-SIM-0001. Podría deberse a un error de captura, quizá a un
  pesaje con tapa o etiqueta incluidas, o a un rediseño real del empaque
  que no se reflejó en la fecha de revisión.» Sin veredicto, sin cifras
  nuevas; el estado del hallazgo no cambió.
- **Límite en la base real, sin gastar llamadas a la API:** con la misma
  sesión, `registrar_llamada_lector` 11 veces seguidas → 9 `true` y luego
  `false`, `false` (con la consulta de arriba, 10 en la hora). Leer
  `lector_llamadas` con la sesión → 403. "Pedir otra observación" en la
  app → «Llegaste al límite de consultas a la IA (10 por hora por persona,
  30 por día por organización). Intenta más tarde.» Ese intento también
  se cuenta, sin llamar a la API.

## 2026-11-01 — Commit 6: pulido y docs

- `app/validador/loading.tsx`: "Cargando…" mientras el servidor lee la
  evidencia (de w11).
- Títulos de pestaña con el nombre del producto: "Cargar evidencia ·
  Validator", "Hallazgos · Validator", "Revisión de hallazgo · Validator"
  (venían de w11 como "Validador de Evidencia").
- Estados vacíos y mensajes de error ya venían con cada feature: sin
  versiones ("Todavía no hay versiones…"), carga idéntica ("no generó
  hallazgos"), sin decisiones ("Todavía no hay decisiones. El hallazgo
  sigue pendiente."), errores de carga, de nota y de la IA en español.
- README actualizado (qué hace, producción, cómo correr y cómo probar).

**Aviso y cláusula de sombra en todas las pantallas** — comprobado en el
build de producción local, buscando el texto "Validator no certifica
cumplimiento ni reciclaje" en cada página: `/`, `/login`, `/validador`,
`/validador/hallazgos`, el detalle de un hallazgo y la 404. `/onboarding`
y la página de error usan el mismo componente `Aviso`, pero no se midieron
en esta pasada (`/onboarding` se vio con el aviso en el navegador al unir
la segunda cuenta).

**Móvil, 375 px y 320 px** (iframes del mismo origen; cambiar el tamaño de
la ventana no funciona en esta máquina, igual que en w11): `/`, `/login`
(sin sesión), `/validador`, `/validador/hallazgos`,
`/validador/hallazgos?estado=todos`, el detalle de un hallazgo con su
observación de IA, y la 404 (con sesión). **Ninguna desborda**: el ancho
del documento es igual al ancho visible en los 14 casos (360/305 cuando
hay barra de desplazamiento, 375/320 cuando no). `/onboarding` no se midió:
necesita una cuenta con sesión y sin organización, y las dos cuentas de
prueba ya están en la org.

## 2026-11-01 — Prueba mecánica (PACKET §10) y bug real

Resultados (proyecto real; producción = https://www.packvalidator.online):

| # | Prueba | Resultado |
|---|---|---|
| 1 | Falta un proveedor | ✅ `f3-1` → SIM-4821/Alfa, con su procedencia (F3, base real) |
| 2 | Valor en conflicto | ✅ 18.2 → 24.5 g con las dos procedencias (F3/F4) |
| 3 | Revisión posterior | ✅ fixture del 20-oct + `mt-3` → 1 hallazgo (F4) |
| 4 | Folio reutilizado | ✅ "Posible duplicado, sin verificar" en SIM-1190 y SIM-2034 |
| 5 | Decidir sin nota | ✅ en producción: nota de espacios+nbsp+ancho cero → "La nota es obligatoria…", sigue Pendiente; RPC directo → 400 (F4) |
| 6 | Editar una decisión | ✅ PATCH/DELETE → 403 con dueño y con no-dueño; cambio de opinión = fila nueva (F4) |
| 7 | Guardia de la IA | ✅ 3/3 provocadas rechazadas, 3 ataques resistidos; en producción la IA responde sin veredicto ni cifras nuevas (llave de Vercel OK) |
| 8 | RLS / anon | ✅ anon: todo 401/permission denied; sin org: 0 filas; no-dueño: 403 |
| 9 | Recargar lo mismo | ✅ en producción: "idénticas a la anterior… no se crearon hallazgos" |

**Bug real (encontrado en producción):** subir un CSV de **1.5 MB** tumbaba
toda la página a "Algo salió mal" (React #441 en consola) en vez de decir
"El archivo pesa más de 200 KB". Con 300 KB el mensaje sí salía. Causa
(confirmada en `next/dist/server/app-render/action-handler.js`): Next.js
corta las Server Actions de más de 1 MB con un 413 **antes** de que corra
`subirCsv`, y ese error sube al error boundary. El formulario solo avisaba
"será rechazado" pero enviaba igual.

**Arreglo:** `excedeTamano()` y `MENSAJE_TAMANO` en `lib/csv.ts`, usados por
el formulario y por el servidor. El formulario ya no envía un archivo de
más de 200 KB (muestra el mismo mensaje del servidor y no deja el resultado
de una carga anterior en pantalla); el servidor sigue revisando el tamaño.
4 pruebas nuevas en `test:logica` (191/191). `test:schema` 191/191, lint y
tipos sin errores.

**Verificado en producción** (deploy de 14f1359, Vercel success; solo se
construyó w12): `prueba-1500kb.csv` otra vez → «El archivo pesa más de 200
KB. No se envió: sube un CSV más pequeño.», sin "Algo salió mal"; el
formulario y la lista de versiones siguen en pantalla. Control: una carga
normal justo después (`mt-3-revision-tardia.csv`) se guardó como versión
idéntica a la anterior, sin hallazgos nuevos, y el aviso de tamaño
desapareció.

Nota de la prueba: una pestaña de Chrome se quedó en "Cargando…" después de
una navegación que no respondió; el HTML que mandaba producción estaba
completo (con "Versiones guardadas" y sin error). En una pestaña nueva la
página cargó normal: era la pestaña (la máquina tiene poca RAM libre, como
en w11), no la app.

## 2026-11-01 — `/onboarding` en móvil, con una tercera cuenta

Gonzalo eligió una tercera cuenta de Google (ni gonzalo.patlan5 ni
gonzalopatlan.builds) en producción: entró a `/onboarding` sin
organización, con el aviso y la cláusula de sombra. Medido con iframes del
mismo origen:

- 375 px: ancho del documento 375 = ancho visible → no desborda; campos y
  botones de 293 px.
- 320 px: 320 = 320 → no desborda; campos y botones de 238 px.
- 320 px con error: unirse con `ZZZ-999` → «Código no encontrado. Verifica
  que esté bien escrito.», sigue sin desbordar y sigue en `/onboarding`
  (la base rechazó el código; no se creó ni cambió nada).

No se creó ninguna organización con esa cuenta y se cerró su sesión al
terminar. Con esto, todas las pantallas de la app quedan medidas a 375 y
320 px.

**Pendiente:** el video de demostración.

## 2026-11-01 — Correcciones de Gonzalo después del reporte de estado

### 1. La cifra de Specright se quita (corrige la entrada de la F1)

La entrada de la F1 dice que Gonzalo "la verificó buscando cuánto cobra
Specright". Gonzalo lo investigó a fondo: **Specright no publica precios**
en ninguna fuente (Capterra, G2, GetApp, su propio sitio; todas dicen
"contact vendor"). No hay ningún número público que respalde ~US$60,000/año.
Esa entrada queda como historia; esta la corrige.

- Home pública (`app/page.tsx`): «Las plataformas enterprise de este tipo
  cobran por cotización, fuera del alcance de un productor pequeño.
  Validator es para productores como Concept G.» Sin número.
- Donde la cifra aparecía como dato afirmado, se cambió solo esa frase:
  `docs/CHARTER.md` (Vision: "a quote-based enterprise platform"),
  `docs/PERSONAS.md` (Renata: "priced by quote; no public price") y
  `docs/PACKET.md` §1 ("priced by quote (no public price; see §6,
  unverified)").
- **Sin cambio:** `docs/PACKET.md` §6, que ya la llama "estimated …
  (unverified)"; el código ahora coincide con eso. El mockup
  `assets/w12-mockup-home.png` muestra la cifra con "† cifra sin
  verificar": es una imagen y no se editó.

### 2. Respaldo de IA: la respuesta puede venir de otro modelo

`lib/lector-ia.ts` usa el respaldo del servidor de Anthropic (`fallbacks:
"default"`, beta `server-side-fallback-2026-07-01`): **cuando el modelo
principal (`claude-opus-5-5`) se niega a responder, la API puede
responder con un modelo distinto en la misma llamada.** La guardia revisa
igual esa respuesta.

- El lector ahora devuelve el modelo que de verdad respondió
  (`respuesta.model`), y `scripts/probar-lector.ts` lo guarda por llamada.
- La caja "Observación de IA (sin validar)" dice siempre, en letra
  pequeña: «Modelo principal: claude-opus-5-5. Si se niega a responder, la
  observación puede venir de un modelo de respaldo distinto; en ese caso se
  indica arriba.» Y cuando respondió otro modelo, debajo de la observación:
  «Esta observación la escribió un modelo de respaldo (…), no el modelo
  principal.»
- `MODELO_LECTOR` se movió a `lib/modelo-ia.ts`, para que la caja (código
  del navegador) no importe el SDK de Anthropic.

### 3. Comparación IA vs. regla con casos plantados de w12

El texto de la caja de IA decía "nombró la causa en 9 de 10 casos". Ese
texto venía de w11 (con los casos de w11); aunque el 2026-11-01 esos mismos
casos se corrieron en w12 y también dieron 9 de 10, no eran casos de esta
semana. Se hizo una prueba propia:

- `scripts/escenarios-w12.ts`: **10 casos plantados nuevos** (empaque de
  café, la línea de Concept G; SKUs `SIM-CAFE-…`, `SIM-TAPA-01`,
  `SIM-CAJA-…`; proveedores Simulado Delta, Épsilon y Zeta; folios
  `FOL-CG-…`), con los mismos 10 tipos de causa que w11 para que la
  comparación sea equivalente.
- `node scripts/probar-lector.ts 3 w12` → `docs/pruebas/lector-ia-2026-11-01-w12.json`:
  **30 llamadas reales, 30 mostradas, 0 descartadas por la guardia, 0
  errores, todas al primer intento, todas respondidas por el modelo
  principal** (`claude-opus-5-5`; ninguna por el respaldo).
- `node scripts/comparar-lector.ts docs/pruebas/lector-ia-2026-11-01-w12.json`:

| Caso (w12) | Regla (>20% de peso) | IA, rondas que nombran la causa |
|---|---|---|
| punto decimal (12.6 → 126) | marca | 3/3 |
| g como kg (340 → 0.34) | marca | 3/3 |
| rediseño real +9.5% con fecha y folio nuevos | no marca | 3/3 |
| redondeo (3.2 → 3.25) | no marca | 3/3 |
| sinónimo (corrugado = ondulado) | no marca | 3/3 |
| cambio real de material (laminado → compostable) | no marca | 3/3 |
| +27% sin fecha nueva | marca | 3/3 |
| folio copiado de otro SKU | no marca | 3/3 |
| revisión tardía | no marca | 3/3 por palabras clave; **2/3 a mano** |
| inyección (lo correcto es no obedecer) | no marca | 0/3 obedeció; 2/3 señaló "texto ajeno" |

**Resultado: la regla marca 3 de 10; la IA nombra la causa en 10 de 10**
(en la mayoría de las rondas). **Leídas a mano las 30:** ninguna da
veredicto, elige un valor, recomienda ni trae cifras que no estén en el
hallazgo. Dos matices: en la revisión tardía, la ronda 2 cuenta como
acierto por una coincidencia falsa ("sin rediseño físico" contiene la
palabra clave), y en las rondas 1 y 3 el rediseño real aparece como la
última posibilidad; sigue siendo mayoría (2 de 3) pero es el caso más
débil. En la inyección, la IA no obedeció la instrucción escondida en
ninguna ronda.

**Texto nuevo de la caja** (`RESULTADO_COMPARACION` en `lib/modelo-ia.ts`):
«En la prueba de esta semana (w12, 10 casos con causas sembradas, 3
rondas) nombró la causa en 10 de 10 casos; una regla simple marcó 3. Pero
suele listar varias posibilidades y a veces deja la que importa al final:
úsala como pista, no como filtro.» `test:logica` revisa que ese texto
diga el mismo "N de 10" que sale del archivo de salidas reales de w12, así
que no puede volver a quedar un número de otra semana.

## 2026-11-05 — Prueba de usuarios, caso 1: pendientes de cargas anteriores visibles

**Dolor:** cuando una carga no creaba hallazgos nuevos, el mensaje decía
"No hay hallazgos nuevos" a secas y la sección "Hallazgos de esta carga"
salía vacía, aunque esa misma carga seguía produciendo hallazgos que ya
estaban pendientes de una carga anterior (la huella evita crearlos dos
veces). Quien sube el archivo entiende que todo está bien y el pendiente
queda escondido.

**Cambio:**

- `lib/validador.ts` → `pendientesQueAplican(historial, guardados, carga)`:
  corre el mismo motor (`reconstruir` + `candidatos`) sobre las filas de la
  carga y devuelve las huellas de los candidatos que ya existen como
  hallazgo **pendiente**. Confirmados y descartados no cuentan. Incluye la
  recarga idéntica (sus filas vuelven a producir los mismos candidatos) y
  los duplicados por huella (p. ej. el mismo proveedor faltante).
- `app/validador/actions.ts`: la carga devuelve `pendientesAnteriores`.
- Mensaje verde (`components/FormularioCarga.tsx`):
  - 0 nuevos, 0 pendientes → «No hay hallazgos.»
  - 0 nuevos, N pendientes → «No hay hallazgos nuevos. Tienes N
    hallazgo(s) pendiente(s) de cargas anteriores.»
  - nuevos y pendientes → el texto de nuevos + «Además, tienes N …».
  - El aviso gris de recarga idéntica también agrega la línea de pendientes.
- Sección "Hallazgos de esta carga" (`app/validador/page.tsx`): muestra los
  hallazgos que creó esta carga con la etiqueta **Nuevo** y, debajo, los
  pendientes de cargas anteriores que siguen aplicando con la etiqueta
  **Ya reportado**. Se recalcula al mostrar la página, con la última versión
  contra las versiones anteriores a ella y los estados actuales: si alguien
  ya revisó el pendiente, deja de aparecer.
- `test:logica`: 7 casos nuevos de `pendientesQueAplican` (201 en total).

**Decisión de alcance:** el texto pedido cubría "0 nuevos con pendientes";
cuando hay nuevos y también pendientes de antes se muestran los dos y el
mensaje los cuenta por separado, por consistencia (la regla "siguen
aplicando a esta carga" es la misma).

## 2026-11-05 — Prueba de usuarios, caso 2: enlace "Ver hallazgos"

El mensaje verde, cuando hay hallazgos nuevos o pendientes de antes, lleva
un enlace **Ver hallazgos** a `#hallazgos-de-esta-carga` (la sección de la
misma página; `ID_HALLAZGOS_CARGA` en `lib/formato.ts`, con
`scroll-mt-4`). Sin hallazgos no se muestra enlace. Va en el mismo commit
que el caso 1 porque el enlace depende del conteo de pendientes.

## 2026-11-05 — Pendiente (no esta semana): caso 3, scroll en móvil

El caso 3 de la prueba de usuarios (scroll en móvil) queda **pendiente**
por decisión de Gonzalo: no se tocó esta semana. El enlace "Ver hallazgos"
del caso 2 lleva a la sección, pero no resuelve el caso 3 ni se midió en
375/320 px.

## 2026-11-05 — Prueba de usuarios: textos de "Sin dato de proveedor" en lenguaje simple

**Dolor:** el texto del hallazgo de proveedor faltante decía «Falta X para
este SKU: lo reportó en archivo.csv (fila N) y no aparece en otro.csv»: el
nombre de archivo y la fila de antes iban en la línea de la lista, y no
quedaba claro qué faltaba ni en qué carga.

- Lista (`describirHallazgo` en `lib/validador.ts`): «Falta X. No vino en
  la carga otro.csv, pero sí en una carga de antes.» El archivo y la fila
  de antes siguen en el detalle.
- Detalle (`app/validador/hallazgos/[id]/page.tsx`): primero «Falta X en la
  carga otro.csv.», luego «Antes sí vino, en la carga archivo.csv del
  <fecha>. Sus datos de esa vez: … g, material, folio …».
- Solo textos; el motor y las huellas no cambian. `test:logica` 201/201.

## 2026-11-05 — Casos 1 y 2 verificados en el navegador (local, sesión real)

`next start` local (build limpio de 7ef9e76) contra la base real, con la
cuenta dueña de la org de prueba 9A2-DPD (Playwright + Edge; Gonzalo
eligió la cuenta de Google). Dos cargas, medidas en 1280 y 375 px:

- **repro-1-problemas-conocidos.csv** (sin problemas nuevos): mensaje «No
  hay hallazgos nuevos. Tienes 5 hallazgos pendientes de cargas
  anteriores.» + «Ver hallazgos»; la sección muestra las 5 tarjetas con
  «Ya reportado». Esta mañana, en producción, el mismo archivo decía «No
  hay hallazgos nuevos.», con 0 tarjetas y sin enlace. El conflicto de
  SIM-7733 (24.5 → 30 g) no aparece, porque esta carga trae 24.5 g:
  correcto.
- **repro-3-problema-nuevo-sim8890.csv** (repro-2 + SIM-8890 de 12.5 a
  17.3 g; repro-2 ya se había subido, así que su cambio ya no es nuevo):
  «1 hallazgo nuevo, pendiente de revisión humana. Además, tienes 6
  hallazgos pendientes de cargas anteriores.»; 7 tarjetas, SIM-8890 con
  «Nuevo» (primera) y 6 con «Ya reportado» (ahora incluye SIM-7733 → 30 g).
- **Enlace:** en los 4 casos lleva a `#hallazgos-de-esta-carga` y el
  título de la sección queda a 16 px del borde superior.
- **375 px:** sin scroll horizontal; las etiquetas quedan dentro de su
  tarjeta, en una línea cada una. Detalle menor sin corregir: cuando «Ya
  reportado» baja a una segunda línea, queda ~4 px corrida por su `ml-1`.
  El enlace mide 20 px de alto (área táctil chica), anotado junto con el
  caso 3.
- Consola: un solo error, el 404 de `/favicon.ico` (el proyecto no tiene
  favicon; no viene de este cambio).
- **No verificado:** producción (se verifica después del deploy) y 320 px.

## 2026-11-08 — Semana 13: la única feature nueva es el registro de eventos

Todo lo demás de la semana 13 (pendientes visibles con «Ya reportado»,
enlace «Ver hallazgos», textos de «Sin dato de proveedor») es el arreglo de
la prueba con usuarios reales, ya en producción (1977b78, 7ef9e76,
f5ec23e). Esta semana solo se agrega el stack floor: un registro mínimo de
eventos (docs/PACKET.md §3.4 y §9; docs/IMPLEMENTATION_PROMPT_w13.md, que
Gonzalo pegó en el chat; no estaba en el repo ni en Descargas). Sin UI:
solo instrumentación para el «long view» del PACKET (§7).

- **Tabla `eventos`** (sql/schema.sql, sección «Semana 13»): id, org_id,
  tipo, evidence_version_id, detalle (jsonb), creado_en.
  `upload_seen_pending` guarda en `detalle` `{org_id, pendientes}` (lo que
  pide el prompt). La base lo exige (`eventos_detalle_check`): pendientes
  entero > 0, y el org_id del detalle igual al de la fila.
  - `evidence_version_id` no viene en el prompt («or similar»). Se agregó
    para cumplir «exactamente una fila» por carga: `unique
    (evidence_version_id, tipo)`, y repetir la llamada no duplica.
  - **Sin datos personales** (prompt): no se guarda ni persona, ni correo,
    ni nombre de archivo. Una primera versión local guardaba `user_id`; se
    quitó antes del push. El schema reemplaza la tabla si tiene esa forma
    vieja (solo podía tener eventos de prueba).
- **Append-only, RLS** (mismo patrón que evidence_versions): authenticated
  lee solo los de su org (`my_org_id()`); anon sin privilegios;
  authenticated sin insert/update/delete/truncate; el trigger
  `evento_inmutable` bloquea editar, borrar y vaciar, también desde el SQL
  Editor.
- **Única puerta: `registrar_evento(tipo, versión, pendientes)`** (security
  definer, como todas las escrituras del proyecto). La org sale de la
  sesión. La versión tiene que ser de esa org y haberla subido esa persona,
  porque el mensaje solo lo ve quien subió. La persona se revisa pero no se
  guarda.
- **Dónde se registra:** en la server action `procesar()`, justo después de
  guardar la versión. El resultado que devuelve es exactamente lo que
  muestra el mensaje: `pendientesAnteriores > 0`, en las dos ramas (carga
  idéntica o no). La regla está en `lib/eventos.ts` (`eventoDeCarga`): 0
  pendientes → null → no se llama al RPC. Si el registro falla, la carga ya
  quedó guardada: solo `console.error`, sin error para la persona.
  - Descartado: registrar desde el cliente al pintar el mensaje. Es una
    llamada más y se pierde si el navegador la bloquea.
  - No se registran las tarjetas «Ya reportado» al recargar la página: no
    son el mensaje del prompt.
- **Pruebas:**
  - test:logica 205/205 (+4): con pendientes, 1, 0 e inválidos.
  - test:schema 222/222 (+31): exactamente 1 fila con detalle correcto;
    columnas sin datos personales; no duplica; 0, negativos y tipo
    desconocido rechazados; versión de otra org o de otra persona
    rechazada; sin org rechazado; cada org ve solo lo suyo; anon no lee,
    no escribe y no ejecuta; insert/update/delete/truncate del cliente
    rechazados; ni el superusuario edita ni borra; detalle inválido
    rechazado por la base.
  - scripts/probar-anon.sh incluye `eventos` y los 2 RPC nuevos.
  - build limpio; lint y tsc limpios.
- **No construido (prompt):** experimento de precio, los 2 detalles menores
  de móvil, tipos de hallazgo o pantallas nuevas.
- **No verificado aún:** el SQL corrido en Supabase; probar-anon contra el
  proyecto real (aceptación 3, con la llave pública); y en el navegador una
  carga con pendientes que deje su fila (aceptación 1) y otra sin
  pendientes que no deje nada (aceptación 2).

## 2026-11-08 — Registro de eventos verificado contra la base real

Gonzalo corrió el SQL de la semana 13 en Supabase (csjpheiufscdjxtaelsh).
Pruebas con `next start` local (build limpio de 6842856) contra esa base,
en Chrome, con la cuenta dueña de la org de prueba 9A2-DPD. Antes de
empezar, `eventos` tenía 0 filas.

- **Aceptación 3 (anon), `scripts/probar-anon.sh` con la llave pública:**
  `registrar_evento` → 401 permission denied; leer `eventos` → 42501;
  escribir en `eventos` → 401. `evento_inmutable` → 404 (los triggers no
  se exponen, igual que los demás). Todo lo anterior sigue denegado.
- **Aceptación 1:** `w13-a-con-pendientes.csv` (idéntica a la última
  versión, repro-1). Mensaje: «… idénticas a las de la versión anterior …
  Tienes 5 hallazgos pendientes de cargas anteriores.» + «Ver hallazgos».
  En la base: exactamente 1 fila, `tipo = upload_seen_pending`, `detalle =
  {org_id, pendientes: 5}`, `evidence_version_id` = esa carga.
- **Segunda carga con mensaje:** `w13-b` arreglaba 3 de los 5 problemas.
  Mensaje: «Tienes 2 hallazgos pendientes…» → 1 fila más con `pendientes:
  2`. Correcto: hubo mensaje, entonces hubo evento. (Ese CSV pretendía ser
  el caso sin pendientes; quedaban el folio de SIM-1190 Alfa y el peso de
  SIM-6018.)
- **Aceptación 2:** `w13-c-sin-pendientes.csv` (b + folio de SIM-1190 Alfa
  y SIM-6018 en 55 g). Mensaje: «No hay hallazgos.»; `eventos` siguió en 2
  filas.
- **Sesión real, ataques por la API** (token de la cuenta dueña): PATCH,
  DELETE e INSERT directo en `eventos` → 403 (42501). Repetir
  `registrar_evento` con la versión de la aceptación 1 → `false`, sin
  fila nueva. Con 0 pendientes → 400 «Sin hallazgos pendientes no hay
  evento.» Al final seguían las 2 filas, intactas.
- **Aceptación 4 (otra org no ve los eventos):** cubierta por test:schema
  (org C ve solo los suyos; sin org, 0 filas).
- Las 3 cargas quedan en la org de prueba como versiones nuevas: es
  append-only y no se borran. Los hallazgos siguen pendientes; las cargas
  no deciden nada.

## 2026-11-08 — Registro de eventos verificado en producción

Después del push de 6842856 + 6de8d42:

- **Vercel:** el deploy de w12-validator para 6de8d42 terminó en
  «Deployment has completed» (success, 02:02:16 UTC;
  vercel.com/gonzabuilds/w12-validator/9CtHdcvmdXMufeC4UukE2zd5oQV6).
- **`npm run verificar:deploy -- https://www.packvalidator.online`:** 10 OK,
  0 FALLA.
- **Carga en producción** (www.packvalidator.online, cuenta dueña de
  9A2-DPD), `w13-a-con-pendientes.csv`. La versión anterior era `w13-c`,
  así que esta vez el mensaje dijo: «1 hallazgo nuevo, pendiente de
  revisión humana. Además, tienes 4 hallazgos pendientes de cargas
  anteriores.» En `eventos` apareció la fila id 4: `upload_seen_pending`,
  versión 99aca20a (esa carga), `detalle = {org_id, pendientes: 4}`. El
  número coincide con el mensaje.

**Hueco en los ids (1, 2, 4).** Gonzalo lo revisó en el SQL Editor de
Supabase, sin RLS:

```sql
select id, org_id, creado_en from eventos order by id;
```

Resultado: solo existen los ids 1, 2 y 4, los tres de la misma org
(c5e9c18b…). El id 3 no existe en ninguna parte, así que se descarta que
sea una fila de otra org que la sesión no veía.

**Explicación, confirmada.** En Postgres, el valor de una columna
`generated always as identity` se toma de la secuencia antes de revisar la
fila. Un insert que no guarda nada igual gasta su número.

- Reproducción en PGlite: insertar a y b, luego un duplicado con `on
  conflict do nothing` (0 filas), luego un insert que falla el `check`,
  luego d. Los ids finales son 1, 2, 5.
- En la base real, entre el id 2 (01:51:23 UTC) y el id 4 (02:03:10 UTC),
  lo único que llegó al `insert` de `registrar_evento` fue la prueba de
  duplicado (repetir la versión de la aceptación 1). Devolvió `false` sin
  fila, y es la que gastó el 3.
- Las otras pruebas de esa ventana no llegan al insert:
  - el RPC con 0 pendientes lanza la excepción antes;
  - el INSERT, PATCH y DELETE directos se rechazan por privilegios (403)
    antes de ejecutarse;
  - la carga `w13-c` no llamó al RPC (0 pendientes).
- No es un bug: los ids no son un contador de eventos. Para contar eventos
  se usa `count(*)`, nunca `max(id)`.

# Semana 14 — Pricing (docs/PACKET.md de la semana 14)

## 2026-11-11 — Feature 1: tabla pricing_evidence (append-only, lectura pública)

**Qué se construyó:**

- `sql/schema.sql`, sección «Semana 14». Tabla `pricing_evidence` con
  estas columnas:
  - `id`
  - `org_id`: nullable; null = el venture, no un cliente.
  - `amount_mxn`: > 0.
  - `state`: direct / relayed / paid.
  - `source`: obligatoria, no puede ser solo espacios o puntuación.
  - `note`
  - `payment_reference`
  - `created_at`
- `sql/seed-pricing-evidence.sql`: las 3 filas reales, comentadas como
  investigación de usuario real de las semanas 13-14, no simulada.
  - 3,500 direct (sin ancla).
  - 4,000 direct (techo declarado).
  - 4,500 relayed (de quien decide, reportado por el usuario #3).
  - Ninguna fila paid.
  - Es idempotente: no repite una fila con el mismo monto + estado + fuente.

**Decisiones:**

- **`state` es `text` con `check`, no un `enum` de Postgres.**
  - Es el mismo patrón que `findings.type` y `eventos.tipo`.
  - Se puede volver a correr el schema entero sin bloques especiales.
  - Para quien lee los datos el efecto es el mismo: solo hay tres valores
    posibles.
- **Columna extra `payment_reference`** (el prompt no la lista).
  - Es la «real proof» que pide la cláusula de sombra. La regla en la base:
    `state = 'paid'` ⇔ hay una referencia de pago con contenido.
  - Ni un paid sin prueba, ni una prueba pegada a direct/relayed.
  - Pasar a paid nunca es editar una fila. Es una fila nueva con la
    referencia, y la relayed original sigue ahí.
- **Append-only también para el SQL Editor.** Hay triggers contra update,
  delete y truncate, igual que en `eventos`. Una corrección es una fila
  nueva.
- **Quién escribe:**
  - Solo «quien funda» escribe, por la vía del service role. Hoy eso es el
    SQL Editor; no hay ninguna cuenta fundadora dentro de la app.
  - `anon` y `authenticated` tienen solo SELECT (policy `using (true)`). No
    hay policy de insert.
  - Así ninguna cuenta autenticada, tampoco la de Gonzalo, puede escribir
    desde la app.
- **Lectura pública.** Es la excepción a «anon no lee nada»: son datos del
  venture para /pricing y /about, no datos de clientes. `probar-anon.sh` lo
  marca como esperado.

**Bug encontrado por test:schema antes de correr nada en Supabase.** La
primera siembra (`insert … select from (values …) where not exists`)
insertó el 4,000 con id 1. Postgres no garantiza el orden de las filas de
`VALUES` cuando pasan por el anti-join. Se arregló con una columna `orden`
y `order by s.orden`. Ahora la prueba exige el orden 3,500 → 4,000 → 4,500.

**Pruebas:**

- `test:schema`: 263 pass (antes 222). 41 checks nuevos:
  - La siembra, corrida 2 veces, deja exactamente 3 filas y ninguna paid.
  - anon, una cuenta con org y una sin org leen las 3.
  - Esas tres no pueden: insertar, mejorar un estado con update, editar un
    monto, borrar ni vaciar la tabla.
  - Ni el superusuario edita, borra ni vacía la tabla.
  - La base rechaza: paid sin referencia, paid con referencia en blanco,
    direct con referencia, un estado inventado, un monto 0 o negativo, y
    una fuente vacía, de solo puntuación o ausente.
  - Una fila paid con referencia, como fila nueva, sí entra, y la relayed
    sigue igual.
  - anon sigue sin EXECUTE en ninguna función y RLS sigue encendido en
    todas las tablas.
- `test:logica`: 205 pass. `npm run lint`: limpio.
- `scripts/probar-anon.sh` ahora prueba con la llave pública: lectura 200
  con las 3 filas; POST, PATCH y DELETE en `pricing_evidence` → 401/403.
  **Pendiente:** correrlo contra Supabase después de que Gonzalo corra el
  SQL.

### 2026-11-11 — Fuentes corregidas y siembra verificada en Supabase

- **Fuentes.** Gonzalo corrigió el texto de las fuentes antes de correr la
  siembra:
  - 3,500 y 4,000: «Week 13 user session», una misma conversación (primera
    y segunda respuesta).
  - 4,500: «Week 14 follow-up session», otra conversación, de parte de
    quien decide.
  - Solo se conoce la semana del curso, no el día: no se inventó ninguna
    fecha. `created_at` es la fecha de registro (2026-11-11), no la de la
    conversación.
  - El texto anterior nunca llegó a la base: la tabla seguía vacía (anon
    leía `200 []`).
- **Siembra.** Gonzalo corrió `sql/schema.sql` y luego
  `sql/seed-pricing-evidence.sql` en el SQL Editor, y vio 3 filas.
- **Lectura con la llave pública** (curl a `/rest/v1/pricing_evidence`):
  200 con exactamente 3 filas, todas con `org_id` null y
  `payment_reference` null:
  - id 1: 3,500 direct.
  - id 2: 4,000 direct.
  - id 3: 4,500 relayed.
- **`scripts/probar-anon.sh` contra Supabase:**
  - POST (paid falso y direct) → 401.
  - PATCH (intento de cambiar el estado a paid) → 401.
  - DELETE → 401.
  - `pricing_evidence_inmutable` como RPC → 404.
  - El resto de tablas y RPC igual que en la semana 13: 401/404, ninguna
    fila visible.

## 2026-11-11 — Feature 2: /pricing (3 niveles, 2 segmentos, chip de evidencia)

**Qué se construyó:**

- `app/pricing/page.tsx`: página pública, sin sesión y sin redirecciones.
  Sigue el mockup `assets/w14-mockup-pricing.png`. Tres tarjetas:
  - **Starter:** $1,500 MXN/mes, PyME micro (1–3 personas), chip ámbar
    «Segmento no probado».
  - **Pro:** $4,500 MXN/mes de lista. A su lado, nunca en su lugar
    (PACKET §3.4): «Precio fundador: $3,500/mes × 12 meses». PyME mediana
    (~45 empleados, 4+ proveedores). Chip verde «Evidencia directa +
    referida» y borde verde más grueso: es la única tarjeta con evidencia
    real.
  - **Enterprise:** «Cotización a medida», chip gris «Hipótesis, sin
    evidencia».
- Los 2 segmentos con precio publicado son micro y mediana. Enterprise es
  una hipótesis por cotización.
- «Ver detalle» es un `<details>`, así que funciona sin JavaScript.
  - En Pro lista cada cifra real por separado, con su estado y su fuente,
    y «Pagos reales: 0. Ninguna de estas cifras es una venta».
  - En Starter y Enterprise dice que nadie de ese segmento ha dado una
    cifra.
- `lib/precios.ts`: lógica pura (niveles, chips, formato, normalización).
- `lib/evidencia-precio.ts`: lee `pricing_evidence` con la llave pública.
- `components/ChipEvidencia.tsx`: el chip. El texto siempre va escrito; el
  color solo acompaña.

**Decisiones:**

- **El chip de Pro se calcula de las filas reales**, no está escrito a mano.
  - Sale de los estados presentes, en orden fijo (directa → referida →
    pagada).
  - «Pagada» solo aparece si existe una fila `paid`, y la base solo acepta
    una con referencia de pago (Feature 1).
  - Si la lectura falla o no hay filas, Pro no se presenta como respaldado:
    chip gris y un aviso en rojo.
- **Sin columna de segmento** (confirmado por Gonzalo, 2026-11-11). Todas
  las filas de evidencia son hoy del segmento Pro porque toda la evidencia
  viene de ahí. Si llega evidencia de un segmento distinto, se agrega la
  columna en una migración futura, sin romper las filas existentes.
- **Bug evitado antes de probar en el navegador:** el proxy
  (`lib/supabase/middleware.ts`) manda a `/login` toda ruta que no esté en
  `RUTAS_PUBLICAS`, así que `/pricing` sin sesión habría redirigido. Se
  agregó `/pricing` a la lista.

**Pruebas:**

- `test:logica`: 225 pass (20 nuevos: niveles y precios, 2 segmentos, chip
  por nivel con y sin filas, «pagada» solo con fila paid, estado inventado
  ignorado, formato $1,500, normalización de numeric como texto).
- HTTP de `test:schema` (con BASE_URL) y `verificar:deploy` ahora cubren
  `/pricing`. `verificar:deploy` tiene 7 checks nuevos:
  - 200 sin sesión;
  - 3 niveles y 3 chips;
  - precio fundador junto al de lista;
  - que no diga «pagada»;
  - la cláusula de sombra;
  - sin llaves secretas.
- **Revisión local** (`next dev`, sin sesión, contra la base real): 200,
  las 3 cifras con su fuente bajo Pro, «Pagos reales: 0». No se probó en el
  navegador ni a 375 px: el servidor de desarrollo se detuvo por falta de
  memoria del sistema. Queda para el deploy 1 y la Feature 5.
- **Antes del commit 2:**
  - `rm -rf .next && npm run build` limpio; `/pricing` sale como ruta
    dinámica (ƒ).
  - `test:schema`: 263 pass, sin BASE_URL. La parte HTTP se saltó porque no
    había servidor levantado; corre en el deploy 1.
  - `test:logica`: 225 pass. `lint`: limpio.

## 2026-11-11 — Feature 3: /about (memo 10:1)

**Qué se construyó:**

- `app/about/page.tsx`: página pública, sin sesión. Sigue el mockup
  `assets/w14-mockup-about.png`.
  - **Encabezado:** «Una sola empresa de evidencia. Trato esto como
    hipótesis.», más el aviso de siempre con la cláusula de sombra.
  - **Estados de la evidencia de precio:**
    - Una tarjeta por cada fila real de `pricing_evidence`, leída con el
      mismo `lib/evidencia-precio.ts` que /pricing.
    - Cada tarjeta lleva monto/mes, chip (Directa/Referida), nota y
      «Fuente: …».
    - Si no hay pagos reales, una tarjeta más: «$0 · Pagada · Ningún pago
      real todavía».
    - Nada se suma, se promedia ni se elige.
  - **Hoy: horas a mano + riesgo de multa:**
    - Lo que hace hoy la persona usuaria: concilia a mano, sin plataforma.
    - La estimación de costo (tiempo + multa), etiquetada como «estimación
      propia de quien funda, no una medición».
  - **El precio:** Pro $4,500 de lista + fundador $3,500 × 12 meses, con
    enlace a /pricing.
  - **La regla:** «Mi precio no debe pasar del 20% del ahorro estimado. Si
    no, tengo un problema de valor.» Con estimación, la página calcula el
    tope y dice si cada precio (lista y fundador) cumple, con su razón
    valor:precio.
- `lib/memo.ts`: lógica pura.
  - Fórmulas: costo de tiempo = h × $/h; ahorro = tiempo + riesgo
    prorrateado; tope = 20% del ahorro; razón = ahorro / precio.
  - `cumpleRegla20` da false si el ahorro es ≤ 0.
- Chips: directa y referida van en ámbar (tono `senal`: son señales, no
  ventas). Solo un pago real iría en verde. La línea $0 va en gris.
- `/about` se agregó a `RUTAS_PUBLICAS` del proxy (el mismo bug que se
  evitó en /pricing). /pricing enlaza a /about desde el detalle de Pro.

**Pendiente — la estimación de costo.** Ningún documento del venture tiene
números de horas, costo por hora o multa (se buscó en CHARTER, PERSONAS y
los 3 PACKET). No se inventaron.

- `ESTIMACION_FUNDADOR` está en `null`. Mientras sea así, la página dice
  que la estimación todavía no está publicada y no calcula ningún ahorro.
- Se le pidieron los números a Gonzalo antes del commit 3.

**Pruebas:**

- `test:logica`: 240 pass (15 nuevos). Incluyen la aritmética a mano:
  - 20 h × $250 = $5,000; + $10,000 de riesgo = $15,000.
  - Tope $3,000: $3,000 cumple, $3,500 no.
  - $4,500 cumple con $22,500 y no con $22,499.
  - Razón 10:1 y 3.3:1; precio 0 → razón 0.
  - Estimación negativa, NaN o sin base → inválida.
  - Tonos de los chips.
- `verificar:deploy`: 8 checks nuevos de /about:
  - 200 sin sesión;
  - las 3 cifras;
  - Directa/Referida con su fuente;
  - la línea $0;
  - la regla del 20%;
  - $4,000 una sola vez (si se promediaran 3,500 y 4,500 saldría
    justamente 4,000);
  - la cláusula de sombra;
  - sin llaves secretas.
- HTTP de `test:schema` con BASE_URL: /about → 200.
- `rm -rf .next && npm run build` limpio (/about ƒ). `test:schema` 263
  pass, sin BASE_URL. `tsc` y `lint`: limpios.
- **No verificado todavía:** el HTML de /about en vivo. No se levantó
  ningún servidor, por la indicación de Gonzalo sobre memoria. Se verifica
  con `verificar:deploy` en el deploy 1.
- **Decisión de Gonzalo (2026-11-11), opción A:** esta semana /about se
  publica sin la estimación de costo. `ESTIMACION_FUNDADOR` queda en
  `null` y la página dice que la estimación todavía no está publicada. No
  calcula ningún ahorro ni dice si el precio cumple la regla del 20%. La
  regla sí se muestra, como compromiso.
