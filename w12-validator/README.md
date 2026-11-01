# Validator (Week 12, Core Build)

Capa de conciliación de evidencia de empaque para productores mexicanos
pequeños: quien funda carga los CSV de sus proveedores, un motor
determinista encuentra discrepancias y esa misma persona, como revisora,
confirma o descarta cada una con una nota obligatoria, con procedencia e
historial de versiones. **Todos los datos son simulados.** Validator no
certifica cumplimiento ni reciclaje.

- Producción: https://www.packvalidator.online (la home y `/login` son
  públicas; todo lo demás exige sesión con Google y organización).
- `docs/CHARTER.md`, `docs/PERSONAS.md`, `docs/PACKET.md`: el qué y el
  porqué. `DECISIONS.md`: cada decisión, cada prueba y cada bug, en orden.
- Stack: Next.js (App Router) + Supabase (Postgres, Auth con Google) +
  Vercel + Claude (`claude-opus-5-5`, solo en el servidor, para el lector
  de IA).

## Qué hace

1. **Carga** (`/validador`): CSV con `sku, supplier, weight_g, material,
   packaging_revision_date, evidence_folio`. El servidor valida tipo,
   tamaño, UTF-8, columnas y cada fila (las malas se reportan con su
   motivo y se guardan); la base vuelve a validar. Toda carga válida es
   una versión nueva e inmutable, aunque sea idéntica a la anterior (se
   marca "Idéntica a la anterior").
2. **Motor** (`lib/validador.ts`, sin IA): proveedor faltante, valor en
   conflicto (con los dos valores y las dos procedencias), revisión
   posterior a la evidencia aceptada y posible duplicado de folio ("sin
   verificar"), siempre contra la última evidencia **aceptada**.
3. **Revisión** (`/validador/hallazgos`): cada hallazgo nace pendiente y
   solo cambia con una decisión humana con nota; la bitácora es
   append-only (un cambio de opinión es una fila nueva).
4. **Lector de IA** (opcional, "sin validar"): una observación sobre qué
   podría explicar la discrepancia, filtrada por una guardia en el
   servidor (sin veredictos ni cifras nuevas) y con límite de 10 consultas
   por hora por persona y 30 por día por organización.

Una sola persona carga y revisa (Blueprint, condición 2): no hay segundo
rol ni flujo de aprobación.

## Correr local

1. `cp .env.local.example .env.local` y llena los valores (ver comentarios).
2. Corre `sql/schema.sql` completo en el SQL Editor de Supabase (es
   idempotente).
3. `npm install && npm run build && npm start` (o `npm run dev`).

## Pruebas

- `npm run test:logica`: lógica pura (CSV, motor, decisiones, guardia de
  la IA). Sin red.
- `npm run test:schema`: el schema en Postgres real (PGlite), sin
  Supabase. Con `BASE_URL=…` prueba también las rutas por HTTP.
- `bash scripts/probar-anon.sh`: la llave pública contra el proyecto real
  (no imprime la llave).
- `npm run verificar:deploy -- https://www.packvalidator.online`: el
  deploy desde fuera, sin sesión.
- `node scripts/probar-lector.ts 3`, `provocar-guardia.ts`,
  `atacar-lector.ts`: llamadas **reales** a la API (cuestan dinero);
  `comparar-lector.ts` compara la IA con una regla sin volver a pagar.
- `docs/pruebas/`: CSV de las pruebas en el navegador, el fixture de la
  revisión tardía y las salidas reales de la IA.
