# Validador de Evidencia de Empaque (Week 11)

Herramienta de conciliación de evidencia de empaque: quien opera carga CSV
de proveedores, un motor determinista encuentra discrepancias y una
persona revisora confirma o descarta cada una con una nota obligatoria,
con procedencia e historial de versiones. **Todos los datos son
simulados** y la herramienta no dictamina cumplimiento, reciclaje ni
recuperación.

- Producción: https://w11-validador-evidencia.vercel.app (`/login`; todo lo
  demás exige sesión con Google y organización).
- `docs/PACKET.md`: el qué y el porqué. `DECISIONS.md`: cada decisión,
  cada prueba y cada bug, en orden.
- Stack: Next.js (App Router) + Supabase (Postgres, Auth con Google) +
  Vercel + Claude (`claude-opus-5-5`, solo en el servidor, para el lector
  de IA).

## Qué hace

1. **Carga** (`/validador`): CSV con `sku, supplier, weight_g, material,
   packaging_revision_date, evidence_folio`. El servidor valida tipo,
   tamaño, UTF-8, columnas y cada fila (las malas se reportan con su
   motivo); la base vuelve a validar. Toda carga válida es una versión
   nueva e inmutable.
2. **Motor** (`lib/validador.ts`, sin IA): proveedor faltante, valor en
   conflicto, revisión posterior a la evidencia aceptada y posible
   duplicado de folio, siempre contra la última evidencia **aceptada**.
3. **Revisión** (`/validador/hallazgos`): cada hallazgo nace pendiente y
   solo cambia con una decisión humana con nota; la bitácora es
   append-only.
4. **Lector de IA** (opcional, "sin validar"): una observación sobre qué
   podría explicar la discrepancia, filtrada por una guardia en el
   servidor y con límite de frecuencia.

## Correr local

1. `cp .env.local.example .env.local` y llena los valores (ver comentarios).
2. Corre `sql/schema.sql` completo en el SQL Editor de Supabase (es
   idempotente).
3. `npm install && npm run build && npm start` (o `npm run dev`).

Variables de entorno (también en Vercel):

- `NEXT_PUBLIC_SUPABASE_URL` — URL base, sin `/rest/v1/`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — la llave pública.
- `ANTHROPIC_API_KEY` — solo servidor; sin ella el lector de IA dice que no
  está configurado y todo lo demás funciona.

## Pruebas

- `npm run test:logica`: lectura y validación del CSV, motor de
  hallazgos, decisiones y guardia del lector de IA, sin red.
- `npm run test:schema`: schema en Postgres real (PGlite) con stub de
  Supabase: RLS, revokes, aislamiento entre organizaciones, versiones
  append-only, validación de filas en la base, hallazgos de punta a punta,
  estado que solo cambia con una decisión, nota obligatoria, bitácora
  append-only y límite del lector. Con `BASE_URL=…` prueba también rutas.
- `bash scripts/probar-anon.sh`: la llave pública contra el proyecto real.
- `npm run verificar:deploy -- https://…`: un deploy visto desde fuera,
  sin sesión.
- `node scripts/probar-lector.ts 3`: lector de IA con llamadas reales
  (rondas de 10 escenarios sembrados; imprime todo para leerlo a mano y lo
  guarda en `docs/pruebas/`). Cuesta dinero.
- `node scripts/comparar-lector.ts docs/pruebas/lector-ia-….json`: IA vs.
  chequeo por reglas, sin volver a llamar a la API.
- `node scripts/provocar-guardia.ts` y `node scripts/atacar-lector.ts`:
  la guardia contra salidas reales provocadas a propósito. Cuestan dinero.
- `docs/pruebas/mecanica/`: los CSV de la prueba mecánica (PACKET,
  sección 10).
