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

## 2026-10-18 — Push de la Feature 1 y entorno local

`.env.local` tenía tres problemas de forma: un espacio después del `=` en
la URL y en la llave, y después la URL quedó como `https:////…` (al
quitar el espacio se borró `https:` y quedaron las `//`; mi chequeo de
"sin esquema" no lo distinguió y antepuse `https://` encima). Se
corrigió con `sed` sin imprimir valores; ahora la URL tiene la forma
exacta `https://<ref>.supabase.co` y el host responde. **Error mío:** en
el diagnóstico de la URL, la máscara asumía que el host empezaba con
letra y se imprimió el *ref* del proyecto (no es secreto: va en la URL
pública que ve cualquier navegador, pero no debía mostrarse). Desde ahí
solo se imprimen resultados fijos (OK/FALLA, códigos HTTP).

`scripts/probar-anon.sh` contra el proyecto real: los 4 RPCs → 401
`permission denied`, las 4 tablas privadas → `permission denied`,
`published_ledger` → `[] 200`. Push de la Feature 1: `8e2c65e`.

## 2026-10-18 — /financiamiento muestra el último snapshot publicado

**Decisión (Gonzalo):** sin variable de entorno para elegir la
organización. `/financiamiento` muestra el **último snapshot publicado
de `published_ledger`** (el más reciente por fecha de publicación, de
cualquier organización).

Consecuencia a tener presente para la Feature 4: cualquier persona que
inicie sesión con Google puede crear una organización y publicar, y su
snapshot pasaría a ser el que ve el estudiante. En este piloto hay una
sola organización real, así que no se agrega nada; si se quisiera
cerrar, la opción sería limitar quién puede publicar (no implementado,
fuera del alcance).

## 2026-10-18 — Feature 2: registro de supuestos con estado y fuente

**Qué cambió:**

- `lib/supuestos.ts`: catálogo de las 8 claves (las 7 del mockup + la
  pérdida evitada por suscriptor al año, insumo del 10:1) con etiqueta,
  unidad, rango y si es entero; validación server-side del formulario.
- `/modelo/supuestos`: tabla con estado y fuente, "Agregar supuesto" (solo
  claves que aún no existen), "Cargar valores de ejemplo" cuando falta
  alguno de los 7. `/modelo/supuestos/[id]`: editar valor, estado, URL,
  fecha y nota; eliminar en dos pasos dentro de la página (sin
  `confirm()`). `/modelo` muestra la tabla del mockup (Supuesto · Valor ·
  Estado).
- Errores bajo cada campo y lo escrito se conserva (mismo patrón
  `useActionState` + `key` del formulario que w09). Al editar, la clave
  sale de la base, no del campo oculto.

**Reglas de validación (servidor):**

- Número: coma decimal aceptada (`2,5`); se rechazan `1e3`, `NaN`,
  `Infinity`, `0x10`, `1,234.5`, `1 000` y más de 4 decimales.
  **`2,000` y `1.500` se rechazan como ambiguos** ("escríbelo sin
  separador de miles, por ejemplo 2000") en vez de adivinar: en México
  `2,000` es dos mil, y con coma decimal se guardaría 2. `0,035` sí pasa
  (un 0 inicial no puede ser separador de miles).
- Rango por clave (conversión 0–100 %, horas 0–744 al mes, estudiantes
  entero, etc.). Fecha `AAAA-MM-DD` real, no futura (un día de margen
  por zona horaria), desde 1990. URL `http(s)://`, máx. 500. Nota máx.
  500.
- **"Sustentado" exige URL y fecha; "débil" e "inventado" pueden ir sin
  fuente.**

**Base de datos (defensa para cualquier camino):** constraint
`assumptions_sustained_needs_source`, clave+unidad del catálogo, rango
0–10,000,000, URL `http(s)`, privilegios por columna (no se puede
cambiar la clave ni la org de un supuesto, ni escribir `created_at`),
`updated_at` por trigger. `create_org()` siembra los 7 supuestos del
mockup, todos `invented` y sin fuente. La pérdida evitada **no** se
siembra: sin ella el 10:1 es "no calculable".

**Bug real encontrado por `test:schema`:** la primera versión tenía
`check (value_num >= 0)` y **dejaba pasar `NaN`**: en Postgres, `NaN`
es mayor que cualquier número, así que `NaN >= 0` es verdadero. Se
cambió a un rango cerrado (`>= 0 and <= 10000000`), que rechaza `NaN` e
`Infinity`. Prueba agregada para ambos.

**Pruebas:**

- `npm run test:logica`: **70/70** (15 de la Feature 1 + 55 de
  validación: números, fechas, URLs, la regla sustentado→fuente, rangos,
  errores múltiples en su campo).
- `npm run test:schema`: **82/82**. Incluye: siembra exacta de los 7
  (comparada contra `lib/supuestos.ts`), sustentado sin fuente rechazado
  en insert y update, con URL sin fecha y viceversa, **y también como
  superusuario** (es decir, desde el SQL Editor o con la service role);
  catálogo TS = constraint de la base clave por clave; aislamiento entre
  orgs; anon sin EXECUTE en ninguna función. **Nuevo: volver a correr el
  schema dos veces con datos** → sin errores y la misma foto antes y
  después (conteo de las 5 tablas, policies, suma de valores, clave +
  estado + fuente de cada supuesto, y un valor editado que no se
  re-siembra).
- Lint sin warnings y build limpio.

**Prueba manual en el navegador (local, contra Supabase real, después de
que Gonzalo corrió el SQL de la Feature 2):**

- Crear organización "Libro Abierto (simulado)" → `/modelo` muestra los 7
  supuestos sembrados, todos `inventado`, igual que el mockup. ✅
- Editar "Estudiantes al año" con `2,000` + "sustentado" sin fuente + una
  nota → tres errores, cada uno bajo su campo (separador de miles, falta
  URL, falta fecha); se conservan `2,000`, "sustentado" y la nota. ✅
- `1e3` + "débil" → error solo en el valor ("débil" no exige fuente). ✅
- `2000` + "débil" → se guarda y la tabla muestra 2,000 · débil. ✅
- Eliminar (dos pasos, sin `confirm()`) → aparece "Cargar 1 valor de
  ejemplo (inventados)" → lo restaura con su valor y nota originales. ✅
- No probado en el navegador: "sustentado" **con** fuente y el formulario
  de "Agregar" (los cubren `test:logica` y `test:schema`).
- `scripts/probar-anon.sh` con las funciones nuevas: `sembrar_supuestos`
  y `sembrar_supuestos_ejemplo` → 401 `permission denied` (confirma que
  el SQL se aplicó); `tocar_updated_at` → 404 (PostgREST no expone
  funciones de trigger).

**Dos problemas del login local, ninguno del código:**

1. `Unable to exchange external code`: el Client Secret guardado en
   Supabase no era el del cliente OAuth (el cliente vive en el proyecto
   "w10" de la otra cuenta de Google). Gonzalo generó un secret nuevo y
   lo pegó; desde ahí el callback pasa.
2. Después del login, Chrome mostraba una página de error y el log de
   Next no registraba nada: **las cookies de `localhost` sumaban 18,276
   bytes** (sesiones de Supabase de tres proyectos de semanas anteriores
   más la de w10) y Node rechaza headers de más de 16 KB con 431 antes
   de que Next vea la petición (reproducido con curl: 17 KB → 431,
   1 KB → 200). Solo pasa en local; en Vercel cada proyecto tiene su
   dominio. Arreglo temporal: `NODE_OPTIONS=--max-http-header-size=65536
   npm run dev`. Arreglo permanente: borrar las cookies viejas de
   `localhost` (no se cambió código).

**Siguiente paso:** Feature 3 (modelo determinista y prueba de
independencia), cuando Gonzalo confirme.

## 2026-10-18 — Feature 3: modelo determinista y prueba de independencia

**Qué cambió:** `lib/modelo.ts`, funciones puras (sin red, base, IA,
fecha ni azar). `calcularModelo(supuestos, { sponsor })` devuelve cada
cifra como `{ calculable, valor, estado, insumos }` o
`{ calculable: false, motivo, faltan }`. `/modelo` muestra el bloque de
resultado del mockup y la prueba de independencia **calculada en vivo**
con los supuestos actuales (no un texto fijo). Sin cambios de esquema.

**Fórmulas y unidades** (ver también "sin /12" y "Chequeo 10:1"):

| Cifra | Fórmula | Unidad |
|---|---|---|
| Mantenimiento | horas al mes × costo por hora | MXN / mes |
| Costo total | mantenimiento + correcciones + infraestructura | MXN / mes |
| Suscriptores | estudiantes al año × conversión % / 100 | suscriptores |
| Ingreso | estudiantes al año × conversión % / 100 × precio mensual | MXN / mes |
| Faltante | costo − ingreso (negativo = "Sobran") | MXN / mes |
| Costo por estudiante | costo mensual × 12 ÷ estudiantes al año | MXN / año |
| Pago anual del suscriptor | precio mensual × 12 | MXN / año |
| Umbral 10:1 | 10 × pago anual | MXN / año |
| Razón 10:1 | pérdida evitada por suscriptor al año ÷ pago anual | veces |

**Reglas:**

- **Estado derivado = el del insumo más débil** (invented < weak <
  sustained), acumulado a través de cifras intermedias.
- **Falta un insumo → "no calculable" con el motivo**, nunca un valor por
  defecto. Un valor no finito (NaN) cuenta como faltante, no como 0.
- **Ceros:** estudiantes al año = 0 o precio = 0 → "no calculable" (son
  base de población o divisor). Horas, costos o conversión en 0 **sí** son
  datos válidos (conversión 0% = ingreso 0: nadie se suscribe).
- **`sponsor` se recibe y se ignora** (`void opciones`); ninguna línea lo
  lee.
- Redondeo a centavos para mostrar; operaciones ordenadas para que
  2,000 × 3% dé 60 exacto y no 60.000000000000004.

**Dos bugs reales que encontró `test:logica` (antes del commit):**

1. **El 10:1 se daba por cumplido sin cumplirse.** `cumple` comparaba la
   razón ya redondeada a centavos: con pérdida 5,879 y umbral 5,880, la
   razón 9.998 se redondeaba a 10.00 → "se cumple". Ahora `cumple` se
   decide con los insumos sin redondear.
2. **Punto flotante en el borde exacto.** Con precio 40.06,
   `10 × (40.06 × 12)` = 4807.200000000001, así que una pérdida de
   exactamente 4,807.2 no "cumplía". Ahora se compara en enteros
   (×10⁴, la precisión de la base). *(Mi primer ejemplo para esta prueba,
   precio 49.9, era incorrecto: en JS sí da 5988 exacto. Se buscó un caso
   real con un script antes de escribir la prueba.)*

**Pruebas (`npm run test:logica`: 110/110, 40 nuevas de la Feature 3):**

- Valores sembrados: costo 7,500 / ingreso 2,940 / faltante 4,560 (la
  prueba que estaba escrita fuera del repo desde la decisión "sin /12"),
  líneas 6,000 / 1,000 / 500, 60 suscriptores, MXN 45 por estudiante,
  10:1 no calculable con "falta el valor evitado" y umbral 5,880.
- **Independencia:** sponsor `undefined`, `null`, "A", "B", un objeto, 0 y
  "" → deep equal; con los sembrados, con faltantes, con lista vacía y en
  **300 casos al azar** (semilla fija, con faltantes y ceros).
- **Herencia de estado en esos 300 casos:** cada cifra calculable tiene
  exactamente el estado del más débil de sus insumos. Casos dirigidos: un
  solo insumo inventado vuelve inventado el ingreso pero no el costo.
- Vacíos y ceros: sin supuestos todo es no calculable; 0 estudiantes,
  precio 0, NaN, sin horas → no calculable con motivo.
- Pureza: no muta la entrada (objetos congelados), determinista, el orden
  de los supuestos no importa.

**Pruebas de mutación (confirman que las pruebas sí detectan fallas):**
un modelo que sube el ingreso 0.1% con el sponsor B → 3 FAIL de
independencia; la comparación ingenua del 10:1 → 1 FAIL. Código
restaurado → 110/110.

**Prueba manual en el navegador (local, Supabase real):** `/modelo`
muestra Costo total MXN 7,500 / mes, Ingreso MXN 2,940 / mes, **Faltan
MXN 4,560 / mes** (rojo), costo por estudiante MXN 45 al año, "Chequeo
10:1: no calculable (falta el valor evitado)" + "cada suscriptor tendría
que evitar MXN 5,880 al año", la etiqueta `inventado` junto a cada cifra
derivada y "[OK] Sin patrocinador / A / B: resultados idénticos".

**Lo que NO está probado:** la vista en ancho de teléfono (se revisa en
la Feature 5, "polish"); un caso con insumos sustentados en el navegador
(lo cubren las pruebas).

**Siguiente paso:** Feature 4 (evidencia del pagador, compuerta de
viabilidad, publicar y libro público). Cambia el esquema: no hay push
hasta que Gonzalo corra el SQL.
