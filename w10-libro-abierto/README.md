# Libro Abierto (Week 10)

Libro público de financiamiento y costos de un verificador independiente
de compatibilidad de laptops, con un modelo para el operador detrás de
login con Google. **Todos los datos son simulados.**

- Producción: https://crystal-ball-w10-libro-abierto.vercel.app
  (`/financiamiento` es la página pública; `/login` es para el equipo).
- `docs/PACKET.md`: el qué y el porqué. `DECISIONS.md`: cada decisión y
  cada prueba, en orden.
- Stack: Next.js (App Router) + Supabase (Postgres, Auth con Google) +
  Vercel + Claude (`claude-opus-5-5`, solo en el servidor, para el auditor).

## Correr local

1. `cp .env.local.example .env.local` y llena los valores (ver comentarios).
2. Corre `sql/schema.sql` completo en el SQL Editor de Supabase (es
   idempotente). Para publicar, marca tu organización como oficial:
   `update public.organizations set es_oficial = true where join_code = 'TU-CODIGO';`
3. `npm install && npm run dev`

## Pruebas

- `npm run test:logica`: modelo, viabilidad, validación de formularios,
  snapshot y guardia del auditor de IA (sin red).
- `npm run test:schema`: schema en Postgres real (PGlite) con stub de
  Supabase: RLS, compuerta de viabilidad, inmutabilidad, ataques, consulta
  pública. Con `BASE_URL=…` prueba también rutas por HTTP.
- `bash scripts/probar-anon.sh`: la llave pública contra el proyecto real.
- `node scripts/probar-auditor.ts 3`: auditor de IA con llamadas reales (3
  rondas de 9 escenarios; imprime todo para leerlo a mano). Cuesta dinero.
- `node scripts/comparar-auditor.ts 3`: IA vs. revisión por reglas sobre
  errores sembrados. Cuesta dinero.
