# El Traductor

Módulo del curso Crystal Ball (Week 2). Ayuda a Doña Marisol Pech a entender,
en menos de 3 pantallas, qué datos dice un banco (simulado) que usó para
rechazarle un crédito, elegir cuáles objeta, y enviar una solicitud de
revisión humana citando la LFPDPPP.

## Reglas duras del equipo (Shadow Clause)

- **Nunca** se calcula ni se muestra un score o probabilidad de aprobación.
- Los datos de relación/proximidad/red social **nunca** son input real del
  sistema — solo aparecen como ejemplo de lo que dice el aviso simulado.
- La plataforma **nunca** decide aprobación/rechazo. Solo traduce y redacta
  una solicitud; la decisión siempre es del banco.

Todos los datos (nombre, CP, historial, etc.) son inventados para esta demo.
No se conecta con ningún banco real.

## ⚠️ Cambio temporal: Supabase caído (2026-08-23)

El proyecto Supabase "semestre" está devolviendo `password authentication
failed` — es un error del lado de su servidor, ya reportado a soporte de
Supabase. Para no bloquear la entrega, la Pantalla 3 (confirmación) guarda la
solicitud en `localStorage` del navegador en vez de insertarla en Supabase.

- La estructura de datos es idéntica a la de la tabla `solicitudes_revision`
  (`aviso_simulado`, `datos_objetados`, `mensaje_generado`), así que el
  cambio es transparente para quien lea el código o revise el JSON guardado.
- El código de Supabase **no se borró**: sigue completo en
  `lib/supabaseClient.ts` y `lib/enviarSolicitud.ts`, detrás del flag
  `NEXT_PUBLIC_USAR_SUPABASE`.
- Por default (flag vacío o `false`) la app usa `localStorage` y **no
  requiere** `NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  para funcionar ni para desplegar en Vercel.
- **Para reconectar Supabase** cuando el proyecto esté sano: agrega
  `NEXT_PUBLIC_USAR_SUPABASE=true` junto con las dos variables de Supabase en
  Vercel (o en `.env.local`) y vuelve a desplegar. No hace falta tocar
  código.

## Desarrollo local

Mientras dure el cambio temporal de arriba, **no necesitas ninguna variable
de entorno** para correr el proyecto:

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). El flujo completo
(pantalla 1 → 2 → 3) guarda la solicitud en `localStorage` bajo la llave
`solicitudes_revision` — puedes verla en DevTools → Application → Local
Storage.

<details>
<summary>Pasos para correr con Supabase (una vez que esté sano de nuevo)</summary>

1. Copia `.env.local.example` a `.env.local`.
2. Llena `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los
   valores del proyecto Supabase "semestre" (Project Settings → API), y pon
   `NEXT_PUBLIC_USAR_SUPABASE=true`.
3. En el SQL editor de ese proyecto, corre `sql/schema.sql` para crear la
   tabla `solicitudes_revision` con RLS activado (solo INSERT anónimo, sin
   lectura desde el cliente).
4. `npm install && npm run dev`.

</details>

## Deploy a Vercel (dashboard)

1. Entra a [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Importa el repo de GitHub `gonzalopatlanbuilds-crypto/crystal-ball`.
3. Como este es un monorepo, en **Root Directory** selecciona
   `w02-el-traductor` (no la raíz del repo).
4. Framework Preset: Next.js (se detecta solo).
5. Mientras dure el cambio temporal de arriba, **no hace falta agregar
   ninguna Environment Variable** — la app funciona con `localStorage` sin
   config extra.
6. Deploy. Cuando termine, abre la URL pública y prueba el flujo completo:
   pantalla 1 → 2 → 3, confirma que aparece la pantalla de éxito y que se
   guardó el registro en `localStorage` (DevTools → Application → Local
   Storage → `solicitudes_revision`).
7. Cuando Supabase esté sano: agrega `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_USAR_SUPABASE=true` en
   **Environment Variables** y haz Redeploy para que tomen efecto.
