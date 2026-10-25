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

-- ============================================================
-- Feature 2: carga y versionado append-only.
-- La única puerta de escritura es registrar_version() (security definer).
-- La base vuelve a validar cada fila (aunque la server action ya lo hizo)
-- y calcula ella misma la huella del contenido: un cliente que llame al
-- RPC directo no puede saltarse la validación ni inventar la huella.
-- ============================================================

-- Orden exacto de las versiones dentro de una org. uploaded_at no basta:
-- dos inserciones en la misma transacción comparten now(), y el motor de
-- hallazgos (Feature 3) necesita saber cuál es la última sin empates.
alter table public.evidence_versions add column if not exists seq bigint generated always as identity;
create unique index if not exists evidence_versions_seq on public.evidence_versions (seq);
create index if not exists evidence_versions_org_seq on public.evidence_versions (org_id, seq);
-- true si las filas válidas son idénticas a la versión anterior de la org.
-- La calcula el trigger de inserción, nunca el cliente.
alter table public.evidence_versions add column if not exists identical_to_previous boolean not null default false;

-- Devuelve null si las filas son válidas; si no, el motivo.
create or replace function public.validar_filas_evidencia(p_rows jsonb, p_invalid jsonb)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  r jsonb;
  claves text[];
  vistos text[] := '{}';
  clave text;
  fecha date;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_typeof(p_invalid) is distinct from 'array' then
    return 'raw_rows e invalid_rows deben ser arreglos';
  end if;
  if jsonb_array_length(p_rows) < 1 then
    return 'una versión necesita al menos una fila válida';
  end if;
  if jsonb_array_length(p_rows) + jsonb_array_length(p_invalid) > 1000 then
    return 'más de 1000 filas';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) is distinct from 'object' then
      return 'cada fila debe ser un objeto';
    end if;
    select array_agg(k order by k) into claves from jsonb_object_keys(r) k;
    if claves is distinct from array['evidence_folio', 'fila', 'material', 'packaging_revision_date', 'sku', 'supplier', 'weight_g'] then
      return 'fila con columnas distintas a las esperadas';
    end if;
    -- Cada cast va en su propio `if`, después de revisar el tipo: SQL no
    -- garantiza el orden de evaluación de un `or`.
    if jsonb_typeof(r -> 'fila') is distinct from 'number' or (r ->> 'fila') !~ '^[0-9]{1,5}$' then
      return 'número de fila inválido';
    end if;
    if (r ->> 'fila')::int < 2 then
      return 'número de fila inválido';
    end if;
    if jsonb_typeof(r -> 'sku') is distinct from 'string' or (r ->> 'sku') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' then
      return 'sku inválido en la fila ' || (r ->> 'fila');
    end if;
    if jsonb_typeof(r -> 'supplier') is distinct from 'string' or char_length(btrim(r ->> 'supplier')) not between 1 and 120
       or (r ->> 'supplier') ~ '^[=+@-]' or (r ->> 'supplier') ~ '[\x01-\x08\x0b-\x1f\x7f]' then
      return 'supplier inválido en la fila ' || (r ->> 'fila');
    end if;
    if jsonb_typeof(r -> 'weight_g') is distinct from 'number' then
      return 'weight_g inválido en la fila ' || (r ->> 'fila');
    end if;
    if (r ->> 'weight_g')::numeric <= 0 or (r ->> 'weight_g')::numeric > 1000000 then
      return 'weight_g inválido en la fila ' || (r ->> 'fila');
    end if;
    if jsonb_typeof(r -> 'material') is distinct from 'string' or char_length(btrim(r ->> 'material')) not between 1 and 60
       or (r ->> 'material') ~ '^[=+@-]' or (r ->> 'material') ~ '[\x01-\x08\x0b-\x1f\x7f]' then
      return 'material inválido en la fila ' || (r ->> 'fila');
    end if;
    if jsonb_typeof(r -> 'packaging_revision_date') is distinct from 'string' or (r ->> 'packaging_revision_date') !~ '^\d{4}-\d{2}-\d{2}$' then
      return 'packaging_revision_date inválida en la fila ' || (r ->> 'fila');
    end if;
    begin
      fecha := (r ->> 'packaging_revision_date')::date;
    exception when others then
      return 'packaging_revision_date no existe en la fila ' || (r ->> 'fila');
    end;
    if to_char(fecha, 'YYYY-MM-DD') <> (r ->> 'packaging_revision_date') or fecha < date '2000-01-01' then
      return 'packaging_revision_date inválida en la fila ' || (r ->> 'fila');
    end if;
    if jsonb_typeof(r -> 'evidence_folio') is distinct from 'string' or (r ->> 'evidence_folio') !~ '^[A-Za-z0-9][A-Za-z0-9/._-]{0,63}$' then
      return 'evidence_folio inválido en la fila ' || (r ->> 'fila');
    end if;
    clave := lower(r ->> 'sku') || '|' || lower(r ->> 'supplier');
    if clave = any(vistos) then
      return 'SKU + proveedor repetido en la fila ' || (r ->> 'fila');
    end if;
    vistos := vistos || clave;
  end loop;

  for r in select * from jsonb_array_elements(p_invalid) loop
    -- `is distinct from`, no `<>`: si falta la clave, jsonb_typeof da NULL
    -- y `NULL <> 'string'` es NULL, que el `if` trata como falso (bug real
    -- encontrado por test:schema).
    if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r -> 'fila') is distinct from 'number'
       or jsonb_typeof(r -> 'motivo') is distinct from 'string'
       or char_length(r ->> 'motivo') not between 1 and 500 then
      return 'cada fila rechazada debe tener fila y motivo';
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.validar_filas_evidencia(jsonb, jsonb) from public, anon, authenticated;

-- Huella del contenido: sha256 de las filas sin su número de fila, en
-- orden canónico (el texto de jsonb ordena las claves). Mismos datos =
-- misma huella, aunque cambien el orden de filas o los saltos de línea.
create or replace function public.huella_evidencia(p_rows jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(coalesce(
    (select jsonb_agg(r - 'fila' order by (r - 'fila')::text) from jsonb_array_elements(p_rows) r),
    '[]'::jsonb)::text, 'UTF8')), 'hex');
$$;

revoke all on function public.huella_evidencia(jsonb) from public, anon, authenticated;

-- Append-only, también para el service role y el SQL Editor: ninguna
-- versión se edita ni se borra, nunca.
create or replace function public.evidencia_inmutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'evidence_versions es append-only: una versión no se edita ni se borra (sube una nueva).'
    using errcode = 'P0001';
end;
$$;

revoke all on function public.evidencia_inmutable() from public, anon, authenticated;

drop trigger if exists evidence_versions_sin_update_delete on public.evidence_versions;
create trigger evidence_versions_sin_update_delete
  before update or delete on public.evidence_versions
  for each row execute function public.evidencia_inmutable();

drop trigger if exists evidence_versions_sin_truncate on public.evidence_versions;
create trigger evidence_versions_sin_truncate
  before truncate on public.evidence_versions
  for each statement execute function public.evidencia_inmutable();

-- Toda inserción (por el RPC o desde el SQL Editor) pasa por la misma
-- validación y la misma huella.
create or replace function public.evidencia_validar_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_motivo text := public.validar_filas_evidencia(new.raw_rows, new.invalid_rows);
begin
  if v_motivo is not null then
    raise exception 'Versión rechazada: %', v_motivo using errcode = 'P0001';
  end if;
  new.content_sha256 := public.huella_evidencia(new.raw_rows);
  -- ¿Mismas filas que la última versión de la org? Se guarda igual (toda
  -- carga válida es una versión); la marca es lo que usa el motor de
  -- hallazgos (Feature 3) para no generar nada nuevo.
  new.identical_to_previous := coalesce((
    select e.content_sha256 = new.content_sha256 from public.evidence_versions e
      where e.org_id = new.org_id order by e.seq desc limit 1), false);
  return new;
end;
$$;

revoke all on function public.evidencia_validar_insert() from public, anon, authenticated;

drop trigger if exists evidence_versions_validar on public.evidence_versions;
create trigger evidence_versions_validar
  before insert on public.evidence_versions
  for each row execute function public.evidencia_validar_insert();

-- Guarda TODA carga válida como versión nueva, aunque sus filas sean
-- idénticas a la última (corrección del 2026-10-25, ver DECISIONS.md: el
-- packet dice que cada carga aceptada es una versión). Lo único que
-- cambia en una carga idéntica es la marca identical_to_previous.
-- drop: el tipo de retorno cambió respecto a la primera versión.
drop function if exists public.registrar_version(text, jsonb, jsonb, boolean);
create or replace function public.registrar_version(
  p_source_filename text,
  p_raw_rows jsonb,
  p_invalid_rows jsonb,
  p_is_example boolean
)
returns table (version_id uuid, identical_to_previous boolean, uploaded_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_org_id();
  v_id uuid;
  v_identica boolean;
  v_fecha timestamptz;
  v_motivo text;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Se requiere sesión y organización.' using errcode = 'P0001';
  end if;
  if p_raw_rows is null or p_invalid_rows is null or p_source_filename is null then
    raise exception 'Faltan datos de la carga.' using errcode = 'P0001';
  end if;
  -- Validar antes de tomar el candado: una carga inválida se rechaza sin
  -- hacer esperar a nadie.
  v_motivo := public.validar_filas_evidencia(p_raw_rows, p_invalid_rows);
  if v_motivo is not null then
    raise exception 'Versión rechazada: %', v_motivo using errcode = 'P0001';
  end if;

  -- Una carga a la vez por org: "¿idéntica a la última?" se decide sobre
  -- un orden fijo, sin que dos pestañas se crucen.
  perform pg_advisory_xact_lock(hashtext('carga:' || v_org::text));

  insert into public.evidence_versions (org_id, uploaded_by, source_filename, raw_rows, invalid_rows, content_sha256, is_example)
  values (v_org, auth.uid(), btrim(p_source_filename), p_raw_rows, p_invalid_rows, repeat('0', 64), coalesce(p_is_example, false))
  returning id, evidence_versions.identical_to_previous, evidence_versions.uploaded_at into v_id, v_identica, v_fecha;

  return query select v_id, v_identica, v_fecha;
end;
$$;

revoke all on function public.registrar_version(text, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.registrar_version(text, jsonb, jsonb, boolean) to authenticated;
