# First Proof

Semana 9 de Crystal Ball (Business Bending, rol USER). Expediente de
evidencia para personas candidatas a puestos junior de finanzas sin
experiencia formal: resuelven un caso financiero ficticio desde el
teléfono, otra persona lo revisa a ciegas, y el sistema arma un
expediente con el trabajo, el chequeo automático de cálculos, la
explicación, observaciones preparadas por IA (confirmadas o descartadas
por quien revisa), quién revisó y cuándo, y lo que el expediente NO
prueba. Ver `docs/PACKET.md` para el spec completo.

## Seguridad — piso no negociable

- **Sin llaves en el código ni en el repo.** Credenciales de Supabase y
  `ANTHROPIC_API_KEY` en `.env.local` (ignorado por git) en desarrollo, y
  en las Environment Variables de Vercel en producción.
- **Supabase Auth con Google.** Candidato y revisor son dos usuarios
  cualesquiera de la misma organización piloto.
- **Row Level Security** en `orgs`, `profiles`, `submissions` y `reviews`.
  Un candidato ve solo sus propias entregas.
- **Revisión a ciegas:** quien revisa lee solo a través de
  `blind_pending_submissions()` / `blind_submission()` (seudónimo,
  respuestas, explicación, observaciones — nunca nombre, correo ni id). Un
  trigger rechaza cualquier revisión cuyo revisor sea el candidato.
- **La IA nunca decide.** Solo prepara observaciones descriptivas; una
  guardia server-side rechaza calificaciones, aprobado/rechazado, lenguaje
  de contratación y cifras que no estén en el caso (Feature 3).
- **Todos los datos son inventados** y etiquetados "Datos simulados".

## Pruebas

- `npm run test:schema` — prueba mecánica de `sql/schema.sql` en Postgres
  real (PGlite) con stub de Supabase: RLS, trigger, funciones ciegas,
  cascada de borrado y que `anon` no ejecute ningún RPC.
- `bash scripts/probar-anon.sh` — lo mismo para `anon`, pero contra el
  proyecto real de Supabase con la llave pública de `.env.local`.

## Desarrollo local

1. Crea un proyecto en Supabase y corre `sql/schema.sql` completo en el
   SQL Editor.
2. Activa el provider de Google (Authentication → Providers → Google).
3. `cp .env.local.example .env.local` y llena los valores.
   `NEXT_PUBLIC_SUPABASE_URL` es la URL pelona (`https://xxxx.supabase.co`),
   sin `/rest/v1/`.
4. `npm install && npm run dev`.

Historial completo de decisiones en `DECISIONS.md`.
