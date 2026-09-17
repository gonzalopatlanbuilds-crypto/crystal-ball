-- Evidencia PC — schema
-- Corre esto completo en el SQL Editor de tu proyecto de Supabase
-- (Project → SQL Editor → New query → pega y ejecuta).

-- ============================================================
-- Feature 1: auth + organizaciones — Google Auth ya administra auth.users
-- desde el dashboard (Authentication → Providers), no desde SQL.
--
-- orgs/profiles son el mecanismo real de aislamiento multi-tenant: todo lo
-- que se guarde después (findings, closures, evidencia en Storage) se
-- filtra por profiles.org_id, nunca por auth.uid() directo, para que "mi
-- propia organización escolar" sea una noción real y no solo "mis propios
-- registros" (que sería insuficiente: dos owners de la misma escuela deben
-- poder ver los hallazgos del otro).
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

-- select: cualquier miembro ve los perfiles de su propia org — hace falta
-- para elegir "owner" al capturar un hallazgo (Feature 2) y para saber
-- quién más puede revisar una evidencia (Feature 4).
drop policy if exists "members select own org profiles" on public.profiles;
create policy "members select own org profiles"
  on public.profiles for select
  using (
    org_id = (select p.org_id from public.profiles p where p.id = auth.uid())
  );

-- orgs: visible solo a quien ya es miembro (para mostrar el nombre de tu
-- propia escuela en el header). El join_code nunca se expone por esta vía
-- de todos modos: solo se valida dentro de join_org() (security definer),
-- nunca por select directo del cliente.
drop policy if exists "members select own org" on public.orgs;
create policy "members select own org"
  on public.orgs for select
  using (
    id = (select p.org_id from public.profiles p where p.id = auth.uid())
  );

-- A propósito, ninguna policy de insert/update/delete en orgs/profiles:
-- las dos funciones security definer de abajo son la única puerta de
-- escritura, para que "crear org" y "unirme a una org" sea la única forma
-- de que exista una fila de profile — nunca un insert directo del cliente
-- que pudiera, por ejemplo, meter a alguien en la org de otra persona.

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

  return query select v_org_id, v_code;
end;
$$;

revoke all on function public.create_org(text) from public;
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

revoke all on function public.join_org(text) from public;
grant execute on function public.join_org(text) to authenticated;
