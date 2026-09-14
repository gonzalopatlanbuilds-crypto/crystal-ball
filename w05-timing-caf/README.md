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

## Estado actual: Feature 4 (explicación por LLM + siguiente paso)

Implementado: Feature 1 (auth), Feature 2 (captura + scoring + folio),
Feature 3 (consulta pública rate-limited) y Feature 4 — en el resultado
de `/consulta`, `redactarExplicacionPaciente()` (`lib/llm.ts`, Claude
Haiku 4.5) redacta un párrafo en español simple a partir del nivel de
riesgo ya decidido por reglas, y `obtenerSiguientePaso()`
(`lib/nextStep.ts`, texto fijo, sin LLM) siempre agrega una clínica +
horario + acción concreta — nunca vacío en un resultado de alto riesgo,
ni siquiera si la llamada al LLM falla (en ese caso el párrafo cae a un
texto de respaldo y el error real se loggea server-side).

**Pendiente de que hagas tú:**
- Confirmar que `.env.local` tiene `ANTHROPIC_API_KEY` (ya se copió de
  w04-proof-of-skill en esta sesión).
- Probar `/consulta` con un folio de alto riesgo (caja ámbar, con
  urgencia) y uno de bajo riesgo (caja neutra, sin urgencia).

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
