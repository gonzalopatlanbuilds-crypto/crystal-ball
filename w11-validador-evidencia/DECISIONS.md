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
- **Recarga idéntica (decisión que el prompt pide documentar):** si las
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
