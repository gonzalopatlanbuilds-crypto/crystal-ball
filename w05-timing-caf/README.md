# Folio CAF

Semana 5 de Crystal Ball. Un resultado de tamizaje capturado en un CAF
(clínica adyacente a farmacia) se vuelve un registro portátil, propiedad
del paciente, que funciona sin smartphone, sin cuenta y sin identidad
digital previa — pensado desde el día uno para poder entrar al sistema de
salud público si llega la interoperabilidad (NOM-024). Ver
`docs/PACKET.md` para el spec completo.

## Seguridad — piso no negociable

- **Sin llaves en el código ni en el repo.** Las credenciales de Supabase
  y la `ANTHROPIC_API_KEY` viven en `.env.local` (ignorado por git) en
  desarrollo, y en las Environment Variables del dashboard de Vercel en
  producción.
- **Supabase Auth con Google solo para el operador del CAF.** La consulta
  pública del paciente (`/consulta`) nunca requiere login, cuenta, ni
  ninguna app — vive fuera del grupo de rutas protegido por auth desde el
  primer commit, para no envolverla por accidente.
- **Row Level Security en `screenings`** (desde la Feature 2): un operador
  de CAF solo puede ver los tamizajes que él mismo capturó.
- **Validación server-side en todo formulario** (desde la Feature 2): el
  valor de glucosa es numérico en un rango plausible, las respuestas del
  cuestionario son opciones cerradas, y la consulta pública por
  folio+apellido está limitada en tasa para evitar enumeración de folios.
- **Todos los datos de pacientes son inventados**, etiquetados en pantalla
  como "Datos simulados" — nunca nombres o datos personales reales.

## Estado actual: Feature 1 (auth + shell vacío)

Implementado: Supabase Auth con Google para operadores de CAF,
`app/(caf)/layout.tsx` redirige a `/login` si no hay sesión,
`app/(caf)/dashboard/page.tsx` es el shell vacío autenticado, y
`/consulta` (mockup 2 del packet, sin lógica todavía) carga público desde
el primer commit — nunca detrás del auth check.

**Pendiente de que hagas tú (no puedo crear el proyecto de Supabase ni el
cliente OAuth desde aquí):**
- Crear un proyecto de Supabase para esta semana (o reusar uno existente
  si así lo decides) y un cliente OAuth de Google.
- Copiar `.env.local.example` a `.env.local` y llenar
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Confirmar sign-in real end-to-end en local: `/login` → Google → aterrizas
  en `/dashboard` con tu email visible en el header.
- Confirmar que `/consulta` carga sin sesión iniciada (en una ventana de
  incógnito, por ejemplo).

## Desarrollo local

```bash
npm install
npm run dev
```

## Deploy

Proyecto pensado para Vercel (free tier). Variables de entorno
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY`) se configuran en el dashboard de Vercel, nunca en el
repo.
