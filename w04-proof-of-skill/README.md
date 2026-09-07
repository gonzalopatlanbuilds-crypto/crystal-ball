# Proof of Skill

Semana 4 de Crystal Ball. El empleador —no una plataforma, no un badge
genérico de IA— define y pesa sus propios criterios de contratación para un
puesto, y ve el scorecard de un candidato (datos simulados) calculado contra
*esos* pesos, con cualquier resultado dudoso enviado a revisión humana en
vez de auto-aprobado. Ver `docs/PACKET.md` para el spec completo.

## Seguridad — piso no negociable

- **Sin llaves en el código ni en el repo.** Las credenciales de Supabase
  viven en `.env.local` (ignorado por git) en desarrollo, y en las
  Environment Variables del dashboard de Vercel en producción.
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

## Estado actual: Feature 3 (scoring ponderado + flag de revisión humana)

Implementado: Feature 1 (auth con Google, shell protegido), Feature 2
(criteria builder — `/criteria/new`, `/criteria/[id]`, `/dashboard`
listando los roles del empleador en sesión) y Feature 3 (mockup 2 del
packet): desde `/criteria/[id]` se califica un candidato simulado con un
score 0–100 por criterio (`/criteria/[id]/candidates/new`) y se ve el
scorecard resultante (`/criteria/[id]/candidates/[candidateId]`) — score
ponderado total, desglose por criterio y flag automático a revisión
humana. Las tablas `criteria_sets` y `candidate_scores`
(`sql/schema.sql`) tienen RLS desde su primera migración: cada empleador
solo puede leer/escribir sus propias filas (`employer_id = auth.uid()`).

Validación: cada peso (Feature 2) y cada score de candidato (Feature 3)
se valida server-side con zod (`lib/criteria.ts`, `lib/scoring.ts`) —
entero, 0–100, rechaza cualquier valor no numérico con un error visible
junto al campo. El formulario también valida en vivo en el navegador
antes de enviar, pero la validación que cuenta (la que decide si algo
llega a la base de datos) es la del server action.

El score y el flag de revisión humana son 100% lógica de reglas —
`calcularScore()` en `lib/scoring.ts`, sin IO, determinística — no hay
ninguna llamada a IA todavía. Eso llega acotado en la Feature 4 (ver
`DECISIONS.md`): un LLM que solo redacta la explicación del borderline,
nunca decide el número ni el flag.

**Pendiente de que corras tú (no puedo ejecutar SQL en tu proyecto desde
aquí):** el `sql/schema.sql` actualizado agrega `candidate_scores`. Ve a
tu proyecto de Supabase → **SQL Editor → New query**, pega el contenido
completo de `sql/schema.sql` (es idempotente — puedes volver a correr
todo el archivo aunque `criteria_sets` ya exista) y ejecútalo. Sin esto,
calificar un candidato falla.

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
5. En **Environment Variables**, agrega `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los mismos valores de tu
   `.env.local`. No los pegues en el código ni en el chat — solo en el
   panel de Vercel.
6. Deploy. Cuando termine, copia la URL pública y regresa a Supabase →
   Authentication → URL Configuration → **Redirect URLs** para agregar
   `https://<tu-url-de-vercel>/auth/callback`.
7. Prueba el sign-in con Google en la URL pública.
8. Si más adelante cambias las env vars en Vercel, tienes que volver a
   desplegar (Redeploy) para que tomen efecto.

## Verificación manual pendiente (no puedo hacerla desde aquí)

- Confirmar que el sign-in con Google funciona en local y en producción
  (✅ ya confirmado en local para Feature 1).
- Correr `sql/schema.sql` en el SQL Editor de Supabase y confirmar en el
  Table Editor que `criteria_sets` y `candidate_scores` quedaron con RLS
  **ON** (✅ ya confirmado para `criteria_sets`).
- Crear un rol con 3+ criterios, guardar, recargar la página y confirmar
  que los datos siguen ahí (✅ ya confirmado).
- Crear una segunda cuenta de Google de prueba y confirmar que **no** ve
  los `criteria_sets` de la primera, ni en `/dashboard` ni entrando
  directo a `/criteria/<id-del-primer-rol>` (debe dar 404) (✅ ya
  confirmado).
- Calificar un candidato simulado contra un rol y confirmar que el
  scorecard sale flagged cuando: (a) un criterio con peso ≥25% saca
  score <50, o (b) el total cae entre 45–65 — y que sale sin flag cuando
  todos los scores son altos.
- Confirmar que la segunda cuenta de prueba tampoco ve los
  `candidate_scores` de la primera.

## Alcance — qué NO se construye en este slice

Ver `docs/PACKET.md` → "Scope cut". No se construye: el motor real de
calificación por IA, el lado del estudiante de Proof-of-Skill, el flujo de
entrevistas/oportunidades, funciones de marketplace multi-empleador, pagos,
ni manejo de onboarding/conectividad.
