-- Folio CAF — schema
-- Corre esto completo en el SQL Editor de tu proyecto de Supabase
-- (Project → SQL Editor → New query → pega y ejecuta).

-- ============================================================
-- Feature 1: auth + shell — no requiere tablas propias.
-- Supabase Auth ya administra auth.users; Google se configura desde
-- el dashboard (Authentication → Providers), no desde SQL.
-- ============================================================

-- ============================================================
-- Feature 2: screenings — tamizaje capturado por un operador de CAF.
-- Solo se guardan los insumos crudos (glucosa, cuestionario); el score y
-- el nivel de riesgo se recalculan siempre en el servidor con
-- lib/scoring.ts (calcularRiesgo), nunca se confía en un número
-- precomputado guardado en la fila — una sola fuente de verdad.
-- ============================================================

create table if not exists public.screenings (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references auth.users (id) on delete cascade,
  -- Identificador público para la consulta sin login de la Feature 3.
  -- Generado en lib/scoring.ts (generarFolio) con alfabeto sin
  -- caracteres ambiguos; el UNIQUE de aquí es el respaldo real de
  -- unicidad (el server action reintenta si choca).
  folio text not null unique check (char_length(folio) between 8 and 16),
  patient_first_name text not null check (char_length(patient_first_name) between 1 and 80),
  patient_last_name text not null check (char_length(patient_last_name) between 1 and 80),
  patient_phone text,
  glucose_mgdl integer not null check (glucose_mgdl between 40 and 600),
  family_history boolean not null default false,
  -- Array jsonb de valores de lib/screenings.ts (SINTOMA_VALUES). La
  -- validación fina de qué valores son válidos vive server-side con zod;
  -- este CHECK es un respaldo a nivel de base de datos.
  symptoms jsonb not null default '[]'::jsonb check (jsonb_typeof(symptoms) = 'array'),
  age_band text not null check (age_band in ('menor_40', '40_59', '60_mas')),
  created_at timestamptz not null default now()
);

alter table public.screenings enable row level security;

-- Un tamizaje ya capturado no se edita ni se borra — es un registro
-- clínico simulado, no un borrador. Por eso solo hay policies de select
-- e insert, nunca de update/delete.

drop policy if exists "operators select own screenings" on public.screenings;
create policy "operators select own screenings"
  on public.screenings for select
  using (auth.uid() = operator_id);

drop policy if exists "operators insert own screenings" on public.screenings;
create policy "operators insert own screenings"
  on public.screenings for insert
  with check (auth.uid() = operator_id);

-- ============================================================
-- Feature 3 (pendiente): la consulta pública por folio + apellido NO va
-- a leer esta tabla directamente (ninguna policy aquí permite select sin
-- auth.uid() = operator_id) — va a pasar por una función de Postgres
-- `security definer`, acotada a devolver solo los campos que el paciente
-- necesita ver, nunca operator_id ni datos de otros pacientes. Se agrega
-- en la siguiente sesión junto con el rate limiting.
-- ============================================================
