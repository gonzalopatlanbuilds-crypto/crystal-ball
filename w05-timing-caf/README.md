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

## Estado actual: Feature 2 (captura CAF + scoring por reglas + folio)

Implementado: Feature 1 (auth con Google para operadores, `/consulta`
público desde el primer commit) y Feature 2 — `/screenings/new` captura
un tamizaje simulado (glucosa + cuestionario de riesgo), `crearTamizaje`
(`app/(caf)/screenings/actions.ts`) valida server-side con zod, calcula
el riesgo con `calcularRiesgo()` (`lib/scoring.ts`, lógica de reglas pura,
sin IO) y genera un folio único (`MX-XXXX-XXX`, alfabeto sin caracteres
ambiguos). `/screenings/[id]` es el comprobante imprimible con el folio
en grande. El score y el nivel de riesgo nunca se guardan precomputados
— se recalculan siempre a partir de los insumos crudos guardados en
`screenings`.

**Pendiente de que hagas tú (no puedo correr SQL en tu proyecto desde
aquí):**
- Correr el bloque de Feature 2 de `sql/schema.sql` en el SQL Editor de
  Supabase (crea la tabla `screenings` con RLS).
- Capturar un tamizaje de alto riesgo y uno de bajo riesgo y confirmar
  folios distintos (ver DECISIONS.md para el cálculo verificado a mano).
- Crear una segunda cuenta de Google de prueba y confirmar que no ve los
  tamizajes de la primera (ni por URL directa a `/screenings/<id>`).

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
