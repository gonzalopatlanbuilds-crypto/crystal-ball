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

## 2026-09-30 — Decisiones de Feature 1 aprobadas

Aprobadas por ti: (1) la tabla `cases` se queda; (2) la tarifa capturada
es la **tarifa cargada final**, sin multiplicador oculto — el costo tiene
que poder verificarse a mano con lo que está en pantalla, y eso es parte
del punto de este slice. El $253 del mockup 1 no se reproduce a propósito
(sus propios números suman $211.67). Feature 1 pusheada (`53cb548`).

## 2026-09-30 — Feature 2: registro de tiempo por caso + costo real

**Qué cambió:**
- Dashboard: lista de casos del piloto con minutos y costo real por caso,
  y botón "+ Nuevo caso simulado" (solo elige tipo; el número `#0001` lo
  asigna la base).
- `/cases/[id]` (mockup 1): entradas ordenadas por fase (intake →
  triage → paquete de evidencia → seguimiento), cada una con personal,
  tarifa y **la cuenta completa visible** (`25 min × $220/hora ÷ 60 =
  $91.67 MXN`), y la caja "Costo real de este caso". Formulario para
  registrar tiempo; quien registró una entrada puede borrarla (corregir =
  borrar y volver a capturar; no hay edición).
- El botón "Ver modelo de financiamiento" del mockup no está todavía:
  llega con la Feature 3 (la pantalla a la que lleva no existe aún).

**Regla de redondeo (decisión nueva):** cada entrada se redondea a
centavos primero y el total es la suma de esos centavos. Así el total
siempre coincide con sumar a mano los costos que se ven por entrada.
Redondear solo al final podía dar 1 centavo de diferencia (ej. tres
entradas de 1 min a $50/h: se ven $0.83 cada una, total $2.49 — no
$2.50).

**Validación server-side** (`lib/tiempo.ts`, zod, en el server action):
minutos enteros 1–480 por entrada; tarifa cargada $50–$2,000 MXN/h con
máximo 2 decimales; nombre de personal 1–60 caracteres. El formulario
tiene `noValidate` a propósito, para que el error que se ve inline sea
el del servidor y no un tooltip del navegador. Lo capturado se devuelve
en el estado del action para que un error no borre el formulario (React
19 resetea el `<form>` después de cada action). Los mismos límites están
como `check` en la base (Feature 1).

**Bug evitado antes de llegar a pruebas:** la primera versión revisaba
"máximo 2 decimales" con `Math.round(n * 100) === n * 100`, que rechaza
`180.10` porque `180.1 * 100 = 18009.999999999998` en punto flotante. Se
cambió a revisar el texto con regex. Cubierto en la prueba de abajo.

**Verificado (mecánico, sin base de datos):** script de node contra
`lib/costos.ts` y `lib/tiempo.ts` — 23/23 OK:
- Números del mockup 1 calculados a mano: 12 min × $180 = $36.00, 18 ×
  $180 = $54.00, 25 × $220 = $91.67, 10 × $180 = $30.00 → **$211.67, 65
  min**. El código da exactamente eso.
- Rechazos con mensaje en español: minutos `-5`, `0`, `12.5`, `481`,
  vacío, `abc`; tarifa `49.99`, `2000.01`, `-180`, `180.555`, vacía.
  Límites incluidos (1 min, 480 min, $50, $2,000) aceptados.
- `rm -rf .next && npm run build` y `npm run lint` limpios.

**No verificado todavía (necesita tu Supabase):** que el insert pase las
policies reales, el error inline en el navegador, y la aceptación "una
segunda organización no ve los registros de la primera" — hay que
probarlo con dos cuentas de Google en dos organizaciones distintas: la
cuenta B no debe ver los casos de A en el dashboard, y abrir
`/cases/<id-de-un-caso-de-A>` con la cuenta B debe dar 404.

**Primer paso de la siguiente sesión:** con Supabase listo, registrar a
mano el caso del mockup (4 entradas) y confirmar $211.67 en pantalla,
probar un minuto negativo en el navegador, y la prueba de dos
organizaciones. Después, Feature 3.

## 2026-09-30 — Decisiones de Feature 2 aprobadas

Aprobadas por ti: redondeo por entrada (el total = suma de lo visible) y
la corrección del chequeo de decimales. Feature 2 pusheada (`7680f47`).

## 2026-09-30 — Feature 3: comparación de escenarios de financiamiento

**Qué cambió:**
- `/scenarios` (mockup 2): selector de escala 10/100/1,000 (links con
  `?escala=`, renderizado en el servidor), costo mensual proyectado, tabla
  de desglose por tipo de caso y los tres escenarios con su etiqueta.
- Botón "Ver modelo de financiamiento" en el panel y en cada caso.
- `lib/escenarios.ts` (sin imports, probado con node): la proyección, el
  punto de equilibrio y el déficit — la parte de "automatización" del
  Dragon Stack. `lib/modelo.ts` carga los datos con la sesión (RLS) y
  llama esa función; la Feature 4 va a volver a llamarla en el servidor en
  lugar de confiar en números que mande el navegador.
- `lib/etiquetas.ts`: las tres etiquetas en una sola fuente, compartida
  con la Feature 4.

**Cómo se proyecta el costo (decisión nueva):** costo mensual = Σ por tipo
(casos/mes simulados × costo promedio real de los casos de ese tipo con
tiempo registrado). Si un tipo todavía no tiene ningún caso registrado se
usa el promedio de *todos* los casos registrados, y la pantalla lo marca
("estimado: promedio general*"), con la nota de que registrar un caso de
ese tipo reemplaza la estimación. Los casos creados sin tiempo no entran
al promedio (costarían $0 y bajarían el costo falsamente). Sin ningún caso
con tiempo, la pantalla dice que no hay nada que proyectar — no inventa un
costo. Con un solo caso registrado, el resultado es igual que en el
mockup: escala × costo del caso.

**Etiquetas:**
- A — Víctima paga: ingreso $0 (Condición 4), "No confirmado: sin fuente
  de ingreso, cierre en el primer mes".
- B — Patrocinador paga por caso: tarifa **hipotética**, $300 por default
  (la del mockup) y editable en pantalla ($0 < tarifa ≤ $10,000, 2
  decimales; si lo que llega en la URL no es válido se usa el default y se
  muestra un aviso). Muestra ingreso, superávit/déficit y **punto de
  equilibrio** (tarifa mínima por caso que cubre el costo, redondeada
  hacia arriba a centavos). "No confirmado: ningún patrocinador ha
  aceptado este modelo todavía" — y el texto aclara que cambiar la tarifa
  no la vuelve más real.
- C — Sin patrocinador: déficit = costo total − $0, "Confirmado: cálculo
  directo de tiempo de personal registrado". **Matiz agregado debajo:** lo
  confirmado es el costo por caso; el volumen es simulado (y se avisa si
  algún tipo usa el promedio general). El prompt pide "Confirmado" para C
  y lo es en cuanto al costo, pero sin esta línea la tarjeta verde podía
  leerse como "el déficit a 1,000 casos está confirmado", que no es cierto
  — justo lo que la persona del Layer 1 (directora escéptica) atacaría.

**Verificado (mecánico, sin base de datos):** node contra
`lib/escenarios.ts`, 29/29 OK:
- Solo el caso del mockup ($211.67): a 10/100/1,000 casos el costo es
  $2,116.70 / $21,167.00 / $211,670.00; déficit sin patrocinio = total −
  0 en las tres; tarifa $300 → superávit $883.30 / $8,833.00 / $88,330.00;
  equilibrio $211.67.
- Varios tipos a mano: toma de cuenta (211.67 + 150.00)/2 = 180.835 →
  $180.84; suplantación $300.00; colecta falsa sin casos → promedio
  general (211.67 + 150 + 300)/3 = 220.556 → $220.56. A 100:
  50×180.84 + 30×300 + 20×220.56 = 9,042 + 9,000 + 4,411.20 =
  **$22,453.20**; equilibrio $224.54 (hacia arriba). El código da
  exactamente eso. Un caso sin tiempo no entra.
- Sin casos con tiempo → `null` (no inventa costo).
- `rm -rf .next && npm run build` y `npm run lint` limpios.

**No verificado:** `leerParametros()` (vive en un módulo `server-only`,
no se puede importar desde node directo) — probarlo en el navegador con
`/scenarios?escala=50` y `?tarifa=-1`, que deben mostrar el aviso y usar
el default. Y nada contra Supabase real todavía.

**Primer paso de la siguiente sesión:** con Supabase listo, abrir
`/scenarios` con el caso del mockup registrado, cambiar entre 10/100/1,000
y comparar con los números de arriba. Después, Feature 4.

## 2026-09-30 — Primer deploy en Vercel (deploy 1)

**Qué pasó:** no te dejaba desplegar el proyecto. Al revisar los estados
que Vercel publica en GitHub, cada push desplegaba seis proyectos
(w03–w07 y `crystal-ball`) pero ningún `w08-costoreal`. Con el push de
`4f06a48` apareció por primera vez "Vercel – w08-costoreal" y terminó en
**success**. No vi el error original, así que la causa exacta **no está
confirmada**; lo más probable es que el proyecto se conectó después del
último push y no había ningún commit nuevo que lo disparara.

**URL de producción:** `https://w08-costoreal-gonzabuilds.vercel.app`.
Ojo: `w08-costoreal.vercel.app` da 404. Ese subdominio corto no
quedó asignado a este proyecto, y a diferencia de w07 (`w07-miruta.vercel.app`)
no hay que usarlo.

**Verificado desde afuera con curl, sin ninguna sesión:**
- `/login` → 200 y muestra "CostoReal" + "Datos simulados". No aparece
  el muro de Vercel Authentication, o sea que **Deployment Protection está
  apagado** en esta URL.
- `/`, `/dashboard` y `/scenarios` → 307 a `/login`, así que sin sesión
  se redirige a login.

**Falta:** la callback de producción en Supabase (Redirect URLs:
`https://w08-costoreal-gonzabuilds.vercel.app/auth/callback`), el login
real con Google en producción y confirmar en incógnito desde tu navegador.

## 2026-09-30 — Bug: el primer clic en "Iniciar sesión con Google" regresa a /login

**Síntoma (reportado por ti, en producción):** el primer intento de login
termina en `/login`, y el segundo sí entra.

**Lo que se confirmó con curl contra producción:** cualquier falla del
login terminaba en `/login` **sin mensaje en pantalla y sin nada en los
logs de Vercel**. Un código inválido (`/auth/callback?code=falso` →
`/login?error=auth`), un error devuelto por Supabase (`?error=...` →
`/login?error=auth`) y un `?code` que llega a la raíz en vez de al
callback (`/?code=abc` → `/login`) se veían idénticos para la persona. El
callback descartaba el `error` de `exchangeCodeForSession` sin
registrarlo. Esto es lo que hacía imposible diagnosticar el bug, y es un
bug en sí mismo.

**Cambio:**
- `app/auth/callback/route.ts`: cada salida de error deja un
  `console.error` distinto en los logs de Vercel. Registra el origen, el
  error de Supabase si vino en la URL (`error`, `error_code`,
  `error_description`) y el status/código/mensaje de
  `exchangeCodeForSession`. También registra **si la cookie
  `…-code-verifier` de PKCE estaba presente**, solo los nombres de las
  cookies y nunca sus valores.
- `app/page.tsx`: si llega un `?code` a la raíz (Supabase lo manda a su
  "Site URL" cuando el `redirectTo` no está en la lista de Redirect URLs),
  se reenvía a `/auth/callback` con un `console.warn`, en vez de perderse.
- `app/login/page.tsx`: con `?error=auth` muestra "No se pudo completar el
  inicio de sesión. Intenta de nuevo." (`useSearchParams` dentro de
  `Suspense`, así `/login` sigue siendo estática).

**Verificado localmente con `next start`:** `?error=…` → `/login?error=auth`
con el log "Supabase devolvió error"; sin `code` → `/login?error=auth` con
el log "llegó sin ?code"; `/?code=abc123` → `/auth/callback?code=abc123`
con el warn. `rm -rf .next && npm run build` y `npm run lint` limpios.

**Causa raíz: NO confirmada todavía.** Hipótesis principal, que
coincide exactamente con "falla el primero, funciona el segundo": se
abrió el login desde **una URL de Vercel distinta** a la registrada en
Supabase. Por ejemplo, la URL del deployment
(`w08-costoreal-eq6ztyfid-gonzabuilds.vercel.app`, la que abre el botón
"Visit" de un deployment) en lugar de
`w08-costoreal-gonzabuilds.vercel.app`. Esa URL de callback no está en la
lista, así que Supabase manda el código a su Site URL. PKCE guarda el
`code_verifier` en una cookie del dominio donde se hizo clic, y en el
otro dominio no existe, así que el intercambio falla. En el segundo clic
ya estás en el dominio correcto, cookie y callback coinciden, y entra. Si
es eso, el log nuevo va a mostrar `hayVerifier: false` con un `origin`
distinto a la URL donde hiciste clic.

**Nota lateral:** las tres variables de `.env.local` están vacías
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
`ANTHROPIC_API_KEY`), así que el login local no puede funcionar hasta
llenarlas. En producción no afecta porque Vercel tiene las suyas.

**Siguiente paso:** desplegar esto, reproducir el bug en incógnito
anotando **en qué URL exacta** se hace el primer clic, y leer el log de
`auth/callback` en Vercel (Logs, filtrar por `auth/callback`).

## 2026-09-30 — Feature 5: bug de login encontrado y arreglado (cierre)

**Bug (encontrado por ti en producción):** el primer clic en "Iniciar
sesión con Google" regresaba a `/login`; el segundo sí entraba.

**Arreglo:** `8d1a5c0` (desplegado, deploy de Vercel en success).
**Confirmado por ti en producción:** después de ese deploy el login
funciona al primer clic.

**Qué se diagnosticó y con qué evidencia:** con **curl contra
producción**, no con logs de Vercel (no tengo acceso a ellos desde aquí y
no los he visto). Tres fallas distintas (código inválido, `?error` de
Supabase y `?code` en la raíz) terminaban todas en `/login` sin mensaje y
sin log, y el `?code` que llegaba a `/` se perdía. Después del deploy, en
producción: `/?code=abc` → `/auth/callback?code=abc` y
`/auth/callback` sin código → `/login?error=auth`.

**Causa raíz: probable, NO confirmada con logs.** El único cambio de
`8d1a5c0` que afecta un login *exitoso* es el reenvío de `?code` desde `/`
hacia `/auth/callback`. Si eso es lo que lo arregló, el código de Google
estaba llegando a la raíz y no al callback. Eso pasa cuando el
`redirectTo` no está en las Redirect URLs de Supabase y Supabase usa su
Site URL. La hipótesis anterior (dos dominios de Vercel distintos) **no
cuadra** con que el arreglo funcione: en ese caso la cookie de PKCE
seguiría en el otro dominio y el reenvío no la traería. Tampoco se puede
descartar que la configuración de Supabase haya cambiado al mismo tiempo.
**Cómo cerrarlo con evidencia:** en Vercel → Logs, buscar
`Home: llegó ?code a la raíz`. Si aparece en los logins recientes, el
reenvío es el que te está salvando y hay que agregar
`https://w08-costoreal-gonzabuilds.vercel.app/auth/callback` a Redirect
URLs de Supabase, para que el código llegue directo al callback. Si no
aparece, la causa fue otra (probablemente un cambio de configuración) y
se anota aquí.

**Pendiente de Feature 5:** la pasada mecánica completa del PACKET
(tiempo en 4 fases vs. cálculo a mano, cambio de escala, etiquetas y
resumen de IA) todavía no se ha hecho contra la base real, y la Feature 4
aún no existe. Esta entrada cubre el requisito "al menos un bug real
encontrado y arreglado, con redeploy". No sustituye el resto de la
pasada.
