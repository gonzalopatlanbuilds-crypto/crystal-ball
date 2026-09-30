# CostoReal

Semana 8 de Crystal Ball (Business Bending, rol MONEY). Modelo de costo
del piloto de atención a víctimas de brechas: el staff registra el tiempo
real invertido por fase en cada caso, el sistema calcula el costo real de
personal, lo proyecta con volumen simulado a 10/100/1,000 casos/mes, y
compara tres escenarios de financiamiento — con cada supuesto no
confirmado etiquetado como "No confirmado" (Condición 5 del Blueprint:
"validate funding and distribution; do not assume partnerships"). Ver
`docs/PACKET.md` para el spec completo.

## Seguridad — piso no negociable

- **Sin llaves en el código ni en el repo.** Credenciales de Supabase y
  `ANTHROPIC_API_KEY` en `.env.local` (ignorado por git) en desarrollo, y
  en las Environment Variables de Vercel en producción.
- **Supabase Auth con Google** para staff y coordinación.
- **Row Level Security** en `orgs`, `profiles`, `cases`,
  `case_time_logs` y `case_volume_scenarios`: cada quien solo ve lo de su
  propia organización piloto.
- **Validación server-side** en todo formulario (tiempos positivos,
  tarifas en rango plausible), repetida como `check` en la base.
- **Todos los datos son inventados**, etiquetados en pantalla como "Datos
  simulados". Nunca nombres, casos ni datos reales de víctimas (SHADOW
  CLAUSE del Blueprint).
- **El resumen de IA nunca afirma ni insinúa una alianza o patrocinio**, y
  toda cifra no confirmada lleva "no confirmado".

## Estado actual: Feature 2 (registro de tiempo por caso + costo real por caso)

## Desarrollo local

1. Crea un proyecto en Supabase y corre `sql/schema.sql` completo en el
   SQL Editor.
2. Activa el provider de Google (Authentication → Providers → Google).
3. `cp .env.local.example .env.local` y llena los valores.
4. `npm install && npm run dev`.

Historial completo de decisiones en `DECISIONS.md`.
