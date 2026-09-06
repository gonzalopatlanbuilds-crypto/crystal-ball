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

## Estado actual: Feature 1 (auth + shell vacío)

Implementado: scaffold de Next.js, Supabase Auth con Google vía
`@supabase/ssr`, `proxy.ts` protegiendo todas las rutas salvo `/login` y
`/auth/callback`, y un dashboard vacío en `/dashboard`.

Sin tablas propias todavía — `sql/schema.sql` se va a llenar en la Feature 2
(`criteria_sets`) y Feature 3 (`candidate_scores`), cada una con RLS desde
su primera migración.

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

- Confirmar que el sign-in con Google funciona en local y en producción.
- Confirmar en el Table Editor de Supabase que RLS está ON en cada tabla
  antes de agregar datos reales de prueba (desde la Feature 2).
- Crear una segunda cuenta de Google de prueba para verificar en la
  Feature 2 que un empleador no puede ver los `criteria_sets` de otro.

## Alcance — qué NO se construye en este slice

Ver `docs/PACKET.md` → "Scope cut". No se construye: el motor real de
calificación por IA, el lado del estudiante de Proof-of-Skill, el flujo de
entrevistas/oportunidades, funciones de marketplace multi-empleador, pagos,
ni manejo de onboarding/conectividad.
