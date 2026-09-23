-- MiRuta — schema
-- Corre esto completo en el SQL Editor de tu proyecto de Supabase
-- (Project → SQL Editor → New query → pega y ejecuta).

-- ============================================================
-- Feature 1: auth + shell + ruta sembrada — Google Auth ya administra
-- auth.users desde el dashboard (Authentication → Providers), no desde
-- SQL. Una sola audiencia (el conductor); a diferencia de w06 no hay
-- concepto de organización, así que las tablas de datos del conductor
-- (trips, Feature 2) se aíslan directo por auth.uid() = driver_id, mismo
-- patrón que operator_id en w05-timing-caf.
-- ============================================================

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  origin_label text not null check (char_length(origin_label) between 1 and 80),
  destination_label text not null check (char_length(destination_label) between 1 and 80),
  distance_km numeric not null check (distance_km > 0),
  expected_duration_min_low integer not null check (expected_duration_min_low > 0),
  expected_duration_min_high integer not null check (expected_duration_min_high > expected_duration_min_low),
  expected_speed_kmh_low numeric not null check (expected_speed_kmh_low > 0),
  expected_speed_kmh_high numeric not null check (expected_speed_kmh_high > expected_speed_kmh_low),
  created_at timestamptz not null default now()
);

alter table public.routes enable row level security;

-- Geometría de referencia compartida, no un dato del conductor — pero
-- igual sin acceso público (piso de seguridad: "ninguna tabla legible sin
-- auth"), así que la policy exige sesión (`to authenticated`) sin filtrar
-- por dueño.
drop policy if exists "authenticated users read routes" on public.routes;
create policy "authenticated users read routes"
  on public.routes for select
  to authenticated
  using (true);

-- Sin policy de insert/update/delete: la única puerta de escritura es
-- este mismo archivo, corrido a mano en el SQL Editor (rol postgres,
-- bypassa RLS) — la geometría de la ruta es fija por diseño del packet,
-- no algo que el cliente deba poder modificar.
insert into public.routes (
  name, origin_label, destination_label, distance_km,
  expected_duration_min_low, expected_duration_min_high,
  expected_speed_kmh_low, expected_speed_kmh_high
)
values (
  'Ruta 47', 'Indios Verdes', 'Pantitlán', 18.5,
  40, 55,
  20, 28
)
on conflict (name) do nothing;
