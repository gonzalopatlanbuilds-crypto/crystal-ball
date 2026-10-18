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

  -- Feature 2: los 7 supuestos de ejemplo del mockup, todos 'invented'
  -- (sembrar_supuestos() está más abajo; plpgsql la resuelve al ejecutar).
  perform public.sembrar_supuestos(v_org_id);

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

-- ============================================================
-- Feature 2: registro de supuestos.
-- ============================================================

-- Regla central: un supuesto "sustained" necesita URL y fecha de su fuente.
-- "weak" e "invented" pueden omitirlas. Misma regla que
-- lib/supuestos.ts (validarSupuesto); aquí aplica a CUALQUIER camino
-- (API con la llave pública, SQL Editor, service role).
do $$
begin
  alter table public.assumptions
    add constraint assumptions_sustained_needs_source
    check (status <> 'sustained' or (source_url is not null and source_date is not null));
exception when duplicate_object then null;
end;
$$;

-- Solo las claves del catálogo (lib/supuestos.ts, CATALOGO), cada una con
-- su unidad: el modelo (Feature 3) depende de ellas.
do $$
begin
  alter table public.assumptions
    add constraint assumptions_key_unit_catalog
    check ((key, unit) in (
      ('estudiantes_anio', 'estudiantes/año'),
      ('horas_mantenimiento_mes', 'horas/mes'),
      ('costo_hora', 'MXN/hora'),
      ('conversion_suscripcion', '%'),
      ('precio_mensual', 'MXN/mes'),
      ('costo_correcciones_mes', 'MXN/mes'),
      ('costo_infraestructura_mes', 'MXN/mes'),
      ('perdida_evitada_suscriptor_anio', 'MXN/suscriptor/año')
    ));
exception when duplicate_object then null;
end;
$$;

-- Rango cerrado y no solo ">= 0": en Postgres NaN es mayor que cualquier
-- número, así que `check (value_num >= 0)` dejaba pasar NaN (lo encontró
-- test:schema). El máximo es el más alto del catálogo (lib/supuestos.ts).
do $$
begin
  alter table public.assumptions
    add constraint assumptions_value_range check (value_num >= 0 and value_num <= 10000000);
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.assumptions
    add constraint assumptions_source_url_http
    check (source_url is null or source_url ~ '^https?://[^[:space:]]+$');
exception when duplicate_object then null;
end;
$$;

-- updated_at lo pone la base, no el cliente.
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.tocar_updated_at() from public, anon, authenticated;

drop trigger if exists tocar_updated_at on public.assumptions;
create trigger tocar_updated_at
  before update on public.assumptions
  for each row execute function public.tocar_updated_at();

-- Privilegios por columna: el cliente no escribe id, created_at ni
-- updated_at, y en un update no puede cambiar la clave ni la org (editar
-- cambia el valor, no qué supuesto es).
revoke insert, update, truncate, references, trigger on public.assumptions from authenticated;
grant select, delete on public.assumptions to authenticated;
grant insert (org_id, key, value_num, unit, status, source_url, source_date, note)
  on public.assumptions to authenticated;
grant update (value_num, unit, status, source_url, source_date, note)
  on public.assumptions to authenticated;

-- Valores del mockup, TODOS 'invented'. `on conflict do nothing`: nunca
-- pisa un supuesto que ya existe ni revive uno con otro valor.
create or replace function public.sembrar_supuestos(p_org_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  insert into public.assumptions (org_id, key, value_num, unit, status, note)
  values
    (p_org_id, 'estudiantes_anio', 2000, 'estudiantes/año', 'invented', 'Valor de ejemplo del mockup (simulado).'),
    (p_org_id, 'horas_mantenimiento_mes', 40, 'horas/mes', 'invented', 'Valor de ejemplo del mockup (simulado).'),
    (p_org_id, 'costo_hora', 150, 'MXN/hora', 'invented', 'Valor de ejemplo del mockup (simulado).'),
    (p_org_id, 'conversion_suscripcion', 3, '%', 'invented', 'Valor de ejemplo del mockup (simulado).'),
    (p_org_id, 'precio_mensual', 49, 'MXN/mes', 'invented', 'Valor de ejemplo del mockup (simulado).'),
    (p_org_id, 'costo_correcciones_mes', 1000, 'MXN/mes', 'invented', 'Valor de ejemplo del mockup (simulado).'),
    (p_org_id, 'costo_infraestructura_mes', 500, 'MXN/mes', 'invented', 'Valor de ejemplo del mockup (simulado).')
  on conflict (org_id, key) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Interna: recibe un org_id arbitrario, así que nadie la llama directo.
revoke all on function public.sembrar_supuestos(uuid) from public, anon, authenticated;

-- RPC del botón "Cargar valores de ejemplo": solo en la org propia. Sirve
-- para orgs creadas antes de la Feature 2 y para volver a cargar los que
-- se borraron (los que existen no se tocan).
create or replace function public.sembrar_supuestos_ejemplo()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_org_id();
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Se requiere sesión y organización.';
  end if;
  return public.sembrar_supuestos(v_org);
end;
$$;

revoke all on function public.sembrar_supuestos_ejemplo() from public, anon;
grant execute on function public.sembrar_supuestos_ejemplo() to authenticated;

-- ============================================================
-- Feature 4: evidencia de pagador, compuerta de viabilidad, publicar y
-- libro público.
-- ============================================================

-- Organización oficial: la única cuyo libro se publica y se muestra en
-- /financiamiento. El cliente no tiene ningún privilegio de escritura en
-- organizations (Feature 1) y create_org() no toca esta columna, así que
-- solo se cambia desde el SQL Editor.
alter table public.organizations
  add column if not exists es_oficial boolean not null default false;

-- Tipos de evidencia: lista cerrada (lib/pagador.ts). Ningún tipo es
-- comisión, afiliado ni referido (Condición 5).
do $$
begin
  alter table public.payer_evidence
    add constraint payer_evidence_kind_list
    check (kind in ('carta_intencion', 'convenio_firmado', 'pago_recibido', 'presupuesto_aprobado', 'otro'));
exception when duplicate_object then null;
end;
$$;

-- La fecha del documento no puede ser futura (un día de margen por zona
-- horaria, igual que lib/pagador.ts) ni absurda.
do $$
begin
  alter table public.payer_evidence
    add constraint payer_evidence_recorded_on_range
    check (recorded_on >= date '1990-01-01' and recorded_on <= current_date + 1);
exception when duplicate_object then null;
end;
$$;

-- La evidencia no se edita ni se borra desde la app: es un registro. Una
-- corrección es un registro nuevo.
revoke update, delete, truncate on public.payer_evidence from authenticated;

-- ---------- Viabilidad, calculada también en SQL ----------
-- Misma regla que lib/viabilidad.ts. La base NO confía en el valor que
-- manda el servidor: lo recalcula y rechaza si no coincide.
--   NOT_DEMONSTRATED: no hay evidencia de pagador.
--   EVIDENCE_RECORDED_NOT_SUPPORTED: hay evidencia, pero falta algún
--     insumo, alguno no está sustentado, o el 10:1 no se cumple.
--   SUPPORTED: evidencia + los 8 insumos sustentados + 10:1 cumplido.
-- 10:1 en numeric exacto: pérdida evitada >= 10 × precio mensual × 12.
create or replace function public.estado_viabilidad(p_org_id uuid)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_sustentados int;
  v_perdida numeric;
  v_precio numeric;
begin
  if not exists (select 1 from public.payer_evidence where org_id = p_org_id) then
    return 'NOT_DEMONSTRATED';
  end if;

  select count(*) into v_sustentados
    from public.assumptions
    where org_id = p_org_id and status = 'sustained'
      and key in ('estudiantes_anio', 'horas_mantenimiento_mes', 'costo_hora', 'conversion_suscripcion',
                  'precio_mensual', 'costo_correcciones_mes', 'costo_infraestructura_mes',
                  'perdida_evitada_suscriptor_anio');
  select value_num into v_perdida from public.assumptions
    where org_id = p_org_id and key = 'perdida_evitada_suscriptor_anio';
  select value_num into v_precio from public.assumptions
    where org_id = p_org_id and key = 'precio_mensual';

  if v_sustentados = 8
     and v_perdida is not null and v_precio is not null and v_precio > 0
     and v_perdida >= 10 * v_precio * 12 then
    return 'SUPPORTED';
  end if;
  return 'EVIDENCE_RECORDED_NOT_SUPPORTED';
end;
$$;

-- Interna: recibe un org_id arbitrario. Solo la usa el trigger de abajo.
revoke all on function public.estado_viabilidad(uuid) from public, anon, authenticated;

-- ---------- published_ledger: columnas de la Feature 4 ----------
alter table public.published_ledger
  add column if not exists viability text not null default 'NOT_DEMONSTRATED';
-- Copia de organizations.es_oficial: anon no puede leer organizations, así
-- que su policy filtra por esta columna. La mantiene sincronizada el
-- trigger sincronizar_oficial (abajo); el cliente no la escribe.
alter table public.published_ledger
  add column if not exists oficial boolean not null default false;

do $$
begin
  alter table public.published_ledger
    add constraint published_ledger_viability_list
    check (viability in ('NOT_DEMONSTRATED', 'EVIDENCE_RECORDED_NOT_SUPPORTED', 'SUPPORTED'));
exception when duplicate_object then null;
end;
$$;

-- El estado dentro del snapshot debe ser el mismo que el de la columna.
-- `is not distinct from` y no `=`: con `=`, un snapshot SIN la clave
-- `viabilidad` daba NULL y un check con NULL pasa (bug encontrado en el
-- ajuste de la Feature 4). Se borra y se vuelve a crear en cada corrida
-- para reemplazar la versión con `=` en bases que ya la tienen.
alter table public.published_ledger drop constraint if exists published_ledger_viability_matches_content;
alter table public.published_ledger
  add constraint published_ledger_viability_matches_content
  check ((content ->> 'viabilidad') is not distinct from viability);

-- Sin datos personales: ningún correo dentro del snapshot, y tamaño
-- acotado (un snapshot legítimo pesa unos pocos KB).
do $$
begin
  alter table public.published_ledger
    add constraint published_ledger_no_email
    check (content::text !~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z0-9.-]+');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.published_ledger
    add constraint published_ledger_content_size
    check (pg_column_size(content) <= 65536);
exception when duplicate_object then null;
end;
$$;

-- Puerta de publicación. Corre ANTES de insertar, venga de donde venga (API
-- con la llave pública, service role, SQL Editor):
-- 1. la org debe ser oficial;
-- 2. el estado de viabilidad debe ser el que calcula la base;
-- 3. versión, fecha y `oficial` los pone la base, no el cliente.
create or replace function public.validar_publicacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_oficial boolean;
  v_esperado text;
  v_registros int;
  v_simuladas int;
begin
  -- (Ajuste: también revisa los conteos de evidencia, ver abajo.)
  -- Lock de la fila de la org: dos publicaciones simultáneas no pueden
  -- recibir la misma versión.
  select es_oficial into v_oficial from public.organizations where id = new.org_id for update;
  if v_oficial is null then
    raise exception 'Organización no encontrada.';
  end if;
  if not v_oficial then
    raise exception 'Solo la organización oficial puede publicar el libro.' using errcode = 'P0001';
  end if;

  v_esperado := public.estado_viabilidad(new.org_id);
  if new.viability is distinct from v_esperado then
    raise exception 'Estado de viabilidad inválido: la base calcula %.', v_esperado using errcode = 'P0001';
  end if;

  select count(*), count(*) filter (where simulada) into v_registros, v_simuladas
    from public.payer_evidence where org_id = new.org_id;
  if (new.content -> 'evidencia_pagador' ->> 'registros') is distinct from v_registros::text
     or (new.content -> 'evidencia_pagador' ->> 'simuladas') is distinct from v_simuladas::text then
    raise exception 'El snapshot no coincide con la evidencia registrada (% registros, % simuladas).',
      v_registros, v_simuladas using errcode = 'P0001';
  end if;

  select coalesce(max(version), 0) + 1 into new.version
    from public.published_ledger where org_id = new.org_id;
  new.published_at := now();
  new.oficial := true;
  return new;
end;
$$;

revoke all on function public.validar_publicacion() from public, anon, authenticated;

drop trigger if exists validar_publicacion on public.published_ledger;
create trigger validar_publicacion
  before insert on public.published_ledger
  for each row execute function public.validar_publicacion();

-- Inmutable: ni update ni delete ni truncate, para nadie. La única
-- excepción es la columna `oficial` cuando la cambia sincronizar_oficial
-- (pg_trigger_depth() > 1 = dentro de otro trigger).
create or replace function public.libro_inmutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and new.id = old.id and new.org_id = old.org_id and new.version = old.version
     and new.content = old.content and new.viability = old.viability
     and new.published_at = old.published_at then
    return new;
  end if;
  raise exception 'El libro publicado es inmutable: publica una versión nueva.' using errcode = 'P0001';
end;
$$;

revoke all on function public.libro_inmutable() from public, anon, authenticated;

drop trigger if exists libro_inmutable on public.published_ledger;
create trigger libro_inmutable
  before update or delete on public.published_ledger
  for each row execute function public.libro_inmutable();

drop trigger if exists libro_inmutable_truncate on public.published_ledger;
create trigger libro_inmutable_truncate
  before truncate on public.published_ledger
  for each statement execute function public.libro_inmutable();

-- Si una org deja de ser oficial (o lo vuelve a ser), sus snapshots salen
-- (o vuelven) de la vista pública.
create or replace function public.sincronizar_oficial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.es_oficial is distinct from old.es_oficial then
    update public.published_ledger set oficial = new.es_oficial where org_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sincronizar_oficial() from public, anon, authenticated;

drop trigger if exists sincronizar_oficial on public.organizations;
create trigger sincronizar_oficial
  after update of es_oficial on public.organizations
  for each row execute function public.sincronizar_oficial();

-- Publicar: el cliente solo manda org_id, viability y content.
drop policy if exists "members insert own org ledger" on public.published_ledger;
create policy "members insert own org ledger"
  on public.published_ledger for insert
  to authenticated
  with check (org_id = public.my_org_id());

revoke insert, update, delete, truncate on public.published_ledger from authenticated;
grant insert (org_id, viability, content) on public.published_ledger to authenticated;

-- anon ve SOLO snapshots de organizaciones oficiales (reemplaza la policy
-- `using (true)` de la Feature 1).
drop policy if exists "anon reads published ledger" on public.published_ledger;
create policy "anon reads published ledger"
  on public.published_ledger for select
  to anon
  using (oficial);

-- ============================================================
-- Feature 4 (ajuste): marca de datos simulados en cada snapshot nuevo.
-- ============================================================

-- Si la evidencia es simulada. Default true: en este proyecto todo dato es
-- inventado (piso de seguridad), así que SIM-001 y cualquier fila anterior
-- quedan marcadas como simuladas al agregar la columna. La app no ofrece
-- cómo cambiarla: una evidencia real tendría que marcarse a mano en el SQL
-- Editor, a propósito. El cliente no puede escribirla (no está en el
-- grant de insert de payer_evidence).
alter table public.payer_evidence
  add column if not exists simulada boolean not null default true;

-- Todo snapshot NUEVO lleva la marca de datos simulados y dice cuántas de
-- sus evidencias son simuladas. NOT VALID: no se revisan los snapshots ya
-- publicados (v1 es inmutable y se publicó antes de esta regla).
-- Sin NULL posibles (un check con NULL pasa): si falta la clave, coalesce
-- da false y se rechaza.
alter table public.published_ledger drop constraint if exists published_ledger_marca_simulados;
alter table public.published_ledger
  add constraint published_ledger_marca_simulados
  check (
    coalesce(content ->> 'datos_simulados' = 'true', false)
    and coalesce(jsonb_typeof(content -> 'evidencia_pagador' -> 'simuladas') = 'number', false)
  ) not valid;

-- (validar_publicacion, en la sección de la Feature 4, ahora también exige
-- que los conteos de evidencia del snapshot sean los de la base.)
