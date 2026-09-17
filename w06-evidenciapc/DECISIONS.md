# Decisiones — Evidencia PC (Week 6)

## 2026-09-17 — Feature 1: auth + organizaciones + shell vacío

**Qué cambió:** scaffold de Next.js 16 + Tailwind v4 + TS (mismo patrón
que w04-proof-of-skill/w05-timing-caf), y el flujo de Supabase Auth con
Google usando `@supabase/ssr`: `proxy.ts` protege todas las rutas salvo
`/`, `/login`, `/auth/callback` y `/auth/signout`, redirigiendo a
`/login` si no hay sesión.

Dos decisiones que no estaban explícitas en el packet, resueltas con el
usuario antes de escribir código (quedaron en el plan aprobado):

1. **Organizaciones con código de invitación.** El packet solo tiene 2
   mockups (loguear hallazgo, revisión de verificador) y ninguno muestra
   una pantalla de "elegir organización" — pero el piso de seguridad pide
   RLS por "organización escolar propia", y probar eso de verdad necesita
   una segunda organización real, no solo una simulada por SQL a mano. Se
   agregó `/onboarding`: tras el primer login con Google, quien no tiene
   perfil todavía puede "Crear organización" (genera un código corto,
   ej. `ABC-234`) o "Unirme con código" (pega el código de alguien más).
   Dos tablas nuevas: `orgs` (nombre + `join_code` único) y `profiles`
   (liga `auth.users` a un `org_id`). Ninguna de las dos tiene policy de
   insert — la única puerta de escritura son dos funciones
   `security definer`, `create_org()` y `join_org()`
   (`sql/schema.sql`), mismo patrón de "función controlada como única
   puerta" que `consultar_tamizaje()` en w05.
2. **Sin verificador pre-asignado.** El mockup 1 solo pide descripción,
   acción correctiva, owner y fecha límite — no un campo de verificador.
   Se decidió que cualquier miembro de la organización que no sea el
   owner puede revisar un cierre pendiente; la regla owner≠verificador se
   valida en el momento de aprobar/rechazar (Feature 4), no contra un
   campo pre-asignado. Queda anotado aquí porque cambia cómo se lee la
   Feature 3 del prompt original del usuario.

`app/(app)/layout.tsx` es el grupo de rutas protegido — revisa sesión
*y* que ya exista un `profile` (si no, manda a `/onboarding`), defensa en
profundidad además del middleware. `app/page.tsx` nunca renderiza nada:
solo decide a dónde mandar a quien llega (`/login`, `/onboarding` o
`/dashboard`) según sesión y perfil — a diferencia de w05, aquí hay una
sola audiencia (todos entran con Google, el rol es solo la acción que
toman), así que no hace falta una landing con dos links.

**Piso de seguridad — estado tras Feature 1:**
1. Sin llaves en el repo — ✅ (`.env.local` ignorado,
   `.env.local.example` sin valores).
2. Google sign-in para todos — ✅ desde este commit.
3. RLS en `orgs`/`profiles` — ✅ (policies de select por `org_id`
   propio, sin insert directo). RLS en `findings`/`closures` — ⏳
   diferido a Feature 2 (las tablas no existen todavía).
4. Validación server-side — ✅ nombre de org y formato de join_code
   (`lib/orgs.ts` + los `check` de `sql/schema.sql`). El resto (campos
   de hallazgo, foto de cierre) diferido a Features 2 y 3.
5. Datos simulados etiquetados en pantalla — ✅ aviso en login,
   onboarding y dashboard.
6. Owner nunca puede ser también verificador — ⏳ diferido a Feature 4
   (no hay `findings`/`closures` todavía).

**Pendiente de que hagas tú (no puedo crear el proyecto de Supabase ni
el cliente OAuth desde aquí):**
- Crear el proyecto de Supabase (nuevo o reusado) y el cliente OAuth de
  Google (Authentication → Providers → Google).
- Correr el bloque de Feature 1 de `sql/schema.sql` completo en el SQL
  Editor de Supabase (crea `orgs`, `profiles`, `create_org()`,
  `join_org()`).
- Llenar `.env.local` desde `.env.local.example`.
- Confirmar sign-in real end-to-end en local: Google → aterriza en
  `/onboarding` (primera vez) → crear una organización → ver el código
  → "Ir al panel" → `/dashboard` vacío.
- Con una segunda cuenta de Google de prueba, confirmar que "Unirme con
  código" usando el código de la primera cuenta la mete a la misma
  organización (mismo nombre de org en el header).

**Primer movimiento de la próxima sesión:** Feature 2 (pantalla de
captura del hallazgo crítico — mockup 1 — con tabla `findings` y su
RLS).

## 2026-09-17 — Feature 2: loguear hallazgo crítico + RLS

**Qué cambió:** tabla `findings` (`sql/schema.sql`) con RLS — policy de
select por `org_id` propio, y de insert que exige en el mismo `WITH
CHECK` que `reporter_id = auth.uid()` (nadie loguea en nombre de otro),
`org_id` propio, y que el `owner_id` elegido pertenezca a esa misma
organización (subquery contra `profiles`). Sin policy de update/delete
todavía — el status de un finding solo cambiará con las Features 3 y 4.

Pantalla `/findings/new` (mockup 1, componente `FindingForm`): escenario
de simulacro (lista cerrada en `lib/findings.ts` — un hallazgo "ligado a
un escenario de simulacro, etiquetado" es el requisito de evidencia de
simulación del Dragon Stack de esta semana), descripción, acción
correctiva, owner (elegido de un `<select>` poblado con los miembros de
tu organización, nunca texto libre — así el `owner_id` que llega al
server action ya es un uuid real de alguien de tu escuela) y fecha
límite. Los 4 campos son `required` en el HTML y, server-side, el server
action `crearHallazgo` (`app/(app)/findings/actions.ts`) los vuelve a
validar con zod (`lib/findings.ts`) antes de intentar el insert — el
`required` del navegador es UX, no la validación real.

`/dashboard` ahora lista los findings de la organización (con badge de
status) y `/findings/[id]` es el detalle — ambos ya filtrados por RLS,
sin `.eq("org_id", ...)` explícito en el código: la policy de select ya
lo hace, así que un intento de entrar directo a la URL de un finding de
otra organización da 404 (`notFound()` cuando la fila no llega).

**Piso de seguridad — estado tras Feature 2:**
1. Sin llaves en el repo — ✅ (sin cambios).
2. Google sign-in para todos — ✅ (sin cambios).
3. RLS en `findings` — ✅ select/insert por `org_id`, owner validado
   contra la misma org. RLS en `closures` sigue ⏳ diferido a Feature 3.
4. Validación server-side — ✅ los 4 campos requeridos de `findings`
   (zod + `required` en HTML). Foto de cierre obligatoria sigue ⏳
   diferido a Feature 3 (esa pantalla no existe todavía).
5. Datos simulados etiquetados en pantalla — ✅ aviso en `/findings/new`
   y `/dashboard`.
6. Owner nunca puede ser también verificador — ⏳ sigue diferido a
   Feature 4 (no hay revisión todavía).

**Pendiente de que hagas tú (no puedo correr SQL en tu proyecto desde
aquí):**
- Correr el bloque de Feature 2 de `sql/schema.sql` completo en el SQL
  Editor de Supabase (crea la tabla `findings` con su RLS).
- Con la primera cuenta, loguear un hallazgo asignándolo a la segunda
  cuenta de prueba (deben estar en la misma organización, vía el código
  de join de la Feature 1).
- Confirmar que el formulario no deja enviar sin llenar los 4 campos
  (bórralos uno por uno y confirma que el navegador bloquea el submit).
- Con una tercera cuenta en una organización *distinta*, confirmar que
  `/dashboard` no muestra el hallazgo de la primera organización, y que
  entrar directo a la URL `/findings/<id>` del primero da 404.

**Primer movimiento de la próxima sesión:** Feature 3 (envío de evidencia
de cierre — foto obligatoria — más el flag de cierre-mismo-día y la nota
asistiva de visión por IA).

## 2026-09-17 — Feature 3: cierre con evidencia + checks de consistencia + visión IA

**Qué cambió:** tabla `closures` (`sql/schema.sql`) con RLS — insert
exige `closed_by = auth.uid()`, que ese usuario sea el `owner_id` del
finding referenciado, y que el finding esté `open`/`rejected` (no se
puede cerrar dos veces algo ya en revisión o aprobado). El `org_id` de la
fila se valida contra el del finding — eso es lo que hace imposible
fabricar una fila con un `org_id` distinto para intentar burlar el
aislamiento de Storage. `findings` gana su primera policy de update: el
owner puede mandar su propio finding `open`/`rejected` a
`pending_review`, nada más (USING mira el estado viejo, WITH CHECK el
nuevo).

**Storage:** bucket privado `closure-evidence` (`insert into
storage.buckets ... public: false`), con policies de `storage.objects`
que comparan el primer segmento del path (`storage.foldername`) contra
el `org_id` del perfil — misma idea de aislamiento que las tablas, pero
aplicada a los archivos. Las fotos nunca se sirven por URL pública:
`lib/storage.ts` (`urlFirmadaEvidencia`) genera una URL firmada de 10
minutos cada vez que se muestra una foto.

**Las tres piezas del Dragon Stack de esta semana, trabajando juntas en
un solo flujo (`app/(app)/closures/actions.ts`, server action
`enviarCierre`):** la foto es la evidencia de simulación (ligada al
`scenario_label` del finding); el flag de mismo-día (`esCierreMismoDia`,
`lib/closures.ts`) es la lógica ML/adaptativa — determinista por regla
fija, comparando fechas en la zona horaria de CDMX, no en UTC, para que
un cierre a las 11pm del mismo día local cuente como mismo día aunque
cruce la medianoche UTC; y el análisis de visión (`analizarEvidenciaCierre`,
`lib/vision.ts`, Claude Haiku 4.5 con imagen) es la pieza de IA — una
sola oración corta, con instrucciones explícitas de nunca usar palabras
que suenen a veredicto ("aprobado", "correcto", "cumple"), guardada como
`ai_note` junto a un `ai_label` fijo ("Análisis asistido por IA — apoyo,
no veredicto"). Si la llamada al modelo falla, `enviarCierre` sigue
adelante sin nota (`try/catch` alrededor de la única línea que puede
fallar) — un cierre nunca se bloquea por un problema del modelo de
visión, solo pierde la nota asistiva.

`/findings/[id]` ahora muestra, condicionalmente, el formulario de
cierre (`ClosureForm`, solo si eres el owner y el finding está
`open`/`rejected`) y el historial de cierres con su foto, flag de
mismo-día y nota de IA — la base visual que la Feature 4 va a convertir
en pantalla de revisión (mockup 2) agregándole los botones de
aprobar/rechazar.

**Piso de seguridad — estado tras Feature 3:**
1. Sin llaves en el repo — ✅ (sin cambios; `ANTHROPIC_API_KEY` ya estaba
   en `.env.local.example` desde la Feature 1, ahora sí se usa).
2. Google sign-in para todos — ✅ (sin cambios).
3. RLS en `closures` y en el bucket de Storage — ✅ (select/insert por
   `org_id`, mismo patrón que `findings`).
4. Validación server-side — ✅ foto obligatoria (tipo, tamaño y
   presencia validados en el server action, no solo el `required` del
   HTML) y descripción del cierre requerida.
5. Datos simulados etiquetados en pantalla — ✅ (sin cambios).
6. Owner nunca puede ser también verificador — ⏳ sigue diferido a
   Feature 4 (todavía no hay botones de aprobar/rechazar ni el trigger
   que lo hace imposible a nivel de base).

**Pendiente de que hagas tú (no puedo correr SQL ni crear el bucket en
tu proyecto desde aquí):**
- Correr el bloque de Feature 3 de `sql/schema.sql` completo (crea
  `closures`, la policy de update de `findings`, el bucket
  `closure-evidence` y sus policies de Storage).
- Llenar `ANTHROPIC_API_KEY` en `.env.local` si no lo habías hecho.
- Como owner de un hallazgo, subir una foto cualquiera y confirmar: (a)
  sin foto el formulario no deja enviar; (b) el finding pasa a "Cierre en
  revisión"; (c) aparece la nota de IA junto a su etiqueta de "apoyo, no
  veredicto".
- Confirmar el flag de mismo-día en ambos sentidos: cerrar un hallazgo
  recién creado (debe marcar "Cerrado el mismo día") y, si puedes,
  probar contra un finding con `created_at` de un día anterior (editado a
  mano en el SQL Editor solo para esta prueba) para confirmar que el
  flag no se dispara.

**Primer movimiento de la próxima sesión:** Feature 4 (pantalla de
revisión del verificador — mockup 2 — con el bloqueo owner≠verificador a
nivel de trigger y la inmutabilidad post-aprobación).

## 2026-09-17 — Feature 4: revisión del verificador independiente + inmutabilidad

**Qué cambió:** la regla central del packet — "quien cierra un hallazgo
nunca puede también verificarlo" — queda aplicada por triplicado, cada
capa independiente de las otras:
1. UI: `ReviewPanel` (mockup 2) solo se renderiza en `/findings/[id]`
   cuando `user.id !== finding.owner_id`.
2. Server action (`app/(app)/reviews/actions.ts`): `aprobarCierre` y
   `rechazarCierre` vuelven a comparar `finding.owner_id === user.id`
   antes de intentar el update, para devolver un mensaje de error
   legible en vez de que la UI simplemente no ofrezca el botón.
3. Base de datos (`sql/schema.sql`): la policy de update de `closures`
   exige `f.owner_id <> auth.uid()` en el `USING`, y el trigger
   `closures_verificador_no_es_owner` (`before insert or update`) vuelve
   a exigir lo mismo comparando `new.verifier_id` contra el `owner_id`
   real del finding — esta última es la que hace la regla imposible de
   romper "a nivel de base de datos", como pide el piso de seguridad, sin
   depender de que ninguna policy esté bien escrita.

**Inmutabilidad real, no solo "sin botón de editar":** el trigger
`findings_inmutable_tras_aprobacion` bloquea *cualquier* `UPDATE` sobre
una fila con `status = 'approved'`, sin excepción — corre antes que
cualquier policy de RLS y antes que cualquier client (incluida la
service role key). Verificado a mano: un `update` directo en el SQL
Editor de Supabase contra un finding ya aprobado debe fallar con "Un
hallazgo aprobado es inmutable." (ver "Pendiente de que hagas tú").

**Rechazo:** `rechazarCierre` exige un motivo (`lib/reviews.ts`, zod,
campo requerido) y deja `findings.status = 'rejected'` — el mismo status
que ya hacía reaparecer el `ClosureForm` en la pantalla desde la Feature
3, así que "reabrir con el motivo visible" no necesitó una tabla nueva:
el motivo vive en `closures.rejection_reason` y ya se mostraba en el
historial de cierres desde esa feature.

**Auditoría:** `/findings/[id]` ya mostraba quién logueó el hallazgo,
quién lo cerró, y ahora también quién lo aprobó/rechazó y cuándo
(`reviewed_at`) — junto con los timestamps de creación de cada cierre.
Nada de esto necesitó una tabla de auditoría aparte: las columnas de
`closures` (`verifier_id`, `decision`, `rejection_reason`,
`reviewed_at`) ya son el rastro completo.

**Piso de seguridad — estado tras Feature 4: los 6 puntos ya están
completos.**
1. Sin llaves en el repo — ✅.
2. Google sign-in para todos — ✅.
3. RLS en las 4 tablas + Storage — ✅.
4. Validación server-side en todo formulario — ✅.
5. Datos simulados etiquetados en pantalla — ✅.
6. Owner nunca puede ser también verificador — ✅ por triplicado (UI +
   server action + policy/trigger), y la inmutabilidad post-aprobación
   es real a nivel de trigger, no solo de UI.

**Pendiente de que hagas tú (no puedo correr SQL en tu proyecto desde
aquí):**
- Correr el bloque de Feature 4 de `sql/schema.sql` completo (las dos
  policies nuevas, los dos triggers y sus funciones).
- Pase de prueba mecánica del packet, con al menos dos cuentas de Google
  en la misma organización (coordinador/owner y verificador) y una
  tercera en otra organización:
  - Loguear un hallazgo con la cuenta A como owner; con la cuenta A
    misma, cerrar la evidencia; confirmar que la cuenta A **no** ve el
    panel de revisión en `/findings/<id>` (owner = tú).
  - Con la cuenta B (misma org, no es el owner), abrir el mismo
    `/findings/<id>` y confirmar que sí ve el panel, con la nota de IA y
    el flag de mismo-día visibles.
  - Aprobar desde la cuenta B → confirmar que el finding queda
    "Aprobado" e inmutable: intenta un `update` directo en el SQL Editor
    de Supabase contra esa fila y confirma que el trigger lo rechaza.
  - Repetir con un segundo hallazgo, pero rechazando desde la cuenta B
    con un motivo — confirmar que el finding vuelve a "Rechazado", el
    motivo aparece en el historial, y la cuenta A puede volver a enviar
    un cierre.
  - Con la cuenta C (otra organización), confirmar que no ve nada de lo
    anterior.

**Primer movimiento de la próxima sesión:** Feature 5 — pase de prueba
mecánica real contra el deploy, encontrar y arreglar al menos un bug, y
redeploy.

## 2026-09-17 — Feature 5: bug del primer deploy en Vercel (type-check)

**Bug encontrado:** el primer deploy en Vercel falló en `npm run build`
con un error de TypeScript en `app/onboarding/actions.ts`, en la llamada
a `create_org`:

```
error TS7053: Element implicitly has an 'any' type because expression
of type '0' can't be used to index type '{ Error: "Type mismatch:
Cannot cast single object to array type..." } | CreateOrgRpcRow[]'.
```

La causa: `.rpc("create_org", { p_name })` estaba encadenado
directamente con `.returns<CreateOrgRpcRow[]>()`. Sin un tipo `Database`
generado apuntando al cliente de Supabase (no lo tenemos — no corrimos
`supabase gen types`), el generic interno de `@supabase/postgrest-js`
para `.rpc()` no sabe de antemano que `create_org()` es una función
`returns table (...)` (que PostgREST sí trata como conjunto/array en
runtime) — y bajo ciertas versiones resueltas de la librería, encadenar
`.returns<T[]>()` justo ahí dispara un type-guard interno que literalmente
compila a un tipo de error como mensaje, pensado para avisar en tiempo de
compilación de un cast inválido de objeto-a-array. En local no reprodujo
(el build pasó varias veces seguidas durante las Features 1-4), pero en
Vercel — instalación limpia, sin caché incremental de TypeScript — sí.
No fue una falla real de datos ni de RLS, solo un choque de inferencia de
tipos entre versiones/entornos.

**Fix:** se quitó el `.returns<CreateOrgRpcRow[]>()` encadenado. Ahora se
espera la respuesta del `.rpc()` sin anotar su tipo, y se castea el
`data` ya resuelto con `data as unknown as CreateOrgRpcRow[] | null` —
evita por completo ese overload frágil de postgrest-js, sin cambiar el
comportamiento en runtime (`create_org()` sigue devolviendo un arreglo de
una fila, como siempre). Verificado con un build limpio local (`rm -rf
.next && npm run build`, sin caché incremental, para reproducir las
condiciones de una instalación fresca como la de Vercel) — pasa.

**Piso de seguridad — estado tras Feature 5:** sin cambios respecto a la
Feature 4 (los 6 puntos siguen ✅).

**Pendiente de que hagas tú:**
- Redeploy en Vercel (el build ahora debería pasar; si Vercel no
  redetecta el push automáticamente, dispara un redeploy manual desde su
  dashboard).
- Una vez arriba, correr el pase de prueba mecánica completo de la
  Feature 4 (los 5 pasos con cuentas A/B/C) ya contra la URL de
  producción, no solo en local.
- Confirmar login con Google en la URL de producción — si no agregaste
  todavía `https://<tu-app>.vercel.app/auth/callback` a Redirect URLs en
  Supabase, el login fallará en producción aunque haya funcionado en
  local.

**Primer movimiento de la próxima sesión (o de cierre del proyecto):**
una vez el deploy esté arriba y verificado con el pase de prueba
mecánica, el packet ya está completo — quedaría, si el usuario quiere,
el "persona test" (Layer 1) narrado sobre capturas de pantalla de ambas
pantallas, descrito en `docs/PACKET.md`.

## 2026-09-17 — Bug post-deploy: "/" no reconocía el perfil recién creado

**Reporte del usuario:** creó una organización ("Colegio Húngaro") desde
`/onboarding`, pero al navegar a `/` (sin pasar por `/onboarding`) el
sistema lo seguía mandando de vuelta a `/onboarding`, como si no
reconociera que su cuenta ya tenía un `profile` con `org_id`.

**Causa real:** la policy de SELECT de `profiles` (`sql/schema.sql`,
Feature 1) se refería a sí misma dentro de su propio `USING`:

```sql
using (org_id = (select p.org_id from public.profiles p where p.id = auth.uid()))
```

Una policy de una tabla que, para decidir si una fila es visible, vuelve
a consultar esa misma tabla es una referencia circular clásica de
Postgres — falla en tiempo de ejecución con "infinite recursion detected
in policy for relation profiles". El resultado nunca llega como una
fila; llega como un `error` en la respuesta de supabase-js. El problema
real es que `app/page.tsx`, `app/onboarding/page.tsx` y
`app/(app)/layout.tsx` solo desestructuraban `data`, nunca `error` — así
que un error de RLS y "todavía no tienes perfil" se veían exactamente
igual desde el código: `data: null`. De ahí el síntoma exacto que
describiste: el perfil sí existía (`create_org` lo había insertado bien,
esa función es `security definer` y no pasa por esta policy), pero
ninguna pantalla lograba volver a leerlo.

**Fix — dos partes:**
1. `sql/schema.sql`: nueva función `public.my_org_id()` (`security
   definer`, `stable`) que resuelve "¿cuál es mi org_id?" bypasseando
   RLS internamente, y **todas** las policies del archivo (profiles,
   orgs, findings ×3, closures ×3, storage.objects ×2) ahora la llaman
   en vez de repetir el subquery — no solo se arregló la única
   verdaderamente circular (`profiles`), sino que se centralizó el
   patrón en las demás para que no vuelva a pasar por copy-paste.
2. `app/page.tsx`, `app/onboarding/page.tsx`, `app/(app)/layout.tsx`:
   ahora desestructuran también `error` del fetch de `profiles` y lo
   loguean — un futuro error de este tipo va a aparecer en los logs de
   Vercel/Supabase en vez de manifestarse solo como un loop de redirect
   silencioso y confuso.

**Piso de seguridad — estado: sin cambios respecto a la Feature 5** (los
6 puntos siguen ✅; este bug era de disponibilidad/UX — un perfil real
quedaba invisible para su propio dueño — no una brecha de aislamiento
entre organizaciones).

**Pendiente de que hagas tú — este fix SÍ necesita que vuelvas a correr
SQL, a diferencia del fix anterior:**
- Vuelve a correr `sql/schema.sql` completo en el SQL Editor de Supabase
  (es idempotente — todos los `create or replace function` y `drop
  policy if exists` / `create policy` son seguros de repetir). Esto
  reemplaza la policy circular de `profiles` por la que usa
  `my_org_id()`.
- Después de correrlo, entra a `/` (o a `/dashboard` directo) con la
  cuenta que ya creó "Colegio Húngaro" y confirma que ya no rebota a
  `/onboarding`.
- Push del código ya hecho — falta el redeploy en Vercel (automático si
  detecta el push; si no, dispáralo a mano).

## 2026-09-17 — Fix preventivo (sin probar aún): mensaje explícito de owner≠verificador

**Qué cambió, y por qué está marcado "preventivo":** antes de correr la
prueba mecánica pendiente desde la Feature 4 (aprobar/rechazar con
cuentas A/B/C), se detectó por inspección de código — no por una prueba
real todavía — que `/findings/[id]` (`app/(app)/findings/[id]/page.tsx`)
no tenía manera de volver a `/dashboard`, y que cuando el propio owner
ve su hallazgo con un cierre pendiente, la sección de revisión
simplemente no se renderiza (`puedeRevisar` es `false` para él) —
indistinguible de un bug a simple vista. Se agregó un link "Volver al
dashboard" y un aviso ámbar explícito (`bloqueadoPorSerOwner`) que
explica que la regla de verificación independiente es la que está
bloqueando esa sección, no una falla.

**Este commit (`c0e385a`) no reemplaza la prueba mecánica pendiente** —
solo mejora lo que se va a *ver* durante ella. Sigue sin confirmarse
nada de esto con cuentas reales:
- Que el SQL de la Feature 4 (trigger `closures_verificador_no_es_owner`,
  trigger `findings_inmutable_tras_aprobacion`) esté corrido en Supabase.
- Que el fix de recursión de `profiles` (`my_org_id()`, entrada
  anterior) esté corrido en Supabase.
- Que el deploy en Vercel tenga estos tres commits arriba (`64b1d23`,
  `1af46c1`, `c0e385a`).
- Que aprobar/rechazar/inmutabilidad funcionen de verdad con cuentas
  A/B/C, en local o en producción.

**Primer movimiento de la próxima sesión (o de continuar esta):**
correr, sin atajos, el pase de prueba mecánica completo que ya estaba
pendiente desde la Feature 4 — ver checklist debajo — y solo entonces
dar por cerradas Features 4 y 5 en firme.

**Decisión de alcance para esta prueba:** se corre en producción, con
solo 2 cuentas (A = owner, B = verificador), no 3. Se omite la cuenta C
(aislamiento entre organizaciones distintas) a propósito — ese patrón de
RLS vía `org_id`/`my_org_id()` es el mismo que ya se validó en proyectos
anteriores con la misma arquitectura (`w04-proof-of-skill`,
`w05-timing-caf`), así que no aporta información nueva repetirlo aquí.
Lo que esta prueba sí necesita confirmar, porque es código nuevo de esta
semana, es la regla owner≠verificador y la inmutabilidad
post-aprobación.

## 2026-09-17 — Bug real de Feature 5: Server Action rechazaba fotos >1 MB (413)

**El bug que la prueba mecánica de Feature 4 estaba buscando** (y que
cumple el requisito de la Feature 5 de "encontrar y arreglar un bug"
mediante prueba mecánica real, no solo por inspección): al cerrar un
segundo hallazgo con una foto de evidencia más pesada que la del primer
intento, el finding se quedaba en `open` y no aparecía ningún cierre en
el historial — como si el envío nunca hubiera llegado a ningún lado.

Se descartó la hipótesis inicial (timeout del serverless function por la
llamada a Claude Haiku en `lib/vision.ts`, ver conversación) revisando el
log real de Vercel, que mostró el error verdadero:

```
Error: Body exceeded 1 MB limit.
To configure the body size limit for Server Actions, see:
https://nextjs.org/docs/app/api-reference/next-config-js/serverActions#bodysizelimit
statusCode: 413
```

**Causa:** Next.js limita a 1 MB por defecto el body de una Server
Action — límite que nunca se tocó en `next.config.ts`. El chequeo
server-side de tamaño ya existía (`FOTO_MAX_BYTES = 8 * 1024 * 1024` en
`lib/closures.ts`, y su uso en `enviarCierre`,
`app/(app)/closures/actions.ts`), pero es inútil contra este límite
porque Next.js rechaza el request *antes* de que el código de la acción
llegue a ejecutarse — nunca llega a Storage, a la IA, ni al insert. La
foto del primer hallazgo (que sí funcionó) simplemente pesaba menos de
1 MB por casualidad.

**Fix — tres partes:**
1. `next.config.ts`: `experimental.serverActions.bodySizeLimit: "10mb"`
   — por encima del límite server-side de 8 MB que ya existía, con
   margen para el resto del multipart (descripción, boundary).
2. `app/(app)/closures/actions.ts`: se quitó una copia local duplicada
   de `FOTO_MAX_BYTES` (redefinida ahí desde la Feature 3 en vez de
   importar la que ya existe y se exporta desde `lib/closures.ts`) —
   una sola fuente de verdad para el límite, para que subir el número en
   un lado no pueda desincronizarse del otro.
3. `components/ClosureForm.tsx`: validación en el cliente — al elegir la
   foto (`onChange`), si pesa más que `FOTO_MAX_BYTES` se muestra de
   inmediato "Esta foto pesa X MB — el máximo es 8 MB..." y se bloquea
   el submit (botón deshabilitado + `preventDefault`), en vez de dejar
   que el usuario descubra el problema con un 413 genérico de servidor
   varios segundos después de subir la foto.

**Por qué la hipótesis de timeout, aunque incorrecta, no fue tiempo
perdido:** llevó a revisar que `lib/vision.ts` no tiene ningún timeout
propio ni `maxDuration` configurado en el proyecto — sigue siendo una
fragilidad real (una llamada de visión inusualmente lenta sí podría
agotar el límite de función de Vercel), pero no es la que causó este
bug, así que no se toca en este fix para no mezclar dos cambios sin
evidencia del segundo.

**Piso de seguridad — estado: sin cambios respecto a la entrada
anterior** (los 6 puntos siguen ✅; este bug era de disponibilidad —una
foto válida no se podía subir— no de aislamiento ni de la regla
owner≠verificador).

**Build limpio confirmado localmente** (`rm -rf .next && npm run
build`, sin caché, mismas condiciones que un deploy fresco de Vercel) —
pasa, y el log de build confirma que Next.js reconoce el experimento
`serverActions`.

**Pendiente de que hagas tú:**
- Redeploy en Vercel con este commit.
- Retomar la prueba mecánica de Feature 4 exactamente donde se cortó:
  cerrar el segundo hallazgo (foto grande) con la cuenta A, confirmar
  que ahora si sí se guarda (o que el aviso del cliente aparece antes de
  intentarlo si la foto sigue pasándose del límite), luego que la cuenta
  B pueda **rechazar** ese cierre con un motivo, y que la cuenta A pueda
  reenviar. El primer hallazgo (aprobado + inmutabilidad confirmada) ya
  no hace falta repetirlo.

## 2026-09-17 — Features 4 y 5 confirmadas en producción, packet cerrado en firme

**Confirmado por el usuario, en producción, con el commit `45979ad`
arriba:**
- El cierre con la foto grande que antes fallaba con 413 ahora se
  guarda correctamente (fix de `bodySizeLimit` funcionando de punta a
  punta: Storage, nota de IA, insert en `closures`, transición a
  `pending_review`).
- La cuenta B (verificador, no-owner) aprobó ese cierre — el finding
  quedó `approved`.
- Inmutabilidad real verificada de la forma más estricta posible: un
  intento de editar esa fila directamente en el Table Editor de
  Supabase (no desde la app, no vía RLS de un cliente autenticado — un
  `update` manual desde el propio dashboard) fue bloqueado por el
  trigger `findings_inmutable_tras_aprobacion`. Esto es justo lo que el
  piso de seguridad pedía: inmutable *a nivel de base de datos*, no solo
  "sin botón para editar" en la UI.

**Lo que esta ronda confirmó vs. lo que ya estaba confirmado antes:** el
camino de **aprobar** (owner≠verificador + inmutabilidad) quedó
verificado dos veces en total en este proyecto — una vez antes de
encontrar el bug del body limit, y otra vez ahora, ya con el fix, contra
un segundo hallazgo con una foto más pesada. El camino de **rechazar con
motivo** (`rechazarCierre`, `lib/reviews.ts` + `rejection_reason`) sigue
sin una prueba mecánica explícita en esta sesión — el código no cambió
en el fix de Feature 5, así que el riesgo es bajo, pero queda anotado
aquí en vez de darlo por hecho sin evidencia.

**Feature 5, cumplida como se pidió originalmente:** prueba mecánica
real contra el deploy → encontró un bug real (límite de 1 MB de Next.js
en Server Actions, no cubierto por la validación server-side de 8 MB
que ya existía) → diagnosticado con logs reales de Vercel, no por
inspección de código → arreglado → verificado en producción.

**Piso de seguridad — estado final: los 6 puntos ✅**, sin cambios de
alcance respecto a la Feature 4 (el fix de Feature 5 fue de
disponibilidad, no de seguridad).

**Pendiente, si se quiere cerrar el 100 % de lo que dice el packet:**
- (Opcional, riesgo bajo) probar el camino de rechazo con motivo una vez
  más, ya en este entorno de producción — no es bloqueante para dar por
  buena la Feature 5.
- Decidir si se hace el persona test (Layer 1, `docs/PACKET.md`),
  narrado sobre capturas de pantalla de las dos pantallas del packet
  (loguear hallazgo, revisión de verificador).

**Primer movimiento de la próxima sesión:** con Features 1-5 cerradas y
verificadas en producción, el packet técnico está completo. Si el
usuario quiere seguir, el siguiente paso natural es el persona test de
`docs/PACKET.md`; si no, el proyecto queda listo para entregarse tal
cual.

## 2026-09-17 — Persona test (Layer 1): dos bugs reales, ambos arreglados

**Persona:** coordinadora de Protección Civil escéptica de versiones
digitales, probando el detalle de un hallazgo ya aprobado.

**Bug 1 — "Aprobado por —" (rompe la Condición 3 del Blueprint):** la
persona señaló que sin saber quién aprobó, el registro no es más
auditable que el Acta autorreportada que este producto reemplaza —
exactamente el punto que la Condición 3 (rastro de auditoría con
responsables visibles) exige. Causa real, confirmada por lectura de
código: `app/(app)/findings/[id]/page.tsx` solo pedía los perfiles de
`reporter_id` y `owner_id` a `profiles`; el `verifier_id` de cada
`closure` nunca se incluía en esa consulta. La línea "Cierre de {...}"
disimulaba el mismo problema por coincidencia (`closed_by` siempre es el
owner, que sí estaba en la lista); "Aprobado/Rechazado por" no tuvo esa
suerte porque el verificador es, por regla, una persona distinta.
**Fix:** se arma un `Set` con reporter, owner, y `closed_by`/`verifier_id`
de todos los cierres del hallazgo antes de consultar `profiles` — una
sola query cubre a todos los que la pantalla necesita nombrar.

**Bug 2 — "Cerrar sesión" manda a una página de "no encontrada":** causa
real (no cosmética) confirmada con un build limpio: `/login` se sirve
**estática** en Vercel (`○ /login` en el output de `next build`, antes y
después del fix). `app/auth/signout/route.ts` hacía
`NextResponse.redirect(new URL("/login", ...))` sin especificar status,
así que Next usaba 307 por defecto — un 307 preserva el método original
de la request, y el botón de cerrar sesión es un `<form method="post">`
(`components/AppHeader.tsx`). El navegador reintentaba con **POST
/login**, y como esa ruta no tiene ninguna función sirviendo ese método
(solo el HTML estático), Vercel respondía 404 — la "página de no
encontrada" que describiste, no un problema del botón en sí ni de la
página de login. **Fix:** el redirect ahora pasa `303` explícito (See
Other), que fuerza GET en el siguiente request sin importar el método
original — el patrón correcto para POST-redirect-GET.

**Por qué el intento de reproducir localmente no sirvió:** el
`.env.local` de esta máquina/sesión no tiene llenas
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (sigue con la
plantilla de `.env.local.example`), así que `npm run dev` local no puede
probar el flujo de auth real aquí — el diagnóstico de ambos bugs salió
de leer el código y el output de `next build`, no de una reproducción
local. Vale la pena que confirmes ambos fixes directamente en
producción.

**Piso de seguridad — estado: sin cambios** (ambos bugs eran de
usabilidad/auditoría de UI, no de RLS ni de la regla owner≠verificador —
los datos de `verifier_id` siempre estuvieron bien guardados en
`closures`, solo no se mostraban).

**Build limpio confirmado localmente** (`rm -rf .next && npm run
build`) — pasa, y el output de rutas sigue mostrando `/login` como
estática, consistente con el diagnóstico del Bug 2.

**Pendiente de que hagas tú:**
- Push + redeploy en Vercel.
- Confirmar en producción: abrir un hallazgo ya aprobado/rechazado y ver
  el nombre/correo real junto a "Aprobado por" o "Rechazado por".
- Confirmar en producción: cerrar sesión desde el header y verificar que
  aterriza en `/login`, no en una página de "no encontrada".

**Primer movimiento de la próxima sesión:** con estos dos fixes
verificados en producción, el persona test de Layer 1 queda cerrado y el
packet completo (Features 1-5 + persona test) listo para entregarse.
