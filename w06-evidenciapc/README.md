# Evidencia PC

Semana 6 de Crystal Ball. Una capa de evaluación auditable para
simulacros de protección civil: un hallazgo crítico logueado en un
simulacro no puede cerrarse ni verificarse por la misma persona, y un
registro ya aprobado queda inmutable. Ver `docs/PACKET.md` para el spec
completo.

## Seguridad — piso no negociable

- **Sin llaves en el código ni en el repo.** Las credenciales de Supabase
  y la `ANTHROPIC_API_KEY` viven en `.env.local` (ignorado por git) en
  desarrollo, y en las Environment Variables del dashboard de Vercel en
  producción.
- **Supabase Auth con Google para todos** — coordinador, owner y
  verificador son el mismo tipo de cuenta, distinto solo por qué acción
  toman en un hallazgo dado.
- **Row Level Security** en `orgs`, `profiles`, y (desde la Feature 2)
  `findings`/`closures`: cada quien solo ve los registros de su propia
  organización escolar.
- **Validación server-side en todo formulario.**
- **El cierre nunca puede aprobarlo la misma cuenta que lo hizo** —
  enforced a nivel de base de datos (trigger), no solo escondiendo un
  botón en la UI.
- **Todos los datos son inventados**, etiquetados en pantalla como "Datos
  simulados" — nunca nombres o datos personales reales.

## Estado actual: Feature 4 (revisión del verificador independiente + inmutabilidad)

## Desarrollo local

```bash
npm install
npm run dev
```

## Deploy

Proyecto pensado para Vercel (free tier), como subcarpeta de un
monorepo — al crear el proyecto en Vercel, configura **Root Directory**
= `w06-evidenciapc`. Variables de entorno
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY`) se configuran en el dashboard de Vercel, nunca en el
repo. No olvides agregar la callback URL de producción
(`https://<tu-app>.vercel.app/auth/callback`) a Redirect URLs en Supabase
— sin eso el login con Google funciona en local pero falla en Vercel.
