# Decisiones — CostoReal (Week 8)

## 2026-09-30 — Feature 1: auth + shell vacío + volumen de casos sembrado

**Qué cambió:** scaffold de Next.js 16 + Tailwind v4 + TS, copiando la
base probada de w06-evidenciapc (`proxy.ts`, `lib/supabase/*`, callback y
signout de Google, `orgs`/`profiles`/`my_org_id()`, onboarding con
crear-organización / unirme-con-código). Dashboard autenticado vacío que
muestra la distribución simulada de `case_volume_scenarios`.

**Por qué el patrón de organizaciones de w06 y no el `auth.uid()`
directo de w07:** el packet pide RLS "scoped to the pilot organization" y
dos roles (staff que registra tiempo, coordinación que revisa escenarios)
que tienen que ver los mismos casos. "Mis propios registros" no alcanza;
"mi misma organización piloto" sí. Además la aceptación de la Feature 2
pide explícitamente que una *segunda organización* no vea los registros
de la primera.

**`case_volume_scenarios` se siembra por organización**, dentro de
`create_org()`, en vez de ser una tabla global: el piso de seguridad pide
RLS scoped a la org también para esta tabla. Distribución inventada:
50% toma de cuenta / 30% suplantación / 20% colecta falsa, a 10, 100 y
1,000 casos/mes. Columna `is_simulated` con `check (is_simulated)` para
que no exista ningún camino a volumen "real". `sembrar_volumen_simulado()`
se revoca explícitamente de `anon`/`authenticated` (no solo de `public`)
porque Supabase les da EXECUTE por default privileges a funciones nuevas.

**`cases` agregada aunque el packet no la nombra:** la tabla de
arquitectura solo lista `case_time_logs` y `case_volume_scenarios`, pero
el mockup 1 registra tiempo "por caso" con tipo (Caso #0083 — Toma de
cuenta), y el tipo es lo que conecta el costo registrado con la
distribución de volumen. Un caso es solo número + tipo: sin nombre,
contacto ni detalle (SHADOW CLAUSE).

**Piso de seguridad — estado tras Feature 1:**
1. Sin llaves en el repo — ✅ (`.env*` ignorado, `.env.local.example`
   vacío).
2. Google sign-in — ✅ en código; ⏳ sin probar hasta que exista el
   proyecto de Supabase.
3. RLS en `case_time_logs` y `case_volume_scenarios` — ✅ en
   `sql/schema.sql` desde este commit (también `cases`, `orgs`,
   `profiles`). `case_time_logs` se crea ya aunque su pantalla llega en
   la Feature 2, para que el RLS esté antes que la feature. ⏳ Sin
   verificar contra una base real todavía.
4. Validación server-side — ✅ a nivel base (`check` de tarifa 50–2,000
   MXN/h y minutos 1–480 en `case_time_logs`); ⏳ la validación del
   server action con error inline llega con el formulario (Feature 2).
5. "Datos simulados" en pantalla — ✅ login, onboarding, dashboard.
6. Regla de integridad del resumen de IA — ⏳ diferida a la Feature 4 (no
   existe llamada al LLM todavía). No se omite: se implementa y se prueba
   ahí.

**Algo que noté en el mockup 1 y hay que decidir antes de la Feature 2:**
el mockup dice "Costo real de este caso: $253 MXN" con 12+18+10 min a
$180/h y 25 min a $220/h. Esa suma da **$211.67**, no $253 ($120.00 +
$91.67). $253 sale solo si se aplica un factor de carga de ~1.195 encima
de la tarifa mostrada ("incluye prestaciones estimadas"). Decisión por
defecto: la tarifa que se captura **ya es la tarifa cargada** (el packet
dice "time × loaded rate"), sin multiplicador oculto — así el costo se
puede verificar a mano con los números que están en pantalla. El número
del mockup no se va a reproducir.

**Verificado:** `rm -rf .next && npm run build` limpio, `npm run lint`
limpio. **No verificado:** nada contra Supabase/Google/Vercel real.

**Primer paso de la siguiente sesión:** que tú configures Supabase +
Google + Vercel (abajo), probar login real e incógnito, y después Feature
2.

**Pendiente de que hagas tú:**
1. Crear un proyecto nuevo en Supabase y correr `sql/schema.sql` completo
   en el SQL Editor.
2. Authentication → Providers → Google, con un cliente OAuth de Google
   Cloud Console. En Google Cloud, el redirect URI autorizado es el de
   **Supabase** (`https://<proyecto>.supabase.co/auth/v1/callback`) — el
   bug de w07 fue exactamente ese URI mal puesto.
3. En Supabase → Authentication → URL Configuration: agregar
   `http://localhost:3000/auth/callback` y, cuando exista,
   `https://<tu-url-de-vercel>/auth/callback` a Redirect URLs.
4. `cp .env.local.example .env.local`, llenar los valores de Supabase,
   `npm run dev`, probar login y que el dashboard muestre la tabla de
   volumen simulado (5/3/2, 50/30/20, 500/300/200).
5. Proyecto en Vercel con **Root Directory = `w08-costoreal`**, las tres
   variables de entorno, y **Deployment Protection apagado** (Settings →
   Deployment Protection → Vercel Authentication: Disabled).
