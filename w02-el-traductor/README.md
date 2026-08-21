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

## Desarrollo local

1. Copia `.env.local.example` a `.env.local`.
2. Llena `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con los
   valores del proyecto Supabase "semestre" (Project Settings → API).
3. En el SQL editor de ese proyecto, corre `sql/schema.sql` para crear la
   tabla `solicitudes_revision` con RLS activado (solo INSERT anónimo, sin
   lectura desde el cliente).
4. Instala dependencias y arranca:

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Deploy a Vercel (dashboard)

1. Entra a [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Importa el repo de GitHub `gonzalopatlanbuilds-crypto/crystal-ball`.
3. Como este es un monorepo, en **Root Directory** selecciona
   `w02-el-traductor` (no la raíz del repo).
4. Framework Preset: Next.js (se detecta solo).
5. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   con los mismos valores de tu `.env.local`. No los pegues en el código ni
   en el chat — solo en el panel de Vercel.
6. Deploy. Cuando termine, abre la URL pública y prueba el flujo completo:
   pantalla 1 → 2 → 3, confirma que se crea un registro nuevo en
   `solicitudes_revision` (Supabase → Table Editor).
7. Si más adelante cambias las env vars en Vercel, tienes que volver a
   desplegar (Redeploy) para que tomen efecto.
