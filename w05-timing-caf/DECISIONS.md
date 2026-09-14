# Decisiones — Folio CAF (Week 5)

## 2026-09-13 — Feature 1: auth + shell vacío

**Qué cambió:** scaffold de Next.js 16 + Tailwind v4 + TS (mismo patrón
que w04-proof-of-skill), y el flujo de Supabase Auth con Google usando
`@supabase/ssr`: `proxy.ts` protege todas las rutas salvo `/`, `/login`,
`/auth/callback` y todo el árbol de `/consulta`, redirigiendo a `/login`
si no hay sesión. `app/(caf)/layout.tsx` + `app/(caf)/dashboard/page.tsx`
son el grupo de rutas protegido (defensa en profundidad: el layout también
revisa la sesión server-side, no solo el middleware). `/consulta` vive
**fuera** de ese grupo de rutas a propósito, para que nunca quede envuelta
por accidente en el auth check — solo tiene el shell visual por ahora, la
Feature 3 le pone la lógica real.

**Por qué la landing (`/`) es pública y no redirige directo a
`/dashboard` como en w04:** este producto tiene dos audiencias desde el
día uno (operador de CAF y paciente sin cuenta), a diferencia de w04 que
solo tenía empleadores. Una landing con dos links deja explícito que
"paciente sin login" no es un caso especial, es la mitad del producto.

**Piso de seguridad — estado tras Feature 1:**
1. Sin llaves en el repo — ✅ (`.env.local` ignorado, `.env.local.example`
   sin valores).
2. Google sign-in solo para operador, `/consulta` sin login — ✅ desde
   este commit.
3. RLS en `screenings` — ⏳ diferido a Feature 2 (la tabla no existe
   todavía).
4. Validación server-side (glucosa, cuestionario, rate-limit de
   consulta) — ⏳ diferido a Features 2 y 3 (no hay formularios con datos
   reales todavía).
5. Datos simulados etiquetados en pantalla — ⏳ diferido a Feature 2 (no
   hay datos de pacientes todavía).

**Pendiente de que hagas tú (no puedo crear el proyecto de Supabase ni el
cliente OAuth desde aquí):**
- Crear el proyecto de Supabase (nuevo o reusado) y el cliente OAuth de
  Google.
- Llenar `.env.local` desde `.env.local.example`.
- Confirmar sign-in real end-to-end en local y que `/consulta` carga sin
  sesión.

**Cerrado:** el usuario creó el proyecto de Supabase y el cliente OAuth de
Google, y confirmó sign-in real end-to-end en local (Google → aterriza en
`/dashboard` con su email). Feature 1 verificada.

**Nota para el deploy (Feature 5):** la URL `http://localhost:3000/**` no
aparece explícita en la lista de "Redirect URLs" de Supabase y aun así el
login local funcionó (cubierta por el Site URL por defecto). En
producción sí habrá que agregar `https://<tu-app>.vercel.app/auth/callback`
a esa lista o el login en Vercel fallará.

**Primer movimiento de la próxima sesión:** Feature 2 (pantalla de
captura del CAF + tabla `screenings` con RLS + scoring por reglas +
generación de folio).

## 2026-09-13 — Feature 2: captura CAF + scoring por reglas + folio

**Qué cambió:** tabla `screenings` (`sql/schema.sql`) con RLS — policies
de select/insert comparando `auth.uid() = operator_id` (sin update/delete:
un tamizaje ya capturado no se edita, es un registro clínico simulado, no
un borrador). La fila solo guarda los insumos crudos (glucosa, antecedente
familiar, síntomas, rango de edad) — el score y el nivel de riesgo
**nunca se guardan precomputados**, se recalculan siempre en el servidor
con `calcularRiesgo()` (`lib/scoring.ts`) a partir de esos insumos, tanto
en el dashboard como en el detalle del tamizaje. Una sola fuente de
verdad, sin riesgo de que un número guardado quede desincronizado de la
lógica.

Pantalla `/screenings/new` (componente `ScreeningCaptureForm`) — mismo
patrón que w04: el campo de glucosa es un input de texto validado a mano
(cliente y servidor), no `<input type="number">`, porque ese input nativo
bloquea letras en silencio y nunca dispara el error visible que pide la
Feature 2. Server action `crearTamizaje` (`app/(caf)/screenings/actions.ts`)
valida con zod (`lib/screenings.ts`), calcula el riesgo, genera un folio
(`generarFolio()`) y reintenta hasta 5 veces si choca con el UNIQUE de la
base (folio ya existe) antes de rendirse.

`/screenings/[id]` es el "comprobante impreso" (mockup 2 del packet):
folio grande, nombre del paciente, y aparte una sección de solo-operador
con el desglose del riesgo — con botón de imprimir (`window.print()`,
oculto en la vista impresa vía `print:hidden`).

**Folio — por qué ese alfabeto y ese formato:** `MX-XXXX-XXX` con alfabeto
sin `O`/`0` ni `I`/`1` (se confunden a simple vista) generado con
`crypto.getRandomValues` — nada de contador secuencial ni derivado del
paciente, porque el folio es el único secreto que protege la consulta
pública de la Feature 3 (folio + apellido, sin login). Si fuera
adivinable, cualquiera podría enumerar resultados de otros pacientes.

**Verificación a mano del scoring (`calcularRiesgo`):**
- Caso alto riesgo: glucosa 210 mg/dL (≥200 → +40), antecedente familiar
  (+15), 2 síntomas (+10 c/u → +20), edad 60+ (+15) → score 90 → **alto**
  (umbral ≥40).
- Caso bajo riesgo: glucosa 95 mg/dL (+0), sin antecedente, sin síntomas,
  edad <40 (+0) → score 0 → **bajo**.

**Piso de seguridad — estado tras Feature 2:**
1. Sin llaves en el repo — ✅ (sin cambios).
2. Auth solo operador, `/consulta` sin login — ✅ (sin cambios).
3. RLS en `screenings` — ✅ policies select/insert por `operator_id`,
   sin update/delete.
4. Validación server-side — ✅ glucosa (rango 40–600, entero, rechaza no
   numérico con error visible), síntomas y edad como choices cerrados
   (enum), nombre/apellido con longitud máxima. Rate-limit de la consulta
   pública sigue ⏳ diferido a Feature 3 (esa ruta no existe todavía).
5. Datos simulados etiquetados en pantalla — ✅ aviso "Datos simulados"
   en la pantalla de captura.

**Pendiente de que hagas tú (no puedo correr SQL en tu proyecto desde
aquí):**
- Correr el bloque de Feature 2 de `sql/schema.sql` completo en el SQL
  Editor de Supabase (crea la tabla `screenings` con su RLS).
- Capturar un tamizaje de alto riesgo y uno de bajo riesgo, confirmar que
  cada uno genera un folio distinto y que el nivel de riesgo mostrado
  coincide con el cálculo de arriba.
- Crear una segunda cuenta de Google de prueba y confirmar que no ve los
  tamizajes de la primera cuenta en `/dashboard` (ni entrando directo a la
  URL `/screenings/<id>` del primero — debe dar 404).

**Bug encontrado al verificar Feature 2:** el primer intento de guardar un
tamizaje fallaba con "No se pudo guardar el tamizaje" sin más detalle — el
server action no loggeaba el error real de Supabase, así que era
imposible diagnosticar a distancia. Fix: `console.error` del error
completo en la rama que no es `unique_violation`
(`app/(caf)/screenings/actions.ts`). Con eso se vio el error real:
`PGRST205 — Could not find the table 'public.screenings' in the schema
cache"` — la tabla nunca se había creado porque el bloque de Feature 2 de
`sql/schema.sql` no se había corrido todavía en Supabase. No era un bug
de código, era el paso pendiente de "correr el SQL" — pero sin el log
no había forma de distinguir eso de un bug real.

**Cerrado:** el usuario corrió `sql/schema.sql` en Supabase y verificó
Feature 2 completa:
- Caso alto riesgo (glucosa 210, antecedente sí, 1 síntoma, edad 60+):
  score 80 (40 + 15 + 10 + 15) → **alto**. Coincide con `calcularRiesgo()`.
- Caso bajo riesgo (glucosa 95, sin antecedente, sin síntomas, <40):
  score 0 → **bajo**.
- Folios distintos por captura (`MX-UU74-JPS`, `MX-TYQV-C8E`).
- Segunda cuenta de Google: dashboard vacío, URL directa al
  `/screenings/<id>` de la primera cuenta da 404 — RLS confirmado.

**Primer movimiento de la próxima sesión:** Feature 3 (consulta pública
por folio + apellido vía función `security definer`, rate-limited).

## 2026-09-13 — Feature 3: consulta pública por folio + apellido, rate-limited

**Qué cambió:** función de Postgres `security definer`
`consultar_tamizaje(p_folio, p_apellido)` (`sql/schema.sql`) — la única
puerta pública de lectura a `screenings`. Ninguna policy de RLS permite
select sin `auth.uid() = operator_id`, así que esta función corre con
privilegios propios (bypassa RLS internamente) pero solo devuelve los
campos que el paciente necesita ver, nunca `operator_id` ni teléfono, y
solo si `folio` **y** `apellido` coinciden en el mismo `WHERE` — nunca
una consulta en dos pasos (buscar por folio, comparar apellido después),
porque eso sí permitiría distinguir "folio existe, apellido mal" de
"folio no existe" comparando tiempos de respuesta o resultados
intermedios.

`app/consulta/actions.ts` (`buscarTamizaje`) valida el input con zod
(`lib/consulta.ts`), aplica un rate limit por IP
(`excedeLimite()`, `lib/rateLimit.ts`) antes de llamar al RPC, y devuelve
**el mismo mensaje genérico** ("No encontramos ese resultado...") sin
importar si el folio no existe, si el apellido no coincide, o si la
llamada a Supabase falló por otra razón (ese último caso sí se loggea
server-side con `console.error` — aplicando la lección de la Feature 2:
nunca de nuevo un fallo silencioso sin rastro).

`components/ConsultaForm.tsx` (client) — mismo componente maneja el
formulario y, tras una búsqueda exitosa, el panel de resultado (folio,
nombre, fecha, nivel de riesgo, "Datos simulados"). No hay redirect a
otra URL con el folio/apellido como query param — evita dejarlos en el
historial del navegador o en logs de acceso.

**Rate limiting — limitación conocida, documentada a propósito:** el
limiter (`lib/rateLimit.ts`) vive en memoria del proceso (Map por IP,
ventana de 60s, máx. 5 intentos) — así lo permite explícitamente el
implementation prompt para este alcance, pero en Vercel cada instancia
serverless tiene su propia memoria: no comparte el conteo entre
instancias ni sobrevive un cold start. Para producción real esto
necesitaría una tabla de Supabase o Upstash Redis compartido. Es un
límite de alcance conocido, no un bug escondido — igual que los otros
scope cuts del packet.

**Piso de seguridad — estado tras Feature 3:**
1. Sin llaves en el repo — ✅ (sin cambios).
2. Auth solo operador, `/consulta` sin login — ✅ (sin cambios).
3. RLS en `screenings` — ✅ (sin cambios); la función pública no la
   rodea, es la única puerta explícita.
4. Validación server-side — ✅ completa: glucosa/cuestionario (Feature 2)
   + folio/apellido validados con zod y la consulta pública rate-limited
   (Feature 3).
5. Datos simulados etiquetados en pantalla — ✅ también en el resultado
   de la consulta pública.

**Pendiente de que hagas tú (no puedo correr SQL en tu proyecto desde
aquí):**
- Correr el bloque de Feature 3 de `sql/schema.sql` en el SQL Editor de
  Supabase (crea la función `consultar_tamizaje` y sus grants).
- Probar `/consulta` con el folio + apellido correctos de un tamizaje que
  ya capturaste → debe mostrar el resultado.
- Probar con folio correcto + apellido equivocado, y con un folio
  inventado → ambos deben dar el mismo mensaje genérico de "no
  encontrado".
- Probar el rate limit: 6+ búsquedas seguidas en menos de un minuto →
  la última debe dar "Demasiados intentos".

**Primer movimiento de la próxima sesión:** Feature 4 (explicación en
lenguaje simple generada por LLM + siguiente paso concreto para
resultados de alto riesgo, en la pantalla de resultado de `/consulta`).
