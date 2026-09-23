# MiRuta

Semana 7 de Crystal Ball. Una herramienta driver-first: un conductor de
colectivo (Ruta 47, Indios Verdes–Pantitlán) registra sus propios viajes,
el sistema los valida contra la geometría conocida de la ruta, y el
conductor genera un reporte de ingresos verificado que le pertenece a él
— nunca a un dueño de ruta o regulador. Ver `docs/PACKET.md` para el spec
completo.

## Seguridad — piso no negociable

- **Sin llaves en el código ni en el repo.** Las credenciales de Supabase
  viven en `.env.local` (ignorado por git) en desarrollo, y en las
  Environment Variables del dashboard de Vercel en producción.
- **Supabase Auth con Google** para cuentas de conductor.
- **Row Level Security** en `trips` (desde la Feature 2): cada conductor
  solo ve y reporta sobre sus propios viajes (`auth.uid() = driver_id`,
  sin policy de update/delete — el registro es inmutable).
- **Validación server-side en todo formulario** — hora de inicio/fin de
  viaje requeridas y validadas como rango real antes de calificar nada.
- **Todos los datos son inventados**, etiquetados en pantalla como "Datos
  simulados" — nunca nombres o datos personales reales.
- **Deployment Protection de Vercel debe estar OFF** — la URL pública
  debe cargar sin sesión de Vercel. Confirmar esto antes de dar por
  terminada cada entrega (falla real de la semana pasada).

## Estado actual: Features 1-5 completas (ver `DECISIONS.md`)

## Desarrollo local

```bash
npm install
npm run dev
```

## Deploy

Proyecto pensado para Vercel (free tier), como subcarpeta de un
monorepo — al crear el proyecto en Vercel, configura **Root Directory**
= `w07-miruta`. Variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) se configuran en el dashboard de Vercel,
nunca en el repo. No olvides agregar la callback URL de producción
(`https://<tu-app>.vercel.app/auth/callback`) a Redirect URLs en Supabase
— sin eso el login con Google funciona en local pero falla en Vercel. Y
confirma **Settings → Deployment Protection → Vercel Authentication y
Password Protection = OFF**, para que la URL cargue en incógnito sin
cuenta de Vercel.
