# Validator (Week 12, Core Build)

Capa de conciliación de evidencia de empaque para productores mexicanos
pequeños: quien funda carga los CSV de sus proveedores, un motor
determinista encuentra discrepancias y esa misma persona, como revisora,
confirma o descarta cada una con una nota obligatoria, con procedencia e
historial de versiones. **Todos los datos son simulados.** Validator no
certifica cumplimiento ni reciclaje.

- Dominio de registro: packvalidator.online.
- `docs/CHARTER.md`, `docs/PERSONAS.md`, `docs/PACKET.md`: el qué y el
  porqué. `DECISIONS.md`: cada decisión, cada prueba y cada bug, en orden.
- Stack: Next.js (App Router) + Supabase (Postgres, Auth con Google) +
  Vercel.

## Correr local

1. `cp .env.local.example .env.local` y llena los valores (ver comentarios).
2. Corre `sql/schema.sql` completo en el SQL Editor de Supabase (es
   idempotente).
3. `npm install && npm run build && npm start` (o `npm run dev`).

## Pruebas

- `npm run test:schema`: el schema en Postgres real (PGlite), sin Supabase.
  Con `BASE_URL=http://localhost:3000` prueba también las rutas por HTTP.
- `bash scripts/probar-anon.sh`: la llave pública contra el proyecto real
  (no imprime la llave).
