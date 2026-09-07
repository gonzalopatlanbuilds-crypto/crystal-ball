# Proof of Skill

Semana 4 de Crystal Ball. El empleador —no una plataforma, no un badge
genérico de IA— define y pesa sus propios criterios de contratación para un
puesto, y ve el scorecard de un candidato (datos simulados) calculado contra
*esos* pesos, con cualquier resultado dudoso enviado a revisión humana en
vez de auto-aprobado. Ver `docs/PACKET.md` para el spec completo.

## Seguridad — piso no negociable

- **Sin llaves en el código ni en el repo.** Las credenciales de Supabase
  y la `ANTHROPIC_API_KEY` viven en `.env.local` (ignorado por git) en
  desarrollo, y en las Environment Variables del dashboard de Vercel en
  producción.
- **El LLM solo redacta, nunca decide.** La llamada a Claude (Feature 4)
  únicamente genera la frase que explica un resultado borderline; el
  score y el flag de revisión humana son 100% lógica de reglas
  determinística (`lib/scoring.ts`), calculada antes de que el LLM entre
  en juego. La llamada es server-side (server action) — la
  `ANTHROPIC_API_KEY` nunca llega al navegador.
- **Supabase Auth con Google.** Ninguna pantalla ni dato vive detrás de una
  puerta abierta — `proxy.ts` redirige a `/login` a cualquier visita sin
  sesión.
- **Row Level Security en toda tabla con datos de empleador** (`criteria_sets`,
  `candidate_scores` desde la Feature 2 en adelante) — un empleador solo
  puede leer/escribir sus propias filas.
- **Validación server-side en todo formulario** — el peso de un criterio es
  numérico 0–100, las etiquetas tienen longitud máxima, ningún texto libre
  llega a la base de datos sin revisar.
- **Todos los datos de candidatos son inventados**, etiquetados en pantalla
  como "Datos simulados" — nunca nombres o datos personales reales.

## Estado actual: Feature 4 (explicación del borderline redactada por LLM)

Implementado: Feature 1 (auth con Google, shell protegido), Feature 2
(criteria builder — `/criteria/new`, `/criteria/[id]`, `/dashboard`
listando los roles del empleador en sesión), Feature 3 (mockup 2 del
packet: calificar un candidato simulado en
`/criteria/[id]/candidates/new` y ver su scorecard en
`/criteria/[id]/candidates/[candidateId]` — score ponderado, desglose por
criterio, flag automático a revisión humana) y Feature 4: cuando un
scorecard sale flagged, un botón "Generar explicación (IA)" llama
server-side a Claude Haiku 4.5 (`lib/llm.ts`) para redactar, en 2–4
oraciones, por qué ese resultado quedó borderline — **usando únicamente
los motivos que la lógica de reglas ya calculó**, nunca decidiendo el
score ni el flag ni emitiendo un veredicto. El texto sale etiquetado en
pantalla como "Explicación generada por IA — simulada, no es un
veredicto". La llamada es bajo demanda (no se dispara sola al calificar)
para no gastar en scorecards que nadie revisa.

Las tablas `criteria_sets` y `candidate_scores` (`sql/schema.sql`) tienen
RLS desde su primera migración: cada empleador solo puede leer/escribir
sus propias filas (`employer_id = auth.uid()`).

Validación: cada peso (Feature 2) y cada score de candidato (Feature 3)
se valida server-side con zod (`lib/criteria.ts`, `lib/scoring.ts`) —
entero, 0–100, rechaza cualquier valor no numérico con un error visible
junto al campo. El formulario también valida en vivo en el navegador
antes de enviar, pero la validación que cuenta (la que decide si algo
llega a la base de datos) es la del server action.

El score y el flag de revisión humana siguen siendo 100% lógica de
reglas — `calcularScore()` en `lib/scoring.ts`, sin IO, determinística.
El LLM de la Feature 4 nunca la toca; solo redacta una frase a partir de
un resultado que las reglas ya decidieron.

Features 1–3 verificadas de punta a punta: schema corrido en Supabase,
flag de revisión humana confirmado en los tres casos (criterio de peso
alto con score débil, total en banda borderline, todo alto sin flag) y
RLS confirmado en `criteria_sets` y `candidate_scores` con una segunda
cuenta de prueba. Producción en Vercel corriendo con las env vars
correctas, login con Google confirmado igual que en local.

**Pendiente de que hagas tú:** conseguir una `ANTHROPIC_API_KEY` en
[console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
(nunca la pegues en el chat) y ponerla en `.env.local` — ver
`.env.local.example`. Luego calificar un candidato que salga flagged y
probar el botón "Generar explicación (IA)" en su scorecard.

## Desarrollo local

### 1. Crear el proyecto de Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**. Se
   recomienda un proyecto nuevo para este slice (no reutilizar "semestre")
   para no heredar el historial de fallos documentado en w02.
2. Anota el **Project URL** y la **anon/public key** (Project Settings →
   API) — los vas a necesitar en el paso 3.

### 2. Configurar "Sign in with Google" en Supabase

1. En [Google Cloud Console](https://console.cloud.google.com/) → **APIs &
   Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized redirect URIs**: agrega
     `https://<tu-project-ref>.supabase.co/auth/v1/callback` (el
     Project URL de tu proyecto de Supabase, con `/auth/v1/callback` al
     final — lo encuentras también en Supabase → Authentication →
     Providers → Google, ya viene pre-llenado ahí).
   - Guarda el **Client ID** y el **Client Secret**.
2. En el dashboard de Supabase → **Authentication → Providers → Google**:
   actívalo y pega el Client ID / Client Secret del paso anterior.
3. En **Authentication → URL Configuration**, agrega
   `http://localhost:3000/auth/callback` a **Redirect URLs** para poder
   probar en local (y la URL de producción de Vercel cuando la tengas, ver
   más abajo).

### 3. Variables de entorno

```bash
cp .env.local.example .env.local
```

Llena `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los
valores del paso 1. Estas son las llaves "anon/public" — están diseñadas
para exponerse en el navegador; la seguridad real la da RLS, no el secreto
de esta llave. Nunca las pegues en el chat ni en el código.

Llena también `ANTHROPIC_API_KEY` (sin prefijo `NEXT_PUBLIC_`) con una
llave de [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
— a diferencia de las de Supabase, esta sí es un secreto real: nunca debe
llegar al navegador ni exponerse en ningún lado. Sin esto, el botón
"Generar explicación (IA)" del scorecard (Feature 4) falla.

### 4. Instalar y correr

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — te debe redirigir a
`/login`. Inicia sesión con Google y deberías llegar a `/dashboard` vacío.

## Deploy a Vercel (dashboard)

1. Entra a [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Importa este repo de GitHub.
3. Como este es un monorepo, en **Root Directory** selecciona
   `w04-proof-of-skill` (no la raíz del repo).
4. Framework Preset: Next.js (se detecta solo).
5. En **Environment Variables**, agrega `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `ANTHROPIC_API_KEY` con los mismos
   valores de tu `.env.local` — marca `ANTHROPIC_API_KEY` como **Secret**,
   no como Config, ya que a diferencia de la llave anon de Supabase esta
   sí es sensible. No los pegues en el código ni en el chat — solo en el
   panel de Vercel.
6. Deploy. Cuando termine, copia la URL pública y regresa a Supabase →
   Authentication → URL Configuration → **Redirect URLs** para agregar
   `https://<tu-url-de-vercel>/auth/callback`.
7. Prueba el sign-in con Google en la URL pública.
8. Si más adelante cambias las env vars en Vercel, tienes que volver a
   desplegar (Redeploy) para que tomen efecto.

## Verificación manual

- ✅ Sign-in con Google funciona en local (Feature 1).
- ✅ `sql/schema.sql` corrido en Supabase — `criteria_sets` y
  `candidate_scores` con RLS **ON**.
- ✅ Rol con 3+ criterios se guarda y persiste al recargar.
- ✅ Segunda cuenta de Google de prueba no ve los `criteria_sets` ni los
  `candidate_scores` de la primera, ni en `/dashboard` ni entrando
  directo a una URL ajena.
- ✅ Scorecard sale flagged cuando: (a) un criterio con peso ≥25% saca
  score <50, o (b) el total cae entre 45–65 — y sale "sin señales de
  alerta" cuando todos los scores son altos.

Pendiente (producción, no local): probar sign-in con Google en la URL de
Vercel una vez desplegado.

## Alcance — qué NO se construye en este slice

Ver `docs/PACKET.md` → "Scope cut". No se construye: el motor real de
calificación por IA, el lado del estudiante de Proof-of-Skill, el flujo de
entrevistas/oportunidades, funciones de marketplace multi-empleador, pagos,
ni manejo de onboarding/conectividad.
