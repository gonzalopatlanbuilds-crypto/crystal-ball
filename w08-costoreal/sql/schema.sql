-- CostoReal — schema
-- Corre esto completo en el SQL Editor de tu proyecto de Supabase
-- (Project → SQL Editor → New query → pega y ejecuta). Es idempotente:
-- se puede volver a correr entero sin romper nada.

-- ============================================================
-- Feature 1: auth + organizaciones piloto — Google Auth ya administra
-- auth.users desde el dashboard (Authentication → Providers), no desde SQL.
--
-- orgs/profiles son el mecanismo real de aislamiento (mismo patrón que
-- w06-evidenciapc): staff y coordinador de un mismo piloto comparten
-- casos y registros de tiempo, así que el filtro es "misma organización",
-- no "mis propios registros". Todo lo de abajo se filtra por
-- profiles.org_id, nunca por auth.uid() directo.
-- ============================================================

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  join_code text not null unique check (join_code ~ '^[A-Z2-9]{3}-[A-Z2-9]{3}$'),
  created_at timestamptz not null default now()
);

alter table public.orgs enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- SECURITY DEFINER a propósito: una policy de profiles que vuelva a
-- consultar profiles dentro de su propio USING dispara "infinite recursion
-- detected in policy" (bug real encontrado en w06). Esta función rompe el
-- ciclo porque corre sin RLS internamente.
create or replace function public.my_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.my_org_id() from public, anon;
grant execute on function public.my_org_id() to authenticated;

drop policy if exists "members select own org profiles" on public.profiles;
create policy "members select own org profiles"
  on public.profiles for select
  using (
    org_id = public.my_org_id()
  );

drop policy if exists "members select own org" on public.orgs;
create policy "members select own org"
  on public.orgs for select
  using (
    id = public.my_org_id()
  );

-- Ninguna policy de insert/update/delete en orgs/profiles: create_org() y
-- join_org() (security definer) son la única puerta de escritura.

-- ============================================================
-- Feature 1: case_volume_scenarios — distribución SIMULADA de casos por
-- tipo a tres escalas (10/100/1,000 casos/mes). Es el dataset estructurado
-- del Dragon Stack: se usa en la Feature 3 para proyectar el costo mensual.
--
-- Se siembra una copia por organización (dentro de create_org), en vez de
-- una tabla global compartida, porque el piso de seguridad pide RLS
-- "scoped to the pilot organization" también para esta tabla — y así cada
-- piloto podría, más adelante, ajustar su propia distribución sin tocar la
-- de otro.
-- ============================================================

create table if not exists public.case_volume_scenarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  scale int not null check (scale in (10, 100, 1000)),
  case_type text not null check (case_type in ('account_takeover', 'impersonation', 'fake_fundraiser')),
  monthly_cases int not null check (monthly_cases >= 0),
  -- Siempre true: no existe ningún camino para meter volumen "real". La
  -- columna existe para que la UI y el resumen de IA lean la etiqueta de
  -- la base, no de una suposición del código.
  is_simulated boolean not null default true check (is_simulated),
  source_note text not null default 'Distribución simulada — no proviene de casos reales',
  unique (org_id, scale, case_type)
);

alter table public.case_volume_scenarios enable row level security;

drop policy if exists "members select own org volume" on public.case_volume_scenarios;
create policy "members select own org volume"
  on public.case_volume_scenarios for select
  using (
    org_id = public.my_org_id()
  );

-- Sin policies de escritura: la única forma de que existan filas es
-- sembrar_volumen_simulado(), llamada desde create_org().

-- 50% toma de cuenta / 30% suplantación / 20% colecta falsa — supuesto
-- inventado para el piloto, sin fuente real (etiquetado así en pantalla).
create or replace function public.sembrar_volumen_simulado(p_org_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.case_volume_scenarios (org_id, scale, case_type, monthly_cases)
  select p_org_id, s.scale, t.case_type, round(s.scale * t.share)::int
  from (values (10), (100), (1000)) as s (scale)
  cross join (values
    ('account_takeover', 0.5),
    ('impersonation', 0.3),
    ('fake_fundraiser', 0.2)
  ) as t (case_type, share)
  on conflict (org_id, scale, case_type) do nothing;
$$;

-- Supabase da EXECUTE a anon/authenticated por default privileges en
-- funciones nuevas de `public`; revocar solo de `public` no basta.
revoke all on function public.sembrar_volumen_simulado(uuid) from public, anon, authenticated;

create or replace function public.generar_join_code()
returns text
language plpgsql
as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin O/0, I/1
  salida text := '';
  i int;
begin
  for i in 1..6 loop
    if i = 4 then
      salida := salida || '-';
    end if;
    salida := salida || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
  end loop;
  return salida;
end;
$$;

revoke all on function public.generar_join_code() from public, anon, authenticated;

create or replace function public.create_org(p_name text)
returns table (org_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_code text;
  v_intentos int := 0;
begin
  if auth.uid() is null then
    raise exception 'Se requiere sesión.';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Ya perteneces a una organización.';
  end if;

  loop
    v_code := public.generar_join_code();
    begin
      insert into public.orgs (name, join_code) values (trim(p_name), v_code)
        returning id into v_org_id;
      exit;
    exception when unique_violation then
      v_intentos := v_intentos + 1;
      if v_intentos >= 5 then
        raise exception 'No se pudo generar un código único. Intenta de nuevo.';
      end if;
    end;
  end loop;

  insert into public.profiles (id, org_id, email, display_name)
  values (
    auth.uid(),
    v_org_id,
    auth.jwt() ->> 'email',
    auth.jwt() -> 'user_metadata' ->> 'full_name'
  );

  perform public.sembrar_volumen_simulado(v_org_id);

  return query select v_org_id, v_code;
end;
$$;

-- Bug encontrado en la pasada mecánica (Feature 5): con solo "from public",
-- anon seguía pudiendo ejecutar create_org() — Supabase le da EXECUTE a
-- anon/authenticated por default privileges en funciones nuevas de
-- `public`. Una llamada anónima llegaba a insertar en `orgs` y solo
-- fallaba (con rollback) en `profiles` por auth.uid() nulo. Ahora se
-- revoca de anon explícitamente y la función además rechaza sin sesión.
revoke all on function public.create_org(text) from public, anon;
grant execute on function public.create_org(text) to authenticated;

create or replace function public.join_org(p_join_code text)
returns table (org_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Se requiere sesión.';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Ya perteneces a una organización.';
  end if;

  select o.id into v_org_id from public.orgs o where o.join_code = upper(trim(p_join_code));
  if v_org_id is null then
    raise exception 'Código no encontrado. Verifica que esté bien escrito.';
  end if;

  insert into public.profiles (id, org_id, email, display_name)
  values (
    auth.uid(),
    v_org_id,
    auth.jwt() ->> 'email',
    auth.jwt() -> 'user_metadata' ->> 'full_name'
  );

  return query select v_org_id;
end;
$$;

revoke all on function public.join_org(text) from public, anon;
grant execute on function public.join_org(text) to authenticated;

-- ============================================================
-- Piso de seguridad (antes de la Feature 2): `cases` y `case_time_logs`
-- se crean desde ahora, con RLS, aunque la pantalla que los usa llega en
-- la Feature 2 — el prompt pide RLS confirmado antes de cualquier feature.
--
-- `cases` no está en la tabla de arquitectura del packet (que solo nombra
-- case_time_logs y case_volume_scenarios); se agrega porque el mockup 1
-- registra tiempo "por caso" (Caso #0083 — Toma de cuenta) y el tipo de
-- caso es lo que conecta el costo registrado con la distribución de
-- volumen. Un caso aquí es solo un código + tipo: NUNCA nombre, contacto,
-- ni detalle de víctima (SHADOW CLAUSE del Blueprint).
-- ============================================================

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  case_number bigint generated always as identity,
  case_type text not null check (case_type in ('account_takeover', 'impersonation', 'fake_fundraiser')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.cases enable row level security;

drop policy if exists "members select own org cases" on public.cases;
create policy "members select own org cases"
  on public.cases for select
  using (
    org_id = public.my_org_id()
  );

drop policy if exists "members insert cases in own org" on public.cases;
create policy "members insert cases in own org"
  on public.cases for insert
  with check (
    org_id = public.my_org_id()
    and created_by = auth.uid()
  );

create table if not exists public.case_time_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  phase text not null check (phase in ('intake', 'triage', 'evidence_packet', 'follow_up')),
  staff_name text not null check (char_length(trim(staff_name)) between 1 and 60),
  -- Tarifa CARGADA (sueldo + prestaciones estimadas), en MXN por hora.
  -- Mismos límites que lib/costos.ts — la base es la última línea de
  -- defensa si alguien se salta la validación del server action.
  hourly_rate_mxn numeric(8, 2) not null check (hourly_rate_mxn between 50 and 2000),
  minutes int not null check (minutes between 1 and 480),
  logged_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.case_time_logs enable row level security;

drop policy if exists "members select own org time logs" on public.case_time_logs;
create policy "members select own org time logs"
  on public.case_time_logs for select
  using (
    org_id = public.my_org_id()
  );

-- El insert exige que el caso también sea de la propia org: sin esto,
-- alguien con el UUID de un caso ajeno podría colgarle tiempo desde su
-- propia org.
drop policy if exists "members insert time logs in own org" on public.case_time_logs;
create policy "members insert time logs in own org"
  on public.case_time_logs for insert
  with check (
    org_id = public.my_org_id()
    and logged_by = auth.uid()
    and exists (
      select 1 from public.cases c
      where c.id = case_id and c.org_id = public.my_org_id()
    )
  );

-- Solo quien registró una entrada puede borrarla (para corregir un error
-- de captura). Sin update: corregir = borrar y volver a registrar.
drop policy if exists "loggers delete own time logs" on public.case_time_logs;
create policy "loggers delete own time logs"
  on public.case_time_logs for delete
  using (
    org_id = public.my_org_id()
    and logged_by = auth.uid()
  );
