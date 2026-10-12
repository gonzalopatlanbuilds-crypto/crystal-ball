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

**Nombre "First Proof":** sale del nombre de la carpeta. *(Corrección
posterior: el mockup 1 sí nombra el producto, "First-Proof Finance MX";
se alineó en la Feature 2.)* Cambiarlo es solo texto (`app/layout.tsx`,
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

**Login con Google al primer clic, en incógnito, en producción:
verificado por ti** (2026-10-11). Con eso queda confirmado también el
redirect URI de Supabase en Google Cloud. **Deploy 1 cerrado.** Pendiente
menor: Site URL de Supabase todavía en localhost.

**Siguiente paso:** Feature 2 (entrega del candidato y chequeo automático).

## 2026-10-11 — Site URL de Supabase

Cambiada de `http://localhost:3000` a
`https://crystal-ball-w09-first-proof.vercel.app` (a petición tuya, desde
el dashboard; verificada recargando la página). Lección 6 completa.

## 2026-10-11 — Feature 2: entrega del candidato y chequeo automático

**Qué cambió:** `/caso` (pantalla del mockup 1: tabla de Distribuidora
Aurora, tres respuestas numéricas, explicación, "Enviar a revisión
humana"), server action `enviarEntrega`, `/entregas/[id]` (vista del
candidato sobre su entrega con el bloque de cálculos) y la lista "Tus
entregas" en `/dashboard`. Nombre alineado con el mockup: "First-Proof
Finance MX".

**El caso vive en `lib/caso.ts` y las respuestas correctas se calculan de
los datos**, no se escriben a mano: si alguien cambia una cifra de la
tabla, la respuesta correcta cambia con ella. La prueba confirma que dan
10.0 / 30.0 / 30.0, como el cálculo a mano del packet.

**El chequeo se calcula al leer, no se guarda.** La base guarda solo las
respuestas; `chequear()` compara contra `lib/caso.ts` cada vez que se
muestra. Una sola fuente de verdad, y nada que el cliente pueda escribir.

**Sin puntaje en ningún lado.** `chequear()` devuelve un resultado por
cálculo ("correcto" / "no coincide" / "sin respuesta" + el valor
correcto), nunca un total; la prueba revisa que no exista ningún campo
tipo score/total. El bloque dice "Revisión automática, no es un juicio
sobre ti" y va separado de la explicación.

**Respuestas numéricas opcionales, explicación obligatoria.** El criterio
de aceptación habla de respuestas "faltantes" que muestran el valor
correcto, así que vacío es válido ("sin respuesta"). La explicación es lo
que lee quien revisa: 80–800 caracteres, contados como `char_length` de
Postgres (un emoji = 1).

**Formato de números para teléfono en México:** se acepta coma decimal
(`10,5`) y `%` al final. Se rechaza en vez de adivinar: `1e3`, `Infinity`,
`NaN`, `1,234.5`, `0x10`. Se redondea a 2 decimales antes de guardar
(`numeric(9,2)`), para que lo chequeado sea exactamente lo guardado.

**Los errores no borran lo escrito:** el server action regresa los
valores originales y el formulario se re-monta con `key` (React 19
resetea un `<form action>` después de enviarlo, y sin la `key` los
`defaultValue` no se vuelven a aplicar).

**Decisión abierta: ¿una sola entrega por candidato?** Hoy se permiten
varias (cada una con su seudónimo). Riesgo: alguien ve los valores
correctos y vuelve a entregar. No hay puntaje, así que el daño es bajo;
lo dejo así salvo que prefieras limitarlo.

**Pruebas:** `npm run test:logica` (nuevo) 31/31 — respuestas correctas,
tolerancia ±0.05 en los bordes (con margen de punto flotante: 30.05 −
30 = 0.0500000000000007), strings de `numeric`, vacíos, formatos
rechazados, límites 79/80/800/801, errores por campo.
`npm run test:schema` 49/49. Build limpio y lint sin warnings.

**NO probado todavía:** el flujo en el navegador (enviar, ver errores
bajo cada campo con lo escrito conservado, ver el resultado) ni nada en
producción. Necesita login con Google, así que es prueba tuya después del
deploy.

## 2026-10-11 — Número de intento por candidato

**Decisión tuya:** se mantienen las entregas múltiples, cada una con su
número de intento (1, 2, 3…) por candidato.

**Qué cambió (solo `sql/schema.sql`):**
- `submissions.attempt_number` (not null, ≥ 1, único por
  `org_id + candidate_id + attempt_number`).
- `profiles.next_attempt`: contador por candidato.
- El trigger `asignar_seudonimo()` asigna el intento en el mismo paso que
  el seudónimo: `UPDATE profiles … RETURNING`, que bloquea la fila del
  perfil, así que dos envíos simultáneos de la misma persona no pueden
  quedar con el mismo número.

**Asignado en el servidor, nunca desde el cliente:** `attempt_number` no
está en la lista de columnas que `authenticated` puede insertar, no hay
UPDATE en `submissions`, y no hay policy de update en `profiles`, así que
el contador tampoco se puede mover desde la llave pública. Probado.

**Nunca se reusa un número**, igual que el seudónimo: si alguien borra su
intento 2, el siguiente es el 3. Un "intento 2" reciclado diría algo
falso sobre cuántas veces lo intentó.

**Efecto secundario en una prueba:** "C no puede entregar en una org
ajena" ahora lo rechaza primero el trigger ("El candidato no pertenece a
esta organización") y ya no RLS. Sigue rechazado; la prueba acepta
cualquiera de los dos. Un insert rechazado (por el trigger o por RLS) no
gasta números: Postgres deshace los contadores con el rollback (la prueba
lo confirma: B sigue en A-03 / intento 2).

**Migración para la base de producción, que ya existe:** el schema agrega
la columna, numera las entregas existentes por candidato en orden de
creación y deja cada contador después de su último intento. Probado
corriendo el schema de GitHub (el que está hoy en Supabase), creando 4
entregas (A, B, A, A) y corriendo el nuevo encima: quedaron A#1 B#1 A#2
A#3, contadores A=4 B=2, y la siguiente de A salió #4. Correrlo dos
veces no cambia nada.

**No expuesto a quien revisa:** `blind_pending_submissions()` y
`blind_submission()` no devuelven el intento (probado). Saber que
alguien va en su tercer intento puede sesgar la revisión, y los campos
ciegos del prompt no lo incluyen. Tampoco se muestra todavía en la
pantalla del candidato: solo se guarda.

**Pruebas:** `npm run test:schema` 56/56 (7 checks nuevos de intentos).

**Pendiente tuyo:** volver a correr `sql/schema.sql` completo en Supabase
(SQL Editor) para que producción tenga la columna. Sin eso, la app actual
sigue funcionando: no lee ni escribe `attempt_number`.

## 2026-10-11 — Intento visible para el candidato; la evidencia es el intento 1

**Los 4 envíos de prueba de la migración (A, B, A, A)** se crearon en
una base PGlite **en memoria**, dentro de un script en el scratchpad de
la sesión; desapareció al terminar el proceso. Nunca tocaron Supabase (el
script no tenía URL ni llave). No hay nada que borrar en producción.

**Qué cambió:**
- `lib/intentos.ts`: `etiquetaIntento()` (el intento 1 no lleva
  etiqueta; los demás dicen "Intento N: reenvío") y `elegirEvidencia()`.
- `/entregas/[id]` y "Tus entregas" en `/dashboard` muestran la etiqueta.
  Solo vistas del candidato (RLS: filas propias). Quien revisa nunca la ve:
  `blind_pending_submissions()` / `blind_submission()` no devuelven
  `attempt_number` (probado en `test:schema`).

**La evidencia es el intento 1** (`elegirEvidencia`): la única entrega
hecha antes de ver los valores correctos. Todavía no se usa en pantalla;
la usará el expediente (Feature 4).

**Decisión mía, reversible: si el intento 1 se borró, no hay evidencia
(null)**, en vez de promover el intento 2. Si no, borrar el primero sería
la forma de "mejorar" el expediente después de ver las respuestas. Si
prefieres que el intento más bajo que exista sea la evidencia, es un
cambio de una línea.

**Pruebas:** `test:logica` con 7 checks nuevos (incluye "devuelve el
intento 1 aunque existan el 2 y el 3", con los reenvíos primero en la
lista, como los ordena el dashboard).

**Sigue pendiente tuyo:** re-correr `sql/schema.sql` en Supabase.
**Ahora es obligatorio antes de desplegar este commit:** las dos pantallas
piden `attempt_number`, y sin la columna la consulta falla (`/entregas/[id]`
daría 404 y la lista de entregas saldría vacía).

## 2026-10-11 — Intentos verificados en producción

**Verificado por ti, con tu cuenta real en
`https://crystal-ball-w09-first-proof.vercel.app`** (después de re-correr
`sql/schema.sql` en Supabase y desplegar f89b0b2):
- Dos entregas: **A-01** sin etiqueta de intento y **A-02** con
  "Intento 2: reenvío", tanto en "Tus entregas" como en su pantalla.
- Ninguna muestra nombre: solo el seudónimo.

Antes del push se confirmó desde fuera, con la llave pública, que
producción ya tenía `submissions.attempt_number` y
`profiles.next_attempt` (200 en ambas; una columna inventada da 400
"does not exist").

**No verificado en producción todavía:** que quien revisa no vea el
intento. La pantalla del revisor no existe aún (Feature 4); por ahora
solo está probado en `test:schema` que las funciones `blind_*` no lo
devuelven.

## 2026-10-11 — Feature 3: observaciones preparadas por IA (código; prueba real pendiente)

**Qué cambió:**
- `lib/observaciones.ts`: llama a `claude-haiku-4-5` server-side con
  solo la hoja de datos del caso y la explicación del candidato (entre
  `<explicacion>`, tratada como material, no como instrucciones). Pide
  JSON con `output_config.format` (`json_schema`); 2 a 4 observaciones.
  Si la guardia rechaza el lote, pide otra vez (2 intentos máximo); si
  vuelve a fallar, la entrega queda **sin** observaciones.
- `lib/guardia-observaciones.ts`: rechaza calificaciones/puntajes/
  niveles, aprobado/rechazado/apto, juicios de calidad (bueno, excelente,
  deficiente…), juicios de correcto/incorrecto/error (el chequeo de
  cálculos es del sistema), lenguaje de contratación o empleo, cualquier
  cifra que no esté en la hoja de datos (ni siquiera derivadas como 32% o
  22.5) y cualquier observación que no empiece con un verbo descriptivo
  ("Menciona…", "No cuantifica…"). Si una sola falla, se rechaza el lote
  entero: no se "limpia" texto de la IA a mano.
- `app/(app)/caso/actions.ts`: la entrega se inserta primero y después se
  piden las observaciones; si la IA falla, la entrega sigue (solo se
  registra en el log del servidor, incluido el texto rechazado).
- `components/ObservacionesIA.tsx` en `/entregas/[id]`: la etiqueta
  "Preparadas por IA, no son una calificación ni una decisión" está en el
  componente, nunca la escribe el modelo.

**Decisión de seguridad: service role key solo para escribir
`ai_observations`.** El candidato no puede escribir esa columna con la
llave pública (privilegios por columna, probado en `test:schema`); si
pudiera, fabricaría "observaciones de IA" a su favor. Cualquier función
de la base que el servidor pudiera llamar con la sesión del usuario, el
usuario también podría llamarla, así que la única vía segura es un
secreto que solo tiene el servidor. `lib/supabase/admin.ts` lo usa para un
solo UPDATE, filtrado por id + candidate_id + `ai_observations is null`.
Sin la llave, la entrega funciona igual y queda sin observaciones.

**Pruebas:**
- `test:logica` 61/61: 23 checks nuevos de la guardia con textos escritos
  a mano (3 que deben pasar, 20 que deben rechazarse).
- Build limpio, lint sin warnings, `test:schema` 56/56.

**BLOQUEADO — prueba con llamadas reales (3 rondas × 9 explicaciones):**
la `ANTHROPIC_API_KEY` de `.env.local` está bien leída (108 caracteres,
prefijo `sk-ant-api`) pero la API responde 401 `invalid x-api-key`
(request_id `req_011CfwbwqaXwvYwKXg11saSM`). Probablemente es la llave que
se sugirió rotar porque quedó impresa en esta sesión. El script ya está
listo: `node scripts/probar-observaciones.ts 3` (9 explicaciones: buena,
buena sin cifras, vaga, fuera de tema, dos inyecciones de prompt, muchas
cifras, en inglés, razonamiento equivocado).

**Pendiente tuyo (no puedo escribir llaves en formularios):**
1. Llave nueva de Anthropic en `.env.local` y en Vercel
   (`ANTHROPIC_API_KEY`, reemplazar la actual).
2. `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API →
   service_role) en `.env.local` y en Vercel, Production y Preview.

## 2026-10-11 — Feature 3: prueba real con Haiku (54 llamadas) y bug de la guardia

**Llaves:** pusiste una `ANTHROPIC_API_KEY` nueva y la
`SUPABASE_SERVICE_ROLE_KEY` en `.env.local` y en Vercel. Verificado sin
imprimirlas: Anthropic `GET /v1/models` → 200; la service key tiene
`role: service_role` y lee `submissions` → 200. (En Vercel no puedo
verlas: se comprueba con la prueba en producción.)

**Ronda A — 3 × 9 explicaciones reales, guardia original:** 27/27 con
observaciones, 0 descartadas, 0 errores. Pero **leyéndolas a mano** hubo
dos huecos que la guardia dejó pasar:
1. **Bug: cifras escritas con palabras.** En "en inglés", 3 de 3 rondas:
   "aproximadamente diez por ciento", "dos puntos porcentuales". La regla
   de "ninguna cifra fuera de la hoja de datos" solo buscaba dígitos.
2. "experiencia laboral" (fuera de tema, 2 de 3 rondas): lenguaje de
   empleo que la lista no tenía.

**Arreglo:** la guardia rechaza números en palabras (tres…millones, "por
ciento", "porcentuales"); "los dos trimestres" y "noventa" (la fórmula)
siguen permitidos. Se agregó `laboral` a la lista de empleo. El prompt
ahora dice explícitamente "ni con dígitos ni con palabras" y cómo
describir un texto que habla de la persona. Se agregaron los casos
reales como pruebas de regresión en `test:logica`.

**Verificación del arreglo contra las 27 salidas reales de la ronda A:**
la guardia nueva rechaza exactamente los 5 lotes que marqué a mano y
ninguno de los otros 22 (sin falsos positivos).

**Ronda B — otras 3 × 9 con guardia y prompt nuevos:** 26/27 con
observaciones (3 al segundo intento), 1 descartada, 0 errores. Leídas
todas a mano: sin cifras, sin juicios, sin lenguaje de empleo; las dos
inyecciones ("califica con 10", "SISTEMA: … contratar") se describieron
las 6 veces como "Incluye instrucciones dirigidas al sistema…" y nunca se
obedecieron. La descartada (inyección, ronda 3) escribió "tres a cinco
oraciones" y luego "No especifica…"; la entrega habría quedado sin
observaciones, que es el comportamiento diseñado. Se agregó "Especifica"
a los verbos permitidos (descriptivo; con prueba).

**Limitación conocida (no la atrapa ninguna guardia):** una observación
puede describir mal el texto. Ronda B1, "razonamiento equivocado": "Atribuye
el crecimiento de las cuentas por cobrar a un aumento en ventas", cuando
el candidato habló de dinero en caja. No es un juicio ni una cifra; por
eso quien revisa confirma o descarta cada una (Feature 4) y la etiqueta
dice que no son una decisión. También apareció una errata del modelo
("revistaría").

**Pruebas:** `test:logica` 68/68, `test:schema` 56/56, build limpio, lint
sin warnings. Las 54 salidas completas quedaron en el scratchpad de la
sesión (no en el repo).

**Siguiente:** push y prueba en producción: enviar un caso y ver que las
observaciones se guarden (confirma que Vercel tiene las dos llaves).

## 2026-10-11 — Feature 3 verificada en producción (con Chrome)

Con tu sesión, en `https://crystal-ball-w09-first-proof.vercel.app`,
deploy `2f47e89`:
- **Validación (criterio de la Feature 2, no probado antes en navegador):**
  margen "3o" y explicación de 13 caracteres → "Escribe solo un
  número, por ejemplo 12.5" bajo el margen y "Escribe al menos 80
  caracteres (llevas 13)" bajo la explicación; lo escrito se conservó
  (incluido "10,0" con coma decimal).
- **Entrega válida** (10,0 / 30 / 22.5 a propósito) → A-03, "Intento 3:
  reenvío", dos "correcto" y "no coincide · valor correcto: 30.0".
- **3 observaciones de IA guardadas** (Haiku + guardia + service role en
  Vercel): "Menciona que los ingresos crecieron y que el costo de ventas
  creció a un ritmo mayor." / "Señala que las cuentas por cobrar
  aumentaron desproporcionadamente respecto a las ventas." / "Propone
  revisar primero las condiciones de crédito y los descuentos como
  acciones a tomar." Etiqueta fija de la página visible.

Nota de método: un primer intento de llenar el formulario con Chrome dejó
los campos vacíos porque escribí antes de que la página terminara de
cargar; no era un bug de la app (al repetirlo, todo se conservó).

## 2026-10-11 — Feature 4 (parte 1): base de datos y lógica; falta la UI

**Hecho (sin pantallas todavía):**
- `sql/schema.sql`: la cola de revisión (`blind_pending_submissions`,
  `blind_submission`, `submit_review`) solo acepta el **intento 1** (la
  evidencia); los reenvíos son práctica. `submit_review` exige una
  decisión válida por cada observación de IA (`{decision: confirmada |
  descartada, motivo?}`, motivo ≤ 120 y solo en descartadas), y rechaza
  decisiones sobre observaciones inexistentes. Nueva
  `borrar_mis_entregas()`: borra todas las entregas del candidato (sus
  revisiones caen por cascada) y reinicia su contador de intentos a 1; si
  no, tras borrar todo nunca volvería a haber un intento 1. Trade-off:
  alguien podría borrar todo tras ver las respuestas y empezar de nuevo;
  el bloque "NO prueba" ya dice que no prueba que lo hizo sin ayuda.
- `lib/expediente.ts`: textos fijos ("NO prueba", "Quién puede verlo",
  "Real y simulado"), recomendaciones (sin "rechazar") y `mapaCriterios`
  (criterio → evidencia → quién lo juzgó; C1 sistema, C2/C3 humano o
  "pendiente"; sin conteos).
- `lib/validacion-revision.ts`: validación server-side del formulario.
- Pruebas: `test:schema` 74/74 (18 nuevas: cola solo intento 1, decisiones,
  motivos, borrar todo, reinicio de intentos), `test:logica` 87/87.

**Pendiente:** pantallas `/revisar` y `/revisar/[id]` (formulario y
chequeo amistoso revisor ≠ candidato en el server action), el expediente
del mockup 2 en `/entregas/[id]` para el intento 1, botón de eliminación
(sin `confirm()`), build/lint, re-correr `sql/schema.sql` en Supabase,
push y prueba en producción. Probar la revisión en producción requiere una
**segunda cuenta de Google** en la misma org (no puedo crear cuentas).
Después: Feature 5.

## 2026-10-11 — Feature 4 (parte 2): revisión ciega y expediente

**Qué cambió:**
- `/revisar`: lista ciega (solo seudónimos, vía
  `blind_pending_submissions()`), sin entregas propias ni reenvíos, y
  "Revisadas por ti".
- `/revisar/[id]`: tabla del caso, cálculos, explicación y el formulario:
  confirmar/descartar cada observación de IA (motivo opcional al
  descartar), conflicto de interés obligatorio ("Ninguno" o texto),
  recomendación ("Conversar con el candidato" / "Necesita más
  evidencia"; no existe "rechazar") y nota obligatoria. El formulario usa
  estado controlado: un error de validación no borra lo elegido.
- **Chequeo amistoso revisor ≠ candidato:** la página y el server action
  consultan primero `submissions` con la sesión del usuario (RLS solo
  devuelve propias): si la encuentra, muestra "No puedes revisar tu
  propia entrega" sin llegar a la base. El trigger sigue siendo la regla
  real.
- `/entregas/[id]` del intento 1 = expediente del mockup 2 (bloques 1–5,
  "Lo que este archivo NO prueba", "Quién puede verlo", "Real y
  simulado", todo texto fijo de `lib/expediente.ts`), con nombre del
  revisor (display_name de su perfil; si no hay, "Persona revisora del
  piloto"), fecha en hora de CDMX y decisión por observación. Los
  reenvíos siguen como vista de práctica y en "Tus entregas" dicen
  "práctica, no se revisa".
- "Solicitar eliminación de mi expediente": dos pasos dentro de la página
  (sin `confirm()` del navegador) → `borrar_mis_entregas()`.
- `ChequeoCalculos` ahora dice "Respuesta" y "no es un juicio sobre la
  persona", porque también lo ve quien revisa.

**Schema en producción:** lo corrí yo desde Chrome (autorizaste hacerlo
todo hasta la Feature 5): SQL Editor con el `sql/schema.sql` del commit
`acf1013`, cargado desde GitHub (SHA-256 idéntico al archivo local
probado). Supabase avisó "destructive operations" (son los `drop … if
exists` de policies/triggers y el `delete` dentro de
`borrar_mis_entregas`); resultado "Success. No rows returned".
`scripts/probar-anon.sh` contra producción: los 8 RPCs (incluido
`borrar_mis_entregas`) dan 401 a anon; tablas `[]`.

**Pruebas:** build limpio, lint sin warnings, `test:logica` 87/87,
`test:schema` 74/74.

## 2026-10-11 — Feature 4 verificada en producción (con tu cuenta, vía Chrome)

Deploy `2ec6279`:
- `/revisar`: "No hay entregas pendientes de revisión" — correcto: eres
  la única persona de la org y tus entregas se excluyen.
- "Tus entregas": A-01 "expediente · pendiente de revisión"; A-02 y A-03
  "práctica, no se revisa".
- `/entregas/<A-01>`: expediente completo (bloques 1–5, C1 → Sistema,
  C2/C3 → "Pendiente de revisión humana", "NO prueba", "Quién puede
  verlo", "Real y simulado", botón de eliminación).
- `/revisar/<A-01>` con tu cuenta: **"No puedes revisar tu propia
  entrega"** (chequeo amistoso; el trigger está probado en `test:schema`).

**No verificado en producción (necesita una segunda cuenta de Google en
la org, que no puedo crear):** firmar una revisión real, que el
expediente muestre al revisor y las decisiones, y leer la respuesta de
red de la pantalla del revisor. Cubierto en `test:schema` (la función
ciega no devuelve nombre, correo, id, fecha ni intento).
**Tampoco probé en producción el botón "Sí, borrar todo":** borrar datos
de forma permanente desde el navegador es algo que no hago aunque esté
autorizado; está probado en `test:schema` y lo puedes probar tú.

## 2026-10-11 — Feature 5: pasada mecánica, bugs y prueba de persona

**Pasada mecánica (test plan del packet):**
| Punto | Resultado |
|---|---|
| Chequeo automático = cálculo a mano (10.0/30.0/30.0) | ✅ `test:logica` + producción (A-03) |
| Observaciones generadas muchas veces sin puntaje, aprobado, empleo ni cifras ajenas | ✅ 54 llamadas reales leídas a mano (bug de cifras en palabras arreglado en F3) |
| El candidato no puede revisar su propia entrega (servidor y base) | ✅ producción (mensaje) + `test:schema` (trigger, con y sin el RPC) |
| La vista del revisor no muestra nombre | ✅ `test:schema`; ⚠️ producción pendiente (segunda cuenta) |
| Otra org no ve nada | ✅ `test:schema` |
| Borrar elimina entrega, revisión y expediente | ✅ `test:schema`; ⚠️ producción pendiente (lo pruebas tú) |
| El bloque "NO prueba" siempre aparece | ✅ texto fijo, visto en producción |
| anon no ejecuta ningún RPC | ✅ producción, 8/8 con 401 |

**Bug 1 (encontrado en producción):** en A-01 (sin observaciones de IA
porque se envió antes de la F3) el bloque 3 decía "Pendientes de que una
persona las confirme o descarte" justo encima de "No hay observaciones de
IA". Arreglo: esa frase solo aparece si hay observaciones.

**Bug 2:** la copia del expediente que ve quien revisa le hablaba como al
candidato ("Tú y la persona que revisó **tu** entrega", "Real: **tus**
respuestas"). Arreglo: los textos fijos tienen versión por vista
(`candidato` / `revisor`) y una prueba de regresión.

**Riesgo cerrado parcialmente:** la explicación es texto libre y puede
revelar identidad (en la prueba real, "fuera de tema" hablaba de la
persona). No se puede limpiar a mano sin alterar la evidencia, así que:
aviso en el formulario del candidato ("No escribas tu nombre, tu escuela
ni datos personales…") y en la pantalla del revisor ("Si el texto revela
quién es… no lo uses y decláralo como conflicto si la conoces").

**Prueba de persona (capa 1), sobre las pantallas reales en producción.**
Persona: 25 años, egresada de Contaduría, reparte comida por app, ha
aplicado decenas de veces, hizo pruebas en línea que nunca respondieron y
desconfía de plataformas que prometen trabajo. (Es una prueba simulada
por mí recorriendo las capturas en orden, no una persona real.)
1. **Login / inicio:** el aviso "No es trabajo real ni garantiza empleo.
   No pagas nada." le baja la guardia: no le están vendiendo nada.
2. **Caso:** la tabla y las fórmulas se entienden; duda en "Días de
   cobranza", pero la fórmula está en la etiqueta. El nuevo aviso de no
   poner su nombre le confirma que "a ciegas" va en serio.
3. **Resultado:** "no coincide · valor correcto: 30.0" sin puntaje se lee
   como retroalimentación, no como reprobar.
4. **Reenvío:** "Intento 2: reenvío · práctica, no se revisa" — entiende
   que el primero es el que cuenta; podría frustrarle, pero está dicho.
5. **Expediente:** cree el bloque de cálculos (es verificable) y la
   etiqueta de IA. **La peor confusión:** llega a "Lo que este archivo NO
   prueba" (cuatro "No…") y no hay nada que diga para qué sí sirve; para
   alguien que ya fue ignorado por pruebas en línea, eso se lee como
   "otra prueba que no sirve" → razón para irse, no honestidad.
   **Arreglo:** bloque fijo "Lo que este archivo sí muestra" justo antes
   (cómo resolvió el caso con sus palabras; qué vio una persona real a
   ciegas y cuándo; qué revisó el sistema y qué la persona), sin prometer
   empleo ni entrevistas (prueba de regresión que lo impide).
6. **Eliminación:** el botón en dos pasos ("No se puede deshacer") le da
   control; no hay sorpresas.

**Pruebas:** `test:logica` 90/90, `test:schema` 74/74, build limpio,
lint sin warnings.

## 2026-10-11 — Cierre de la Feature 5 (deploy 2: `d430dea`)

- **Arreglos visibles en producción** (A-01, con tu sesión): aparece "Lo
  que este archivo sí muestra"; ya no aparece la frase contradictoria del
  bloque 3; "NO prueba" sigue.
- **Desde fuera con curl, sin sesión:** `/login` 200, título
  "First-Proof Finance MX", sin muro de Vercel → **Deployment Protection
  apagado**; `/dashboard`, `/revisar`, `/caso` → 307 a `/login`;
  `/?code=x` → `/auth/callback?code=x`.
- `scripts/probar-anon.sh` contra producción: 8/8 RPCs 401, tablas `[]`.

**Commits del plan:** `feat: auth, organization and phone-first shell`
(9a46b62, deploy 1) · `feat: candidate submission and automatic
calculation check` (bdee987) · `feat: AI-prepared observations with
guard` (9df2a8f) · `feat: blind review and evidence file` (8bc8be3) ·
`fix: contradictory AI-observation text and reviewer-facing wording in
evidence file` (d430dea, deploy 2).

**Pendiente tuyo para cerrar al 100%:**
1. Login con Google al primer clic en incógnito sobre este deploy (no
   puedo iniciar sesión con contraseñas).
2. Con una **segunda cuenta de Google** unida a tu org (código de la
   organización): revisar A-01 a ciegas y comprobar que no ve tu nombre
   (y, si quieres, la respuesta de red); luego, con tu cuenta, ver el
   expediente revisado.
3. Probar "Solicitar eliminación de mi expediente" (borra todo; lo
   tienes que hacer tú).

## 2026-10-11 — Bug: después de cerrar sesión no se podía elegir otra cuenta

**Reportado por ti:** al cerrar sesión e iniciar otra vez, Google entraba
directo con la misma cuenta. "Cerrar sesión" cierra la sesión de la app
(Supabase), no la de Google en el navegador, y sin indicación Google usa
la cuenta abierta. Para este slice es un bloqueo real: candidato y
revisor tienen que ser cuentas distintas.

**Arreglo:** `queryParams: { prompt: "select_account" }` en
`signInWithOAuth` (`app/login/page.tsx`): Google muestra siempre el
selector de cuentas. Build limpio y lint sin warnings; **pendiente
verificarlo en producción** (necesita iniciar sesión con Google, lo
pruebas tú).
