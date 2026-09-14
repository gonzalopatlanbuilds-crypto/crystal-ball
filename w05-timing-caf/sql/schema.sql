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
-- Feature 3: consulta pública por folio + apellido, sin login. Ninguna
-- policy de arriba permite select sin auth.uid() = operator_id, así que
-- esta función `security definer` es la ÚNICA puerta pública de lectura
-- a `screenings` — corre con los privilegios de quien la creó (bypassa
-- RLS internamente) pero devuelve solo los campos que el paciente
-- necesita ver: nunca operator_id, nunca teléfono, nunca filas de otros
-- pacientes salvo el match exacto de folio + apellido.
--
-- Por qué no filtra en dos pasos (primero por folio, luego compara
-- apellido en la app): comparar ambos en el mismo WHERE hace que un
-- folio real con apellido equivocado y un folio inexistente devuelvan
-- exactamente lo mismo (cero filas) — el server action de arriba nunca
-- tiene información para distinguir los dos casos, así que no puede
-- filtrarla aunque quisiera. Esa es la defensa real contra enumeración
-- de folios, no una validación en la capa de aplicación.
-- ============================================================

create or replace function public.consultar_tamizaje(p_folio text, p_apellido text)
returns table (
  folio text,
  patient_first_name text,
  glucose_mgdl integer,
  family_history boolean,
  symptoms jsonb,
  age_band text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select s.folio, s.patient_first_name, s.glucose_mgdl, s.family_history,
         s.symptoms, s.age_band, s.created_at
  from public.screenings s
  where s.folio = upper(trim(p_folio))
    and lower(trim(s.patient_last_name)) = lower(trim(p_apellido))
  limit 1;
$$;

-- Postgres da EXECUTE a PUBLIC por default en funciones nuevas — se
-- revoca explícito y se vuelve a otorgar solo a los roles que de verdad
-- necesitan llamarla, para que la intención quede escrita, no implícita.
revoke all on function public.consultar_tamizaje(text, text) from public;
grant execute on function public.consultar_tamizaje(text, text) to anon, authenticated;
