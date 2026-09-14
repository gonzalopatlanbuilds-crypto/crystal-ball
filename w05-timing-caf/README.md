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

## Estado actual: Feature 5 (bug de la prueba mecánica arreglado, listo para deploy)

Implementado: Feature 1 (auth), Feature 2 (captura + scoring + folio),
Feature 3 (consulta pública rate-limited), Feature 4 (explicación por
LLM + siguiente paso) y el pase de prueba mecánica de Feature 5.

**Bug encontrado y arreglado:** el comprobante imprimible
(`/screenings/[id]`) imprimía también el header de la consola del
operador (su email + botón "Cerrar sesión"), porque vive dentro del
layout `(caf)` que siempre lo renderiza. Fix: `print:hidden` en
`components/CafHeader.tsx` — ver DECISIONS.md para el detalle.

**Pendiente de que hagas tú:**
- Confirmar el fix: vista previa de impresión de un `/screenings/<id>` ya
  no debe mostrar tu email ni "Cerrar sesión".
- Deploy a Vercel: nuevo proyecto con **Root Directory** `w05-timing-caf`,
  las 3 env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `ANTHROPIC_API_KEY`), y agregar
  `https://<tu-app>.vercel.app/auth/callback` a Redirect URLs en Supabase.
- Confirmar login, captura y `/consulta` ya en la URL de producción.

## Desarrollo local

```bash
npm install
npm run dev
```

## Deploy

Proyecto pensado para Vercel (free tier), como subcarpeta de un
monorepo — al crear el proyecto en Vercel, configura **Root Directory**
= `w05-timing-caf`. Variables de entorno
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY`) se configuran en el dashboard de Vercel, nunca en el
repo. No olvides agregar la callback URL de producción
(`https://<tu-app>.vercel.app/auth/callback`) a Redirect URLs en Supabase
— sin eso el login con Google funciona en local pero falla en Vercel.
