# Verifica Antes

Módulo del curso Crystal Ball (Week 3). Ayuda a Luis García a compartir los
datos de una oferta de inversión (empresa, promotor, CLABE receptora) que
recibió por WhatsApp, ver un semáforo rojo/amarillo/verde de qué se pudo
verificar, y entender cuánto costaría una verificación completa hoy —
todo antes de transferir un peso.

## Reglas duras del equipo (Shadow Clause) — Team 8

- Si la verificación está incompleta, el resultado se queda en rojo o
  amarillo — **nunca** aparece un badge de "seguro" o 100% verde
  garantizado. Incluso cuando el semáforo llega a verde, siempre va
  acompañado de un disclaimer explícito de que no es una garantía.
- Cada elemento del semáforo apunta a evidencia específica: qué se
  verificó, qué no, y de qué fuente viene (cálculo real vs. lista de
  ejemplo simulada).
- No es un detector de deepfakes genérico — es específico para este
  escenario: oferta de inversión, antes del primer depósito.
- La plataforma **nunca** autoriza ni certifica una inversión. El mensaje
  final siempre es: "Tú decides. Nunca decimos 'seguro'."

## Cómo funciona la verificación

- **CLABE**: se valida con el algoritmo real de dígito verificador
  (Banxico, pesos cíclicos 3-7-1). Esto es cálculo real, no simulado — ver
  `lib/clabe.ts`. El catálogo de bancos por los primeros 3 dígitos es
  simplificado y no exhaustivo.
- **Empresa y promotor**: se comparan contra listas de ejemplo, inventadas
  para esta demo (`lib/fixtures.ts`), explícitamente etiquetadas como
  `fuente: "simulada"` y sin ninguna conexión a CNBV, CONDUSEF ni a ningún
  registro real.
- **Desglose de costo**: cifras estimadas e ilustrativas de servicios
  típicos de verificación KYC/AML, no cotizaciones reales de ningún
  proveedor — sirven para mostrar por qué esas herramientas hoy solo están
  al alcance de bancos e instituciones, no de personas.

Todos los datos de ejemplo (empresas, promotores, CLABEs de prueba) son
inventados para esta demo. No se conecta con ningún banco, promotor ni
registro real.

## Guardado de datos

Este proyecto usa `localStorage` del navegador para guardar las
solicitudes de apoyo humano (llave `verificaciones_solicitudes`), sin
depender de ningún backend. No hay ninguna API key en el código ni
variables de entorno que configurar.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). El flujo completo
(pantalla 1 → 2 → 3) no requiere ninguna variable de entorno.

## Deploy a Vercel (dashboard)

1. Entra a [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Importa el repo de GitHub `gonzalopatlanbuilds-crypto/crystal-ball`.
3. Como este es un monorepo, en **Root Directory** selecciona
   `w03-verifica-antes` (no la raíz del repo).
4. Framework Preset: Next.js (se detecta solo).
5. No hace falta agregar ninguna Environment Variable — el proyecto no usa
   ningún servicio externo.
6. Deploy. Cuando termine, abre la URL pública y prueba el flujo completo:
   pantalla 1 → 2 → 3, confirma que el semáforo cambia según los datos que
   escribas y que la solicitud de apoyo se guarda en `localStorage`
   (DevTools → Application → Local Storage → `verificaciones_solicitudes`).
