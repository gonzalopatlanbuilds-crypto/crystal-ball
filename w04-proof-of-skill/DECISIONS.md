# Decisiones — Proof of Skill (Week 4)

## 2026-09-06 — Feature 1: auth + shell vacío

**Qué cambió:** scaffold de Next.js 16 + Tailwind v4 + TS (mismo patrón que
w02/w03), y el flujo completo de Supabase Auth con Google usando
`@supabase/ssr`: `proxy.ts` (convención actual de Next 16 — `middleware.ts`
está deprecado) protege todas las rutas salvo `/login` y `/auth/callback`,
redirigiendo a `/login` si no hay sesión y a `/dashboard` si ya la hay.
`app/dashboard/page.tsx` es el shell vacío autenticado. Commit `f593713`,
pusheado a `origin/main`.

**Por qué:** el packet (Condición 1: confianza del empleador desde el día
uno) exige que Row Level Security separe de verdad los datos de cada
empleador — eso solo es verificable con autenticación real, no con el
fallback de `localStorage` que usamos en w02/w03 cuando Supabase estaba
caído. Aquí Supabase Auth + RLS no son un detalle técnico, son el mecanismo
que la Feature 2 va a probar (que un segundo empleador no vea los datos del
primero).

**Cerrado:** el usuario creó el proyecto de Supabase y el cliente OAuth de
Google, y confirmó sign-in real end-to-end en local (selecciona cuenta →
confirma correo → aterriza en `/dashboard` con su email). Feature 1
verificada.

## 2026-09-06 — Alcance de Feature 4: el LLM solo redacta, nunca decide

**Qué cambió (decisión de alcance, sin código todavía):** se reincorpora la
fila "AI layer" del packet, pero acotada: una llamada a un LLM en Feature 4
que **únicamente redacta el texto explicando por qué un criterio quedó
borderline**. El score ponderado y el umbral que decide si algo se marca
"Flagged for human review" siguen siendo 100% lógica de reglas pura (sin
IO, determinística, testeable a mano) — el LLM nunca calcula el score ni
decide el flag, solo genera la frase que se le muestra al empleador junto
al resultado, etiquetada en pantalla como "AI-generated, simulated".

**Por qué:** así lo pidió el usuario explícitamente, para no romper el
piso de seguridad ("no AI grading engine") ni el Condition 2 del Blueprint
(ningún resultado borderline se auto-certifica) — la IA describe, no
decide.

**Implicación de seguridad a resolver cuando se construya:** esto agrega
una llamada de servidor a una API de LLM, o sea una nueva credencial
(API key) que debe vivir solo en variables de entorno de Vercel — nunca en
el cliente ni en el repo — y la llamada debe hacerse server-side (route
handler o server action), no desde el navegador.

## 2026-09-06 — Feature 2: criteria builder + RLS

**Qué cambió:** tabla `criteria_sets` (`sql/schema.sql`) con RLS —
policies separadas para select/insert/update/delete, todas comparando
`auth.uid() = employer_id`, más un CHECK a nivel de base de datos
(`criteria` debe ser un array jsonb de al menos 3 elementos) como respaldo,
no como la validación principal. Pantallas `/criteria/new` y
`/criteria/[id]` (mockup 1 del packet) construidas sobre un componente
compartido `CriteriaBuilder` — permite agregar/editar/quitar criterios
antes de guardar — y server actions (`createCriteriaSet`,
`updateCriteriaSet`) que validan con zod (`lib/criteria.ts`) antes de
tocar la base de datos: peso entero 0–100, etiqueta máximo 80 caracteres,
mínimo 3 criterios. `/dashboard` ahora lista los roles guardados del
empleador en sesión.

**Por qué el peso es un input de texto y no solo un slider:** la Feature 2
pide explícitamente que un peso no numérico dispare un error visible — un
`<input type="number">` nativo bloquea letras en silencio (nunca dispara
ese error), así que el campo de peso es texto libre validado a mano
(cliente y servidor), con un slider al lado como atajo visual sincronizado
al mismo estado.

**Decisión de esquema:** los criterios viven como un array `jsonb` dentro
de la fila `criteria_sets`, no en una tabla aparte — así lo describe la
tabla de arquitectura del packet (solo `criteria_sets` y
`candidate_scores`), y no hay necesidad de un criterio con vida propia
fuera de su set en este slice.

**Pendiente de que hagas tú (no puedo correr SQL en tu proyecto desde
aquí):**
- Correr `sql/schema.sql` completo en el SQL Editor de Supabase.
- Crear un rol con 3+ criterios y confirmar que persiste al recargar.
- Crear una segunda cuenta de Google de prueba y confirmar que no ve los
  `criteria_sets` de la primera (ni en `/dashboard` ni entrando directo a
  la URL de edición — debe dar 404).

**Primer movimiento de la próxima sesión:** una vez confirmes RLS con las
dos cuentas de prueba, seguimos con Feature 3 (datos simulados de
candidatos + scoring ponderado contra un `criteria_sets`).

## 2026-09-06 — Feature 3: candidatos simulados + score ponderado + flag automático

**Qué cambió:** tabla `candidate_scores` (`sql/schema.sql`) con RLS
idéntico en forma al de `criteria_sets` (policies select/insert/delete
comparando `auth.uid() = employer_id`; sin policy de update — un scorecard
ya emitido no se edita, se vuelve a calificar). Cada fila guarda un
snapshot `jsonb` de `{ label, weight, score }` por criterio en vez de
apoyarse en un join en vivo a `criteria_sets.criteria`: si el empleador
edita los pesos del rol después, el scorecard ya emitido no cambia
retroactivamente.

Pantalla nueva `/criteria/[id]/candidates/new` (componente
`CandidateScoreForm`) para calificar un candidato simulado con un score
0–100 por criterio — mismo patrón que el peso en `CriteriaBuilder`: input
de texto validado (no `<input type="number">`, que traga letras en
silencio) con slider sincronizado como atajo visual. La etiqueta que
llama a esto es explícita en pantalla: "Datos simulados — este flujo no
evalúa habilidades reales de nadie."

`lib/scoring.ts` tiene `calcularScore()`: lógica de reglas pura (sin IO,
determinística, testeable a mano) que calcula el score ponderado total y
decide el flag de revisión humana con dos reglas explícitas:
1. Score total en banda borderline (45–65) → flag.
2. Cualquier criterio con peso ≥25% y score <50 → flag, aunque el total
   salga bien — un criterio de alto peso con evidencia débil no se debe
   promediar en silencio contra un total decente.

Pantalla `/criteria/[id]/candidates/[candidateId]` (mockup 2 del packet)
muestra el score total, el banner de flag ("Marcado para revisión
humana" / "Sin señales de alerta en las reglas automáticas" — nunca
"aprobado" ni "garantizado", mismo principio de w03: ningún resultado se
presenta como un veredicto), el desglose por criterio, y los motivos
generados por las reglas de arriba. La página de edición del rol
(`/criteria/[id]`) ahora lista los candidatos ya calificados y enlaza a
"+ Calificar candidato".

**Por qué el server recalcula el peso, no confía en el formulario:** la
server action `submitCandidateScore` recibe solo los scores del cliente;
la etiqueta y el peso de cada criterio se leen de `criteria_sets` en el
propio server antes de armar el snapshot. Si confiara en un peso enviado
por el formulario, un cliente podría inflar su propio score inflando el
peso del criterio donde sacó mejor nota.

**Por qué el score y el flag no llaman a ningún LLM:** así quedó decidido
en la entrada anterior de este documento — la Feature 4 (todavía sin
construir) solo va a redactar la frase que explica un `motivo` que
`calcularScore()` ya generó aquí; nunca va a tocar el número ni el
booleano del flag.

**Verificado:** `npx eslint`, `npx tsc --noEmit` y `npm run build` pasan
limpios con las rutas nuevas (`/criteria/[id]/candidates/new` y
`/criteria/[id]/candidates/[candidateId]`) registradas.

**Cerrado:** el usuario corrió `sql/schema.sql` (con el fix de
idempotencia de la entrada siguiente) en Supabase y confirmó a mano los
tres casos de la regla de flag: criterio de peso alto (≥25%) con score
bajo (<50) → flagged con el motivo explicado en pantalla; todo alto →
"sin señales de alerta" con la nota de "reglas determinísticas, sin caja
negra"; y que la segunda cuenta de prueba no ve los `candidate_scores` de
la primera. Feature 3 verificada de punta a punta.

**Primer movimiento de la próxima sesión:** seguimos con la Feature 4 (la
llamada a LLM que solo redacta la explicación del borderline, acotada
como quedó decidido más arriba en este documento) — o, si se prefiere,
saltamos a correr el persona test del packet con las Features 1–3 ya
completas.

## 2026-09-06 — Fix: sql/schema.sql no era realmente idempotente

**Qué cambió:** al agregar la sección de Feature 3 al mismo archivo y
volver a correrlo completo en Supabase, `create policy` truena con
`policy "..." already exists` — a diferencia de `create table if not
exists`, Postgres no tiene un `IF NOT EXISTS` nativo para `create
policy`. Se agregó un `drop policy if exists "<nombre>" on <tabla>;`
justo antes de cada `create policy`, en ambas tablas.

**Por qué:** el README afirmaba que el archivo era idempotente ("puedes
volver a correr todo el archivo aunque `criteria_sets` ya exista") y no
lo era — el usuario lo confirmó al correrlo y recibir el error `42710`.
Con el `drop policy if exists`, correr el archivo completo de nuevo deja
las policies con la misma definición, sin error, sin importar cuántas
veces se corra ni en qué punto del historial de features esté la base.

## 2026-09-06 — Feature 4: explicación del borderline redactada por LLM

**Qué cambió:** `lib/llm.ts` tiene `redactarExplicacionBorderline()`: una
llamada server-only (`import "server-only"` fuerza el error de build si
algo la importa desde un componente cliente) a la API de Anthropic,
modelo `claude-haiku-4-5`, sin streaming ni thinking — la tarea es
redactar 2–4 oraciones a partir de datos ya calculados, no razonar. El
system prompt es explícito: usar únicamente los datos que se le pasan
(rol, score total, `motivos` y desglose que ya salieron de
`calcularScore()`), nunca inventar un criterio o número, y nunca emitir
un veredicto ("bueno", "recomendado", "avanzar").

La server action `generateBorderlineExplanation` (en
`candidates/actions.ts`) recibe solo un `candidateScoreId`: relee la fila
de `candidate_scores` (RLS de por medio — no puede leer un candidato
ajeno), **recalcula el score y el flag con `calcularScore()` otra vez en
vez de confiar en nada que mande el cliente**, y se niega a llamar al LLM
si `resultado.flagged` es `false` — este endpoint solo existe para
explicar un borderline, no para opinar sobre cualquier resultado.

En pantalla, el botón "✨ Generar explicación (IA)"
(`components/BorderlineExplanation.tsx`) solo aparece dentro del banner
de "Marcado para revisión humana" del scorecard — nunca se llama sola al
guardar un candidato. La respuesta se muestra en una caja separada,
etiquetada "Explicación generada por IA — simulada, no es un veredicto".

**Por qué bajo demanda y no automático al calificar:** decisión explícita
del usuario — cada llamada al LLM cuesta dinero real; que solo se dispare
si el empleador la pide, viendo ya un resultado flagged, evita gastar en
scorecards que nadie revisa y no agrega latencia al guardar un candidato.

**Por qué Haiku 4.5 y no un modelo más grande:** decisión explícita del
usuario — la tarea es reformular en lenguaje natural motivos que las
reglas ya calcularon (sin razonamiento propio), así que el modelo más
barato de la familia actual rinde igual por una fracción del costo.

**Implicación de seguridad resuelta:** `ANTHROPIC_API_KEY` vive solo en
`.env.local` (gitignored) en desarrollo y como env var **secreta** (no
`NEXT_PUBLIC_`) en Vercel — nunca en el cliente ni en el repo. La llamada
ocurre 100% server-side (server action), nunca desde el navegador.

**Verificado:** `npx eslint`, `npx tsc --noEmit` y `npm run build` pasan
limpios. La llamada real al LLM (con una `ANTHROPIC_API_KEY` de verdad)
queda pendiente de que el usuario la pruebe — ver README.

**Pendiente de que hagas tú:**
- Conseguir una API key en console.anthropic.com/settings/keys y ponerla
  en `.env.local` como `ANTHROPIC_API_KEY` (sin prefijo `NEXT_PUBLIC_`).
- Agregar la misma key a Vercel Production como **Secret** (no Config) —
  avísame cuando la tengas y la agrego por CLI sin que la pegues en el
  chat, igual que con las de Supabase.
- Calificar un candidato que salga flagged, entrar a su scorecard, tocar
  "Generar explicación (IA)" y confirmar que el texto: (a) no inventa
  ningún criterio ni número que no esté en el desglose, (b) no dice que
  el candidato "debe avanzar" ni usa lenguaje de veredicto.
