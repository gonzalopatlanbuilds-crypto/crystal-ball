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
