-- Validador de Evidencia de Empaque — schema
-- Corre esto completo en el SQL Editor de tu proyecto de Supabase
-- (Project → SQL Editor → New query → pega y ejecuta). Es idempotente:
-- se puede volver a correr entero sin romper nada.
--
-- Reglas aprendidas en semanas anteriores, aplicadas desde el inicio:
-- 1. Ninguna policy de `profiles` consulta `profiles` (recursión infinita,
--    bug real de w06): todas usan my_org_id(), security definer.
-- 2. Supabase da EXECUTE a anon/authenticated por default privileges en
--    funciones nuevas de `public`: revocar solo de `public` NO basta (bug
--    real de w08). Toda función revoca de `public, anon` explícitamente y
--    solo concede a `authenticated` si es un RPC.
-- 3. Policies con `to authenticated` explícito: sin rol, anon recibe
--    "permission denied for my_org_id" en vez de [] (w08).

-- ============================================================
-- Feature 1: organizaciones (mismo patrón que w09/w10). Quien carga y
-- quien revisa son usuarios con sesión dentro de la misma organización;
-- no hay columna de rol.
-- ============================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  join_code text not null unique check (join_code ~ '^[A-Z2-9]{3}-[A-Z2-9]{3}$'),
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- SECURITY DEFINER a propósito: rompe el ciclo de RLS de profiles.
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
  to authenticated
  using (org_id = public.my_org_id());

drop policy if exists "members select own org" on public.organizations;
create policy "members select own org"
  on public.organizations for select
  to authenticated
  using (id = public.my_org_id());

-- Sin policies de escritura en organizations/profiles: create_org() y
-- join_org() (security definer) son la única puerta.
revoke all on public.organizations, public.profiles from anon;
revoke insert, update, delete, truncate on public.organizations, public.profiles from authenticated;

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
      insert into public.organizations (name, join_code) values (trim(p_name), v_code)
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

  return query select v_org_id, v_code;
end;
$$;

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

  select o.id into v_org_id from public.organizations o where o.join_code = upper(trim(p_join_code));
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
-- Feature 1: tablas de evidencia, hallazgos y decisiones. Se crean desde
-- ahora con RLS y solo lectura dentro de la propia org; las puertas de
-- escritura llegan con su feature (carga en la 2, hallazgos en la 3,
-- decisiones en la 4). Hasta entonces el cliente no escribe nada.
-- ============================================================

-- Cada carga aceptada es una fila nueva. Nunca se actualiza ni se borra
-- (Feature 2 agrega el trigger que lo impide).
create table if not exists public.evidence_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id),
  uploaded_at timestamptz not null default now(),
  source_filename text not null check (char_length(source_filename) between 1 and 200),
  -- Filas válidas, cada una con su número de fila en el archivo original
  -- (procedencia: archivo + fila + quién + cuándo).
  raw_rows jsonb not null check (jsonb_typeof(raw_rows) = 'array'),
  -- Filas rechazadas con su motivo: se reportan, nunca se tiran en silencio.
  invalid_rows jsonb not null default '[]'::jsonb check (jsonb_typeof(invalid_rows) = 'array'),
  -- sha256 del contenido normalizado: detecta una recarga idéntica.
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  is_example boolean not null default false
);

alter table public.evidence_versions enable row level security;
create index if not exists evidence_versions_org_fecha on public.evidence_versions (org_id, uploaded_at);

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  evidence_version_id uuid not null references public.evidence_versions (id) on delete cascade,
  type text not null check (type in ('missing_supplier', 'value_conflict', 'late_revision', 'possible_duplicate')),
  sku text not null check (char_length(sku) between 1 and 64),
  supplier text check (char_length(supplier) between 1 and 120),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'discarded')),
  created_at timestamptz not null default now()
);

alter table public.findings enable row level security;
create index if not exists findings_org_status on public.findings (org_id, status);

-- Una fila por decisión. Un cambio de opinión es una fila nueva que apunta
-- al mismo hallazgo (Feature 4 agrega la inmutabilidad y la puerta).
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  finding_id uuid not null references public.findings (id) on delete cascade,
  decided_by uuid not null references auth.users (id),
  decision text not null check (decision in ('confirmed', 'discarded')),
  note text not null check (char_length(btrim(note)) between 1 and 1000),
  decided_at timestamptz not null default now()
);

alter table public.decisions enable row level security;
create index if not exists decisions_finding on public.decisions (finding_id, decided_at);

drop policy if exists "members select own org versions" on public.evidence_versions;
create policy "members select own org versions"
  on public.evidence_versions for select
  to authenticated
  using (org_id = public.my_org_id());

drop policy if exists "members select own org findings" on public.findings;
create policy "members select own org findings"
  on public.findings for select
  to authenticated
  using (org_id = public.my_org_id());

drop policy if exists "members select own org decisions" on public.decisions;
create policy "members select own org decisions"
  on public.decisions for select
  to authenticated
  using (org_id = public.my_org_id());

-- RLS más privilegios: si alguien apagara el RLS de una tabla por error,
-- anon seguiría sin leerla, y authenticated sin escribirla.
revoke all on public.evidence_versions, public.findings, public.decisions from anon;
revoke insert, update, delete, truncate on public.evidence_versions, public.findings, public.decisions from authenticated;
