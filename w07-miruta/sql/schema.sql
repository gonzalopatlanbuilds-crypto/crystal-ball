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

-- ============================================================
-- Feature 2: trips — viaje logueado por el conductor (hora de inicio/fin
-- simulando el ping de GPS, más un resumen de telemetría simulada del
-- teléfono). El status y flag_reason SIEMPRE se calculan en el servidor
-- (lib/trips.ts, evaluarViaje) antes del insert — nunca se confía en un
-- status que mande el cliente, mismo principio que screenings en
-- w05-timing-caf.
-- ============================================================

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete restrict,
  start_time timestamptz not null,
  end_time timestamptz not null check (end_time > start_time),
  telemetry_avg_speed_kmh numeric not null check (telemetry_avg_speed_kmh > 0),
  telemetry_label text not null check (telemetry_label in ('consistent', 'inconsistent')),
  status text not null check (status in ('verified', 'flagged')),
  flag_reason text,
  created_at timestamptz not null default now()
);

alter table public.trips enable row level security;

-- Un viaje ya registrado no se edita ni se borra — es un registro que el
-- conductor está construyendo como su propio historial, no un borrador.
-- Por eso solo hay policies de select e insert, nunca de update/delete
-- (mismo patrón que screenings en w05-timing-caf).

drop policy if exists "drivers select own trips" on public.trips;
create policy "drivers select own trips"
  on public.trips for select
  using (auth.uid() = driver_id);

drop policy if exists "drivers insert own trips" on public.trips;
create policy "drivers insert own trips"
  on public.trips for insert
  with check (auth.uid() = driver_id);

-- ============================================================
-- Feature 3: reporte de ingresos — necesita una tarifa promedio por ruta
-- para convertir "viajes verificados" en un ingreso estimado. `routes`
-- ya existe en producción desde la Feature 1, así que esto es un
-- `alter table`, no parte del `create table` de arriba — correr este
-- archivo completo de nuevo es seguro (`add column if not exists` no
-- truena si la columna ya está).
-- ============================================================

alter table public.routes
  add column if not exists avg_fare_mxn numeric check (avg_fare_mxn > 0);

-- Tarifa agregada por viaje completo de Ruta 47 (una corrida junta a
-- varios pasajeros, no el precio de un solo abordaje) — dato simulado,
-- mismo orden de magnitud que el mockup del packet (124 viajes
-- verificados × ~150 = ~$18,600 MXN).
update public.routes set avg_fare_mxn = 150 where name = 'Ruta 47' and avg_fare_mxn is null;

alter table public.routes alter column avg_fare_mxn set not null;
