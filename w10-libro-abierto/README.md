# Libro Abierto (Week 10)

Libro público de financiamiento y costos de un verificador independiente
de compatibilidad de laptops, con un modelo para el operador detrás de
login con Google. **Todos los datos son simulados.**

- `docs/PACKET.md`: el qué y el porqué. `DECISIONS.md`: cada decisión y
  cada prueba, en orden.
- Stack: Next.js (App Router) + Supabase (Postgres, Auth con Google) +
  Vercel.

## Correr local

1. `cp .env.local.example .env.local` y llena los valores (ver comentarios).
2. Corre `sql/schema.sql` completo en el SQL Editor de Supabase.
3. `npm install && npm run dev`

## Pruebas

- `npm run test:schema`: schema en Postgres real (PGlite) con stub de
  Supabase. Con `BASE_URL=…` prueba también rutas por HTTP.
- `bash scripts/probar-anon.sh`: la llave pública contra el proyecto real.
