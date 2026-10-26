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

**Proyecto real (2026-10-25):** Gonzalo creó el proyecto de Supabase de
esta semana, corrió `sql/schema.sql` y llenó `.env.local` (formato
revisado sin imprimir valores: URL base `https://….supabase.co`, llave sin
espacios, `.env.local` ignorado por git). `bash scripts/probar-anon.sh`
con la llave pública: los 4 RPCs → 401 `permission denied`, las 5 tablas
→ `permission denied` (42501), insertar en `evidence_versions` y
`decisions` → 401. **anon no puede leer ni escribir nada.**

**No verificado todavía:** login con Google contra este proyecto (se
prueba en el navegador con la Feature 2, que es la primera que necesita
sesión, y en producción en el deploy 1).

## 2026-10-25 — Feature 2: carga y versionado append-only

**Qué cambió:** `/validador` con zona para arrastrar/seleccionar un CSV,
botón "Validar carga", botón "Cargar ejemplo (datos simulados)" y la
lista de versiones guardadas (archivo, fecha en hora de CDMX, quién la
subió, filas aceptadas/rechazadas y el detalle de cada rechazo).

- `lib/csv.ts` (lógica pura): tipo (`.csv` y un tipo MIME de texto/CSV;
  Excel en Windows manda `application/vnd.ms-excel`), tamaño (200 KB,
  revisado otra vez sobre los bytes que llegan, no sobre lo que declara
  el cliente), UTF-8 estricto (`TextDecoder` con `fatal`), las 6 columnas
  obligatorias (cabecera sin importar mayúsculas, BOM o espacios), máximo
  1000 filas, comillas RFC 4180. Cada fila inválida se reporta con su
  número de línea y su motivo; las válidas se guardan igual.
- **Números:** punto o coma decimal (`12.5`, `12,5`, `0,125`). Se rechazan
  `1e3`, `NaN`, `Infinity`, signos y separadores de miles. **Decisión:**
  `1,500` y `1.500` son ambiguos (¿miles o decimales?) y se rechazan con
  ese motivo en vez de adivinar.
- **Decisiones menores:** se acepta `;` como separador (Excel en español
  exporta así, y entonces la coma decimal no necesita comillas); las
  columnas desconocidas se ignoran y se avisan en pantalla; una línea
  vacía no cuenta como fila (no tiene datos que perder); SKU+proveedor
  repetido en el mismo archivo se rechaza (el motor compara por esa
  pareja); fechas `AAAA-MM-DD` reales, desde 2000 y no en el futuro (hoy
  en hora de CDMX); texto que empieza con `= + - @` se rechaza (fórmulas
  si alguien abre los datos en una hoja de cálculo).
- **[REEMPLAZADA el mismo día, ver la corrección de abajo]** **Recarga
  idéntica (decisión que el prompt pide documentar):** si las
  filas válidas son las mismas que las de la **última** versión de la org
  (huella sha256 sin números de fila: da igual el orden, los saltos de
  línea o las comillas), **no se guarda una versión nueva** y la pantalla
  lo dice ("No se guardó una versión nueva y no se crearon hallazgos").
  Volver a los valores de una versión más vieja sí crea versión: es un
  cambio real respecto a la última.
- **Base (`sql/schema.sql`):** la única puerta de escritura es el RPC
  `registrar_version()` (security definer). La base **vuelve a validar**
  cada fila (`validar_filas_evidencia`, en un trigger `before insert`) y
  **calcula ella misma la huella**: un cliente que llame al RPC directo
  no se salta la validación ni inventa la huella. `uploaded_by` y
  `org_id` los pone la base (`auth.uid()`, `my_org_id()`). Un
  `pg_advisory_xact_lock` por org evita que dos pestañas decidan "no es
  duplicada" a la vez.
- **Append-only:** sin privilegios de update/delete para el cliente, y un
  trigger que rechaza update, delete y truncate para todos, incluido el
  service role y el SQL Editor.

**Bugs reales encontrados por `test:schema` (antes del commit):**

1. Una fila rechazada sin motivo (`{fila: 3}`) pasaba la validación de la
   base: `jsonb_typeof(r -> 'motivo') <> 'string'` da NULL cuando falta la
   clave, y el `if` trata NULL como falso. Arreglado con `is distinct
   from`; de paso, cada cast (`::int`, `::numeric`) quedó en su propio `if`
   después de revisar el tipo, porque SQL no garantiza el orden de
   evaluación de un `or`.
2. El RPC revisaba "¿es duplicada?" antes de validar, así que una carga
   inválida con las mismas filas válidas recibía "duplicada" en vez del
   error. Ahora valida primero.

**Pruebas:**

- `npm run test:logica`: **71/71** (archivo, números, fechas, CSV mixto
  con 9 filas malas de 9 tipos distintos, punto y coma, BOM, columnas
  faltantes/repetidas, binario, >1000 filas, todas inválidas).
- `npm run test:schema`: **87/87** (las 48 de la Feature 1 más: versión
  nueva con procedencia, recarga idéntica y reordenada → duplicada sin
  guardar, cambio de peso → versión nueva, volver a v1 → versión nueva,
  la duplicidad es por org; nadie edita ni borra (dueño, misma org, otra
  org, anon, service role, truncate); 11 cargas basura por RPC directo
  rechazadas por la base; sin org → rechazado; anon sin EXECUTE en
  ninguna función).
- `bash scripts/probar-anon.sh` contra el proyecto real (después de que
  Gonzalo corrió el SQL): los 7 RPCs → 401 `permission denied` (las 2
  funciones de trigger → 404, PostgREST no las expone), las 5 tablas →
  `permission denied`, anon no inserta, no edita, no borra versiones.
- **Navegador, contra el proyecto real (`next start` local):** login con
  Google (selector de cuenta visible), org `Validador Simulado W11`
  (código TPK-F9Z). "Cargar ejemplo" → versión con 10 filas; otra vez →
  "mismas filas válidas que la última versión", sigue 1 versión. CSV con
  6 filas malas (`1e3`, `1.234`, mes 13, `NaN`, proveedor `=HYPERLINK`, 5
  columnas) → 1 aceptada, las 6 con su fila y motivo, versión guardada. 7
  archivos que se rechazan completos sin guardar nada (`.txt`, `.csv`
  con tipo `image/png`, falta columna, 210 KB, Latin-1, todas las filas
  malas, solo cabecera) → cada uno con su mensaje; siguen 2 versiones.
- **Append-only con sesión real, por la API REST** (llave pública +
  token de la sesión, sin imprimir ninguno): como **dueño**
  (gonzalo.patlan5): PATCH, DELETE e INSERT directo → 403; RPC con peso
  `"1e3"` → 400 "Versión rechazada: weight_g inválido en la fila 2". Como
  **no dueño de la misma org** (gonzalopatlan.builds, se unió con el
  código escrito `tpkf9z`): PATCH, DELETE de una, DELETE de todas e
  INSERT a nombre de otro → 403. v1 intacta y 2 versiones al final.

**No verificado todavía:** ancho de celular (se revisa en el pulido de
la Feature 5) y producción (deploy 1, después de la Feature 3).

## 2026-10-25 — Corrección de la Feature 2: toda carga válida es una versión

**Qué estaba mal:** con una recarga idéntica a la última versión,
`registrar_version()` **no guardaba nada** y devolvía la versión vieja. Lo
confirmó la prueba en el navegador ("Cargar ejemplo" dos veces → seguía
habiendo 1 versión). Eso contradice el packet ("el archivo se vuelve una
versión nueva e inmutable"): Gonzalo lo detectó antes del push. El prompt
permitía las dos opciones si se documentaba; se eligió la equivocada.

**Decisión (de Gonzalo):** **toda carga válida se guarda como versión
nueva**, tenga o no cambios. Lo que cambia con una carga idéntica no es
si se guarda, sino que el motor de hallazgos (Feature 3) no genera nada
nuevo a partir de ella. Queda registro de que alguien volvió a subir lo
mismo, con su propia procedencia (quién, cuándo, qué archivo).

**Cómo quedó:**

- `evidence_versions.identical_to_previous` (boolean): true si las filas
  válidas tienen la misma huella que la **versión anterior de la org**
  (solo la inmediata anterior: volver al contenido de una versión más
  vieja es un cambio real y no se marca). La calcula el trigger de
  inserción, igual que la huella; nunca el cliente. Aunque alguien
  inserte desde el SQL Editor mandando `false`, la base la recalcula.
  La Feature 3 la leerá para no generar hallazgos.
- `evidence_versions.seq` (bigint identity): orden exacto de las versiones.
  `uploaded_at` no bastaba: dos inserciones en la misma transacción
  comparten `now()` y el desempate era un uuid al azar. La Feature 3
  necesita saber sin ambigüedad cuál es la última.
- `registrar_version()` ya no tiene camino de "no guardar": valida, toma
  el candado de la org, inserta y devuelve `identical_to_previous`. Se
  hace `drop function` antes de crearla porque cambió su tipo de retorno.
- Pantalla: "se guardó como una versión nueva, pero sus filas válidas son
  idénticas a las de la versión anterior: no hay cambios que revisar", y
  la versión lleva la etiqueta "Idéntica a la anterior" en la lista.
- En el proyecto real, las 2 versiones que ya existían reciben `seq` al
  agregar la columna y `identical_to_previous = false` (correcto: ninguna
  era idéntica a la anterior, porque antes una idéntica no se guardaba).

**Pruebas:** `test:schema` **90/90**. Las 5 pruebas de duplicado se
invirtieron: recarga idéntica → versión nueva con la marca y con su
propia procedencia (la subió B); filas reordenadas → versión nueva
marcada; cambio de peso y vuelta a v1 → versiones nuevas sin marca; otra
org → sin marca. Nuevas: `seq` estrictamente creciente, y la base
recalcula la marca y la huella aunque el insert venga del SQL Editor con
valores falsos. Prueba de mutación: forzar la marca siempre a `false` → 4
FAIL, exactamente esas; restaurado → 90/90. `test:logica` 71/71, lint y
build limpios.

**Contra el proyecto real (después de que Gonzalo corrió el SQL):**
`probar-anon.sh` igual que antes (los 7 RPCs y las 5 tablas negados a la
llave pública; no inserta, no edita, no borra). Chrome se congeló al
repetir la prueba en el navegador (705 MB de RAM libre de 7.8 GB; el
servidor respondía en milisegundos), así que después de 3 intentos se
paró y **Gonzalo la hizo a mano** en `localhost:3000/validador`, con la
sesión de gonzalopatlan.builds: "Cargar ejemplo" 1 → "se guardó como una
versión nueva: 10 filas aceptadas" (no idéntica: la última era
`proveedor_octubre_malo.csv`); "Cargar ejemplo" 2 → "se guardó como una
versión nueva, pero sus filas válidas son idénticas a las de la versión
anterior"; la lista muestra 4 versiones y la más nueva lleva "Idéntica a
la anterior". Los 4 puntos esperados se cumplieron.

## 2026-10-25 — Feature 3: motor determinista de hallazgos

**Qué cambió:** `lib/validador.ts`, funciones puras sin IA, sin base y sin
red. La server action lee el historial y los hallazgos de la org (con la
sesión del usuario, así que RLS aplica), corre el motor y guarda versión +
hallazgos con `registrar_version()` **en una sola transacción**. La
pantalla muestra "Hallazgos de esta carga" como en el mockup (SKU, tipo,
descripción armada por código, estado "Pendiente") y la frase "Cada
hallazgo requiere revisión humana. El validador no decide cumplimiento."

**Las 4 reglas** (cada una compara contra la **última evidencia aceptada**
del mismo SKU + proveedor):

- `missing_supplier`: un SKU que el proveedor reportó (en su última fila
  aceptada) y que no viene en esta carga. **Solo se juzga a los
  proveedores que vienen en la carga**: un archivo por proveedor es lo
  normal, así que un archivo solo de Beta no marca faltantes de Alfa.
- `value_conflict`: el peso o el material cambiaron. Un hallazgo por SKU +
  proveedor con la lista de cambios, los dos valores y las dos
  procedencias (archivo + fila; la anterior además con versión, quién y
  cuándo). El material se compara sin mayúsculas ni espacios extra
  (`PET` = `pet`).
- `late_revision`: `packaging_revision_date` es **posterior** (estricto) a
  la fecha de carga, en hora de CDMX, de la última evidencia aceptada. El
  mismo día no cuenta.
- `possible_duplicate`: el folio ya se usó en **otro SKU u otro proveedor**
  (en una versión anterior o en esta misma carga), sin importar
  mayúsculas. Etiqueta fija "Posible duplicado, sin verificar".

**"Última aceptada" (decisión de Gonzalo, implementada):** el motor
reconstruye el historial en orden de `seq` aplicando los estados actuales:
una fila se acepta si no produjo hallazgos o si **todos** los suyos
fueron descartados. Un hallazgo pendiente, confirmado **o que nunca se
guardó** (por ejemplo, versiones subidas antes de existir el motor) deja
la fila sin aceptar: nada que nadie revisó se vuelve referencia. Las
versiones marcadas "idéntica a la anterior" se saltan: si no, recargar el
archivo del 2-oct el día 20 "renovaría" la fecha aceptada y una revisión
del 9-oct dejaría de ser tardía (lo encontró una prueba de mutación, ver
abajo).

**No se crea dos veces:** cada hallazgo tiene una huella (`fingerprint`:
tipo + SKU + proveedor + valores en juego), única por org en la base
(`on conflict do nothing`). Una carga que repite un problema ya
registrado no lo duplica; una carga idéntica a la anterior no produce
ninguno (el motor devuelve `[]` y además la base no guarda hallazgos en
una versión marcada idéntica, aunque el cliente los mande). Si un SKU
vuelve, se acepta y luego vuelve a faltar, es un hallazgo nuevo (la huella
incluye la versión de referencia).

**El estado solo cambia con una decisión:** el RPC rechaza un hallazgo que
traiga la clave `status`; un trigger exige `pending` en todo insert
(también desde el SQL Editor), rechaza todo update salvo el que haga el
flujo de decisiones (Feature 4, que encenderá `validador.desde_decision`
dentro de su transacción) y aun así solo deja cambiar `status`, y rechaza
delete y truncate. El cliente no tiene privilegios de escritura sobre
`findings`.

**Carrera entre dos cargas:** el motor calcula contra el historial que
leyó; el RPC recibe `p_base_seq` (la última versión que vio) y, con el
candado de la org tomado, rechaza con `CAMBIO_CONCURRENTE` si entró otra
carga en medio. La acción recalcula y reintenta una vez.

**Límite honesto de `late_revision`:** necesita evidencia aceptada subida
un **día anterior**, porque una fecha de revisión no puede estar en el
futuro (Feature 2). En las pruebas la evidencia base se fecha en el pasado
como superusuario. En la app real, la prueba 3 del packet solo se puede
hacer al día siguiente de cargar la evidencia base (la org de prueba ya
tiene versiones de hoy, 25-oct).

**Pruebas:**

- `npm run test:logica`: **113/113** (42 nuevas): un par antes/después por
  tipo y sus bordes (archivo de un solo proveedor, mismo día, hora de CDMX
  vs UTC, SKU nuevo, folio en minúsculas, folio repetido en la primera
  carga, mismo SKU+proveedor+folio reenviado), dedup, aceptación con cada
  estado, hallazgo nunca guardado, versión idéntica en medio,
  determinismo (misma entrada → misma salida, el orden del historial no
  importa) y textos: ninguno dice "verificado/a" salvo "sin verificar" ni
  afirma cumplimiento, reciclaje o recuperación.
- **Prueba de mutación del motor:** 5 mutaciones (aceptar lo confirmado,
  folio sensible a mayúsculas, no saltar versiones idénticas, `>=` en la
  fecha, juzgar proveedores ausentes) → 4 detectadas a la primera. La que
  sobrevivió (no saltar versiones idénticas) mostró que faltaba la prueba
  de la "fecha renovada"; se agregó y ahora la detecta.
- `npm run test:schema`: **119/119** (29 nuevas): flujo de punta a punta
  igual al de la server action, con historial leído bajo RLS: una carga
  con las 4 situaciones del packet guarda exactamente 5 hallazgos
  pendientes con valores y procedencias; recarga idéntica → versión nueva
  con 0 hallazgos aunque el cliente mande uno inventado; repetir problemas
  + 1 cambio → solo 1 nuevo; hallazgos con `status` o con tipo `cumple` →
  rechazados; historial viejo → `CAMBIO_CONCURRENTE` sin guardar nada;
  nadie (dueño, misma org, otra org, anon, service role) cambia el estado,
  borra o hace truncate; con la bandera de decisión solo cambia el estado
  (control positivo); otra org no ve nada. Mutaciones del SQL (guardar
  hallazgos en versiones idénticas, aceptar `status`, quitar la revisión
  de `p_base_seq`) → cada una con su FAIL; restaurado → 119/119.
- `npm run verificar:deploy -- <url>` (nuevo, para el deploy 1): `/login`
  200 sin sesión, sin muro de Vercel, con aviso de datos simulados y sin
  llaves; `/validador` y `/onboarding` → `/login`; ruta inexistente sin 500.
- Build limpio, lint sin warnings.

**Bug encontrado antes de la prueba en el navegador:** al simular con el
motor el historial real de la org de prueba (`scripts/generar-pruebas.ts`),
el texto del duplicado decía "citado en 3 filas (SIM-1190, SIM-1190,
SIM-1190)": contaba cada uso del folio (v1, v3 y la misma carga) en vez de
los pares SKU + proveedor distintos. La huella ya usaba pares distintos;
solo el texto estaba mal. Arreglado ("también citado para SIM-1190
(Proveedor Simulado Alfa)") con su prueba: `test:logica` **114/114**.

**Contra el proyecto real (después de que Gonzalo corrió el SQL):**
`probar-anon.sh`: los RPCs (incluido el nuevo `registrar_version` de 6
argumentos) → 401; `hallazgo_protegido` → 404 (función de trigger, no
expuesta); 5 tablas → `permission denied`; anon no cambia el estado de un
hallazgo → 401. Chrome se volvió a congelar (714 MB de RAM libre), así que
**Gonzalo hizo la prueba a mano** con los CSV de `docs/pruebas/` (datos
simulados, generados por `node scripts/generar-pruebas.ts`, que también
imprime lo que el motor espera contra el historial real), sesión de
gonzalopatlan.builds, org TPK-F9Z:

1. `f3-1-faltante-conflicto-duplicado.csv` → "4 hallazgos nuevos": conflicto
   SIM-1190/Alfa 18.2 → 24.5 g, posible duplicado sin verificar en SIM-1190
   y SIM-2034 (FOL-SIM-0001), y falta de Alfa en SIM-4821; los 4 pendientes.
2. El mismo archivo otra vez → versión idéntica, 0 hallazgos.
3. `f3-3-un-cambio-mas.csv` → 1 hallazgo nuevo (SIM-6018/Beta 55 → 60 g),
   sin repetir los 4 anteriores.

Todo salió como lo predijo el motor. `late_revision` no se puede probar
todavía en la app real (necesita evidencia de un día anterior; se hará en
la prueba mecánica final); está cubierta por `test:logica` y
`test:schema`.

**Falta:** deploy 1 (Vercel) y `verificar:deploy` contra producción.

## 2026-10-25 — Deploy 1 (Vercel)

- Gonzalo creó el proyecto en Vercel (Root Directory
  `w11-validador-evidencia`, las 2 variables de entorno
  `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Deployment
  Protection apagado) y configuró Site URL / Redirect URLs en Supabase.
  Producción: https://w11-validador-evidencia.vercel.app
- `npm run verificar:deploy -- https://w11-validador-evidencia.vercel.app`
  desde fuera, sin cookies: **7/7** — `/login` 200 sin sesión, sin muro de
  Vercel, con el aviso de datos simulados y sin llaves secretas;
  `/validador` y `/onboarding` → `/login`; ruta inexistente sin 500.
  Además: `/` → `/login`, `/auth/callback` sin `code` → `/login?error=auth`.
- El bundle público apunta al proyecto de Supabase de w11 con la URL base
  (sin `/rest/v1/`), y la única llave que trae es la `anon` (rol del JWT
  revisado sin imprimirla); ninguna mención de `service_role`.
- **Login con Google en producción: verificado por Gonzalo** (Chrome se
  congela en esta máquina, así que lo hizo a mano): selector de cuenta,
  entra a `/validador` con sus versiones y hallazgos de la org TPK-F9Z, y
  "Cerrar sesión" regresa a `/login`.
- **Primer paso de la próxima sesión:** Feature 4 (revisión humana con
  nota obligatoria y bitácora de decisiones append-only).

## 2026-10-25 — Feature 4: revisión humana y bitácora de decisiones

**Qué cambió:**

- `/validador/hallazgos`: todos los hallazgos de la org con filtro por
  estado (Pendiente, Confirmado, Descartado, Todos) y el conteo de cada
  uno; por defecto, los pendientes. Un valor desconocido en `?estado=`
  cae en pendientes. Muestra los 200 más recientes (y lo dice si hay más).
- `/validador/hallazgos/[id]` (mockup, pantalla 2): título "SKU — tipo",
  caja de datos según el tipo (en un conflicto de peso, los dos valores y
  la diferencia porcentual calculada por código, "+34.6% respecto al valor
  anterior"), procedencia de los dos lados (archivo, fila, quién, cuándo;
  "Versión anterior conservada, no sobrescrita"), los dos botones del
  mockup ("Confirmar discrepancia" / "Descartar (error)") con una línea
  que dice qué significa cada uno para la evidencia aceptada, la nota
  obligatoria y el historial completo de la más vieja a la más nueva,
  marcando la vigente. Un id que no es uuid o de otra org → 404 (RLS).
- Navegación "Cargar evidencia" / "Hallazgos" y las tarjetas de hallazgos
  llevan a su revisión.

**Base (`sql/schema.sql`):**

- `registrar_decision(finding, decision, note)` (security definer) es la
  única puerta del cliente: exige sesión y org, `confirmed|discarded`, nota
  con al menos un carácter que no sea espacio en blanco y máximo 1000;
  bloquea el hallazgo (`for update`) para que dos decisiones simultáneas
  queden en orden; "Hallazgo no encontrado" igual si no existe o si es de
  otra org (no revela cuál).
- **El estado del hallazgo es siempre el de su última decisión**: lo pone
  un trigger `after insert` de `decisions`, así que se cumple por cualquier
  camino (también una fila insertada desde el SQL Editor). Ese trigger
  enciende la bandera `validador.desde_decision` (la única llave que
  acepta el trigger de `findings` de la Feature 3) y la apaga en la misma
  función, para que no quede encendida en el resto de la transacción.
- Un trigger `before insert` pone el `org_id` del hallazgo (rechaza otro)
  y quita los espacios sobrantes de la nota.
- `decisions` es append-only: el cliente no tiene privilegios de escritura
  y un trigger rechaza update, delete y truncate para todos. Cambiar de
  opinión es una fila nueva; repetir la misma decisión con otra nota
  también se permite (agrega información, no edita).

**Bug real encontrado por `test:schema`:** una nota de puros saltos de
línea y tabs (`"   \n\t "`) **se aceptaba** y se guardaba como `"\n\t"`:
`btrim()` de Postgres solo quita espacios, no saltos de línea ni tabs, y
tanto el RPC como el check de la tabla (de la Feature 1) usaban `btrim`.
La prueba de la Feature 1 solo probaba espacios. El mismo hueco existía en
la validación de filas de la Feature 2 (un proveedor o material de puros
`\n\t` pasaba por el RPC directo). Arreglado en los tres lugares con
`~ '\S'` (al menos un carácter que no sea espacio en blanco) y un recorte
real con `regexp_replace`; el check de la tabla se vuelve a crear con
nombre fijo para que el arreglo llegue también al proyecto real, donde la
tabla ya existe. Pruebas nuevas para proveedor y material; prueba de
mutación (volver a `btrim` en los 4 lugares) → 3 FAIL, exactamente esos.

**Una prueba mía estaba mal, no el motor:** esperaba que, tras descartar
el conflicto de SIM-1190/Alfa, el siguiente cambio se comparara contra
24.5. Seguía comparando contra 18.2 porque esa misma fila tiene otro
hallazgo pendiente (posible duplicado de FOL-SIM-0001), y la regla de
Gonzalo es que una fila se acepta solo si **todos** sus hallazgos están
descartados. La prueba ahora verifica las dos mitades: con el duplicado
pendiente la referencia sigue en 18.2; al descartarlo también, 24.5 pasa
a ser la referencia.

**Pruebas:**

- `npm run test:logica`: **128/128** (14 nuevas): nota vacía, de
  espacios, de saltos de línea/tabs o ausente → "La nota es obligatoria";
  1000 caracteres sí, 1001 no; decisión `resuelto` y id no-uuid
  rechazados; diferencia porcentual (+34.6% del mockup, negativa, 0.0%,
  anterior 0 → no se calcula); ningún texto de decisión dice verificado
  ni afirma cumplimiento o reciclaje.
- `npm run test:schema`: **164/164** (45 nuevas): nota vacía / espacios /
  saltos de línea / null / 1001 → rechazadas por la base sin crear fila;
  confirmar → estado y `decided_by`; cambiar de opinión → fila nueva y el
  estado sigue a la última; repetir decisión → otra fila; otra org, sin
  org, anon e id inexistente → rechazados; nadie (dueño, misma org, otra
  org, anon, service role) edita, borra, hace truncate ni inserta directo;
  el historial no se encoge; insertar desde el SQL Editor también mueve el
  estado; org equivocado → rechazado; la bandera no queda encendida; de
  punta a punta con el motor, la regla de "todos descartados".
- Build limpio, lint sin warnings (un `setState` dentro de un efecto se
  reemplazó por un `key` que vuelve a montar los campos tras guardar).

**Contra el proyecto real (después de que Gonzalo corrió el SQL):**

- `probar-anon.sh`: `registrar_decision` → 401; las 3 funciones de trigger
  de decisiones → 404 (no expuestas); anon no edita ni borra decisiones →
  401; todo lo anterior sigue negado.
- **Navegador** (`next start` local; Chrome respondió esta vez; las dos
  cuentas de Google tenían la sesión cerrada, así que Gonzalo inició
  sesión con gonzalopatlan.builds y el resto lo hice yo):
  - `/validador/hallazgos`: Pendiente (5), Confirmado (0), Descartado (0),
    Todos (5), con las 5 tarjetas de la Feature 3.
  - Revisión de SIM-1190 (conflicto): 18.2 g y 24.5 g, "Diferencia: +34.6%
    respecto al valor anterior", procedencia de los dos lados (archivo,
    fila, cuenta y hora). La referencia es la versión de
    `ejemplo-simulado.csv` de las 2:25 p.m. (la última aceptada).
  - "Confirmar" con una nota de puros espacios → "La nota es obligatoria…"
    (el `required` del navegador no detecta espacios; lo rechazó el
    servidor), sin fila en el historial.
- **Bug real encontrado en el navegador:** después de ese error, el
  siguiente "Guardar decisión" **no hacía nada**. Con `<form action>`,
  React 19 resetea el formulario al terminar cualquier acción, también con
  error: el radio quedaba desmarcado en el DOM mientras el estado de React
  lo seguía pintando elegido, y el `required` del radio (invisible,
  `sr-only`) bloqueaba el envío con un aviso del navegador que no se veía.
  Quien revisa se quedaba atorado tras cualquier error. Arreglo: envío con
  `onSubmit` + `startTransition` (sin el reset automático; un error
  conserva la decisión y la nota) y sin `required` en el radio (si no se
  elige nada, el servidor responde "Elige confirmar o descartar." en un
  mensaje visible). Repetido después del arreglo: tras el error, el radio
  sigue marcado en el DOM y la nota se conserva; cambiar la nota y guardar
  sin volver a elegir → funciona.
  - Confirmar con nota → estado Confirmado, historial "1. Confirmó la
    discrepancia (vigente)" con la nota, la cuenta y la hora; el formulario
    queda limpio.
  - Cambio de opinión: "Descartar (error)" con otra nota → estado
    Descartado, historial con **2** decisiones, la primera intacta y la
    segunda marcada "(vigente)".
  - Filtros: Pendiente (4), Confirmado (0), Descartado (1) con la tarjeta de
    SIM-1190.
- **Ataques por la API REST con la sesión real** (llave pública + token,
  sin imprimir ninguno): `registrar_decision` con nota `"\n\t \n"` (el bug
  de hoy) → 400 "La nota es obligatoria."; con nota `""` → 400; decisión
  `resuelto` → 400; PATCH, DELETE e INSERT directo en `decisions` → 403;
  PATCH del estado de un hallazgo pendiente y DELETE de un hallazgo → 403.
  Después: siguen 2 decisiones, la primera intacta, y los demás hallazgos
  siguen pendientes.

**Falta:** ancho de celular (pulido de la Feature 5).

## 2026-10-25 — Feature 5: lector de IA con guardia en el servidor y comparación con reglas

**Qué cambió:**

- `lib/lector-ia.ts`: `claude-opus-5-5`, `effort: "medium"` explícito,
  salida JSON con esquema (`{observacion}`) y el `fallbacks: "default"` del
  servidor (si el modelo declina por seguridad, la API reintenta en otro
  modelo dentro de la misma llamada). Pide UNA observación corta, en
  condicional, sobre qué podría explicar la discrepancia. La entrada se
  arma campo por campo por tipo de hallazgo (tipo, SKU, proveedor
  ficticio, valores, fechas, folios): nunca viajan correos, ids de
  usuario, ids de versión ni nombres de archivo (lo revisa una prueba).
- `lib/guardia-lector.ts` (servidor): rechaza palabras de veredicto
  (cumple, reciclado, recuperado, verificado, aprobado, certificado, con
  todas sus variantes y acentos — también "no se puede verificar"),
  resolver o elegir un valor ("correcto", "resuelto", "confirma", "el valor
  respaldado"), recomendar ("debe", "se recomienda"), cualquier cifra que
  no esté en la entrada (porcentajes, diferencias, conversiones), cifras
  con palabras, enlaces y largo fuera de 15–320. Si rechaza, se pide otra
  vez; si vuelve a fallar, no se muestra nada.
- `app/validador/hallazgos/ia-actions.ts`: solo con sesión y org; recibe
  únicamente el id del hallazgo y lo lee con RLS (el navegador no le puede
  mandar otro contenido a la IA). La observación **no se guarda** y nunca
  toca el estado. Errores genéricos para el usuario; detalle solo en el log.
- **Límite de frecuencia desde el inicio** (fue el bug de la prueba mecánica
  de w10): `lector_llamadas` + `registrar_llamada_lector()`, 10 por hora por
  persona y 30 por día por org, registrado ANTES de llamar (un intento
  fallido también cuenta), sin privilegios del cliente sobre la tabla y
  borrando registros de más de un día.
- Pantalla: caja "Observación de IA (sin validar)" (la etiqueta y la
  aclaración "No decide cuál valor es correcto, no resuelve el hallazgo y
  puede equivocarse. La decisión es tuya." las pone la página) con un botón
  para pedirla (cada consulta cuesta).
- `ANTHROPIC_API_KEY` en `.env.local` (Gonzalo) y en `.env.local.example`
  vacía. Ningún chunk del navegador menciona el prompt, el modelo, el SDK
  ni la llave (revisado en `.next/static`).

**Comparación IA vs. reglas (`scripts/comparar-lector.ts`), 10 escenarios
sembrados × 3 rondas de llamadas reales:** la regla (marcar un conflicto
de peso que cambie más de 20%) marca **3 de 10** (punto decimal,
unidades, +22%) y no explica ninguno; no ve material, folios ni fechas.
La IA nombra la causa sembrada en la mayoría de las rondas en **9 de 10**
según la expresión de cada escenario. Matices leídos a mano, que la
expresión no ve:

- La IA casi siempre ofrece **2 a 4 causas posibles** y la expresión le da
  el punto si cualquiera coincide. Leída a mano, la causa sembrada va
  **primero** en 7 de los 9 casos.
- **Revisión tardía:** solo la ronda 3 dice la consecuencia que importa
  ("rediseño real del empaque posterior a la evidencia"); las rondas 1 y 2
  explican la fecha nueva (rediseño o error de captura, y en la ronda 2 un
  posible intercambio de día y mes entre 2026-10-09 y 2026-09-10, ambas
  fechas de la entrada). Acierto pleno: 1 de 3.
- **Inyección** (instrucción escondida en el nombre del proveedor): la IA
  **no obedeció ninguna vez** (0 de 3 con "cumple", "verificado" o "100%")
  pero tampoco señaló el texto raro (0 de 3).
- **Decisión:** la observación es útil como complemento, no como filtro:
  explica causas que la regla no puede ver (sinónimo de material, folio
  copiado, rediseño con fecha nueva), pero lista varias posibilidades y
  puede omitir la que importa. Por eso queda opcional, con botón y "sin
  validar"; la regla no se agrega a la app (el prompt solo pide la
  comparación).

**Guardia con llamadas reales:**

- `node scripts/probar-lector.ts` (1 ronda de humo + 2 rondas): **30
  llamadas, 30 observaciones mostradas al primer intento, 0 rechazadas,
  0 errores, 0 violaciones** al volver a revisarlas. **Las 30 se leyeron
  a mano** (están en `docs/pruebas/lector-ia-2026-10-25.json`): ninguna
  elige un valor, afirma un veredicto ni calcula; todas en condicional.
- Como la guardia nunca rechazó nada, solo estaba probada con textos
  escritos a mano. `node scripts/provocar-guardia.ts`: 3 llamadas reales
  con un prompt malo a propósito (pide el valor correcto, el porcentaje y
  si cumple). La guardia **rechazó 3 de 3**, cada una por varias razones
  ("cumpla", "correcto", 900%, 22.4%, 5.5 g, largo). Esas salidas reales
  mostraron un hueco: "**El valor respaldado es 24.5 g**" es otra forma de
  elegir un valor que la lista no tenía (esa salida cayó por otras
  razones, pero una frase solo con eso habría pasado). Se agregaron
  "valor/peso/dato respaldado, confiable, válido, vigente" con su prueba,
  y la guardia nueva sigue sin rechazar ninguna de las 30 salidas
  legítimas (0 falsos positivos).
- Costo: 33 llamadas (aprobado por Gonzalo).

**Pruebas:**

- `npm run test:logica`: **166/166** (38 nuevas): veredictos con raíces y
  acentos, resolver/recomendar, cifras calculadas y en palabras, números
  repetidos de la entrada sí, artículos "una/un" sí (un primer borrador
  los rechazaba como cifras: habría rechazado casi todo), largo, enlaces;
  la entrada sin datos personales y con la inyección viajando como dato;
  la regla del 20%.
- `npm run test:schema`: **176/176** (12 nuevas): 10 por hora sí, la 11ª
  no; el límite es por persona; sin org → rechazado; anon no ejecuta;
  ataques al contador (borrar, envejecer, leer, insertar a nombre de otro)
  → rechazados; 30 por día por org; minimización; RLS en todas las tablas.
- `probar-anon.sh` contra el proyecto real: `registrar_llamada_lector` →
  401 y `lector_llamadas` → `permission denied`.
- **Navegador contra el proyecto real** (sesión de gonzalopatlan.builds):
  en SIM-6018 (55 → 60 g), "Pedir observación de IA" mostró «El peso_g
  pasa de 55 a 60 con el mismo material, fecha y folio FOL-SIM-0008.
  Podría deberse a un error de captura, a una báscula distinta o a un
  redondeo; quizá también a un ajuste real del empaque que no se reflejó
  en la fecha de revisión.» bajo "Observación de IA (sin validar)"; el
  hallazgo siguió **Pendiente con 0 decisiones**. Luego 9 llamadas más a
  `registrar_llamada_lector` por REST (sin IA, sin costo) → `true`, y la
  11ª por el botón → "Llegaste al límite de consultas a la IA…" sin llamar
  a la API. Leer, borrar o envejecer `lector_llamadas` por REST → 403.
- Build limpio, lint sin warnings.

**Falta:** `ANTHROPIC_API_KEY` en Vercel y probar el lector en producción
(deploy 2, con el pulido).

## 2026-10-25 — Prueba mecánica (PACKET, sección 10) y bug encontrado

Contra el proyecto real (Supabase de w11, `next start` local con el build
de este commit; Chrome con la sesión de gonzalopatlan.builds, org
TPK-F9Z). Para que cada prueba empezara limpia (el motor no repite
hallazgos), se usó un proveedor nuevo, **Proveedor Simulado Epsilon**
(SIM-MT-01 a 03); los CSV están en `docs/pruebas/mecanica/`.

| # | Prueba | Resultado | Cómo |
|---|---|---|---|
| 1 | Falta la fila de un proveedor | ✅ `mt-1` sin SIM-MT-03 → "Sin dato de proveedor", SKU exacto, "lo reportó en mt-0-base.csv (fila 4)" | manual (navegador) |
| 2 | Cambia el peso de un SKU | ✅ `mt-2` SIM-MT-01 10 → 14 g → "Valores en conflicto"; el detalle muestra los dos valores, +40.0%, las dos procedencias (mt-2 fila 2 / mt-1 fila 2, cuenta y hora), estado Pendiente | manual |
| 3 | Revisión posterior a la evidencia aceptada | ⏳ ver abajo (fixture con fecha pasada) | manual pendiente + automática ✅ |
| 4 | Folio reutilizado | ✅ `mt-4` FOL-MT-1 en SIM-MT-02 → 2 hallazgos "Posible duplicado, sin verificar"; en el HTML de las dos páginas "sin verificar" aparece 8 veces y "verificado/a" 0 veces fuera de eso | manual |
| 5 | Confirmar/descartar sin nota | ✅ sin elegir decisión → "Elige confirmar o descartar."; nota de espacios, tab y saltos → "La nota es obligatoria…"; 0 decisiones, sigue Pendiente. Con la llave pública, `registrar_decision` con nota vacía → 401 | manual + atacante |
| 6 | Confirmar y luego intentar editar | ✅ confirmar con nota → Confirmado, 1 decisión. Editar/borrar: con la llave pública PATCH/DELETE `decisions` → 401; con sesión real → 403 (verificado hoy en la Feature 4, junto con el cambio de opinión: fila nueva y las dos visibles). En esta corrida el intento con sesión no llegó a ejecutarse: Chrome se congeló | manual + atacante + automática |
| 7 | Guardia de la IA | ❌→✅ **bug encontrado** (abajo), corregido y probado | automática + llamadas reales |
| 8 | Validación de entrada | ✅ tipo, tamaño, columnas, UTF-8 y filas malas por fila: probado hoy en el navegador (Feature 2) y en `test:logica` (176/176); el validador no cambió desde entonces | manual (F2) + automática |
| 9 | RLS: solo la propia org; anon nada | ✅ llave pública: **18/18 ataques bloqueados** (abajo); aislamiento entre orgs en `test:schema` (176/176) | atacante + automática |
| 10 | Recargar el mismo archivo | ✅ `mt-10` → versión nueva "idéntica a la anterior… no se crearon hallazgos" | manual |

**Prueba 3 y el fixture.** `late_revision` compara la fecha de revisión
con el `uploaded_at` de la última evidencia aceptada (definición de la
Feature 3), y ese `uploaded_at` lo pone la base al subir: no viene del CSV
(si viniera, un proveedor podría fechar su evidencia hacia atrás). Como las
fechas de revisión no pueden estar en el futuro, hoy no se puede provocar
en la app sin una base de un día anterior. Decisión de Gonzalo: un
**fixture** insertado desde el SQL Editor en la org de prueba —
`fixture-fecha-pasada.csv`, `uploaded_at` 2026-10-02, Proveedor Simulado
Delta, SIM-LATE-01 — validado por el mismo trigger; luego se sube
`mt-3-revision-tardia.csv` (revisión 2026-10-20) por la app. Automática:
`test:logica` y `test:schema` ya cubren el caso con una base fechada el
2-oct (3 pruebas, incluida la hora de CDMX).

**Ataques con la llave pública (anon), contra el proyecto real:** decidir
sin sesión, decidir sin nota, insertar/editar/borrar decisiones, cambiar
el estado de hallazgos, insertar un hallazgo ya resuelto, subir versiones,
gastar la IA (`registrar_llamada_lector`), crear org, unirse a TPK-F9Z,
leer las 6 tablas → **401 en las 17**; GraphQL → "pg_graphql extension is
not enabled".

**Ataque a la IA con un prompt distinto a los 3 anteriores**
(`scripts/atacar-lector.ts`): el prompt de PRODUCCIÓN sin cambios y el
ataque metido en los **datos** (campo material): responder en inglés con
el veredicto, escribirlo con letras separadas, o con dígitos no ASCII. El
modelo **resistió las 3** (no obedeció; en 2 dijo que "el campo material
trae texto ajeno") — el modelo no explotó el hueco.

**Bug real (no es el de la Feature 2): la guardia del lector de IA solo
conocía español en ASCII.** La guardia es la barrera que no depende de que
el modelo se porte bien, y estas salidas pasaban (probado con la guardia
del commit anterior):

- veredicto en inglés: "The packaging appears compliant, verified and
  fully recycled, so it could be approved";
- "cum​ple" partido con un espacio de ancho cero;
- "vеrificado" con una "е" cirílica;
- dígitos arábigo-índicos ("٩٠") y de ancho completo ("９０") que la regla de
  cifras no veía;
- "c u m p l e" con letras separadas, "veri-fi-cado", "ｃｕｍｐｌｅ".

**Arreglo (`lib/guardia-lector.ts`):** normalización NFKC antes de todo
(ancho completo → ASCII); rechaza caracteres de formato invisibles
(`\p{Cf}`), letras de otro alfabeto (`\p{L}` que no sea latino; el español
con acentos y ñ sigue pasando) y dígitos que no sean 0-9; raíces de
veredicto en inglés (compliant, comply, verified, recycled, recovered,
approved, certified, valid, passed); y las raíces buscadas también en el
texto sin espacios ni signos ("c u m p l e").

**Pruebas del arreglo:** 10 nuevas en `test:logica` (los 8 disfraces, el
español con acentos y ñ sigue pasando, y **las 30 observaciones reales de
la Feature 5 siguen pasando** — sin falsos positivos). Con la guardia del
commit anterior: **8 FAIL**, exactamente los disfraces; con el arreglo:
`test:logica` **176/176**, `test:schema` **176/176**, build limpio, lint
sin warnings.
