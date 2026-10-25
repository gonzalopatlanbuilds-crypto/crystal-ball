# Validador de Evidencia de Empaque (Week 11)

Herramienta de conciliación de evidencia de empaque: quien opera carga CSV
de proveedores, un motor determinista encuentra discrepancias y una
persona revisora confirma o descarta cada una, con procedencia e
historial de versiones. **Todos los datos son simulados** y la herramienta
no dictamina cumplimiento, reciclaje ni recuperación.

- `docs/PACKET.md`: el qué y el porqué. `DECISIONS.md`: cada decisión y
  cada prueba, en orden.
- Stack: Next.js (App Router) + Supabase (Postgres, Auth con Google) +
  Vercel.

## Correr local

1. `cp .env.local.example .env.local` y llena los valores (ver comentarios).
2. Corre `sql/schema.sql` completo en el SQL Editor de Supabase (es
   idempotente).
3. `npm install && npm run dev`

## Pruebas

- `npm run test:logica`: lectura y validación del CSV, motor de
  hallazgos (`lib/validador.ts`) y decisiones, sin red.
- `npm run test:schema`: schema en Postgres real (PGlite) con stub de
  Supabase: RLS, revokes, aislamiento entre organizaciones, versiones
  append-only, validación de filas en la base, hallazgos de punta a punta
  estado que solo cambia con una decisión, nota obligatoria y bitácora
  append-only. Con
  `BASE_URL=…` prueba también rutas por HTTP.
- `bash scripts/probar-anon.sh`: la llave pública contra el proyecto real.
- `npm run verificar:deploy -- https://…`: un deploy visto desde fuera,
  sin sesión.
