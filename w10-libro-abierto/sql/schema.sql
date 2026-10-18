-- Libro Abierto — schema
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
-- 3. Policies con `to authenticated` (o `to anon`) explícito: sin rol, anon
--    recibe "permission denied for my_org_id" en vez de [] (w08).

-- ============================================================
-- Feature 1: organizaciones (mismo patrón que w09). El operador es un
-- usuario con sesión dentro de una organización; no hay columna de rol.
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
-- Feature 1: tablas del modelo. Se crean desde ahora con RLS, aunque sus
-- pantallas lleguen en las Features 2–4: ninguna tabla existe ni un
-- minuto sin RLS.
-- ============================================================

do $$
begin
  create type public.assumption_status as enum ('sustained', 'weak', 'invented');
exception when duplicate_object then null;
end;
$$;

create table if not exists public.assumptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z_]{1,39}$'),
  value_num numeric(14, 4) not null,
  unit text not null check (char_length(unit) between 1 and 30),
  status public.assumption_status not null,
  source_url text check (source_url is null or char_length(source_url) between 1 and 500),
  source_date date,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, key)
);

alter table public.assumptions enable row level security;

drop policy if exists "members select own org assumptions" on public.assumptions;
create policy "members select own org assumptions"
  on public.assumptions for select
  to authenticated
  using (org_id = public.my_org_id());

drop policy if exists "members insert own org assumptions" on public.assumptions;
create policy "members insert own org assumptions"
  on public.assumptions for insert
  to authenticated
  with check (org_id = public.my_org_id());

drop policy if exists "members update own org assumptions" on public.assumptions;
create policy "members update own org assumptions"
  on public.assumptions for update
  to authenticated
  using (org_id = public.my_org_id())
  with check (org_id = public.my_org_id());

drop policy if exists "members delete own org assumptions" on public.assumptions;
create policy "members delete own org assumptions"
  on public.assumptions for delete
  to authenticated
  using (org_id = public.my_org_id());

revoke all on public.assumptions from anon;

create table if not exists public.payer_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 40),
  description text not null check (char_length(trim(description)) between 1 and 1000),
  document_ref text not null check (char_length(trim(document_ref)) between 1 and 300),
  -- Quién la registró: lo pone la base (default auth.uid()), el cliente no
  -- puede escribir la columna (ver grants abajo).
  recorded_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recorded_on date not null,
  created_at timestamptz not null default now()
);

alter table public.payer_evidence enable row level security;

drop policy if exists "members select own org evidence" on public.payer_evidence;
create policy "members select own org evidence"
  on public.payer_evidence for select
  to authenticated
  using (org_id = public.my_org_id());

drop policy if exists "members insert own org evidence" on public.payer_evidence;
create policy "members insert own org evidence"
  on public.payer_evidence for insert
  to authenticated
  with check (org_id = public.my_org_id() and recorded_by = auth.uid());

revoke all on public.payer_evidence from anon;
revoke insert, update, delete on public.payer_evidence from authenticated;
grant insert (org_id, kind, description, document_ref, recorded_on)
  on public.payer_evidence to authenticated;

create table if not exists public.published_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  version int not null check (version >= 1),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  published_at timestamptz not null default now(),
  unique (org_id, version)
);

alter table public.published_ledger enable row level security;

-- La única tabla que lee anon: es el libro público. No lleva datos
-- personales (ver Feature 4).
drop policy if exists "anon reads published ledger" on public.published_ledger;
create policy "anon reads published ledger"
  on public.published_ledger for select
  to anon
  using (true);

drop policy if exists "members select own org ledger" on public.published_ledger;
create policy "members select own org ledger"
  on public.published_ledger for select
  to authenticated
  using (org_id = public.my_org_id());

-- Nada escribe todavía; la puerta de publicación llega en la Feature 4.
revoke all on public.published_ledger from anon;
revoke insert, update, delete, truncate on public.published_ledger from authenticated;
grant select on public.published_ledger to anon, authenticated;
