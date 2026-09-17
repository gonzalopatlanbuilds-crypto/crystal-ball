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

-- "¿Cuál es mi org_id?" se necesita dentro de CASI todas las policies de
-- este archivo — se resuelve una sola vez aquí, no repitiendo el
-- subquery en cada policy. Es más que estilo: una policy de SELECT sobre
-- `profiles` que dentro de su propio USING vuelve a hacer
-- "select ... from profiles where id = auth.uid()" es una referencia
-- circular de la tabla a sí misma, y Postgres la rechaza en tiempo de
-- ejecución con "infinite recursion detected in policy for relation
-- profiles" — la fila nunca llega, y el cliente ve `data: null` con el
-- error ignorado si no se revisa `error` explícitamente (justo lo que
-- pasó: /onboarding creaba el perfil bien, pero "/" nunca lograba leerlo
-- de vuelta y mandaba siempre a /onboarding otra vez). SECURITY DEFINER
-- rompe el ciclo: esta función corre bypasseando RLS internamente, así
-- que la policy que la llama nunca vuelve a disparar su propia policy.
create or replace function public.my_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.my_org_id() from public;
grant execute on function public.my_org_id() to authenticated;

-- select: cualquier miembro ve los perfiles de su propia org — hace falta
-- para elegir "owner" al capturar un hallazgo (Feature 2) y para saber
-- quién más puede revisar una evidencia (Feature 4).
drop policy if exists "members select own org profiles" on public.profiles;
create policy "members select own org profiles"
  on public.profiles for select
  using (
    org_id = public.my_org_id()
  );

-- orgs: visible solo a quien ya es miembro (para mostrar el nombre de tu
-- propia escuela en el header). El join_code nunca se expone por esta vía
-- de todos modos: solo se valida dentro de join_org() (security definer),
-- nunca por select directo del cliente.
drop policy if exists "members select own org" on public.orgs;
create policy "members select own org"
  on public.orgs for select
  using (
    id = public.my_org_id()
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

-- ============================================================
-- Feature 2: findings — hallazgo crítico logueado por un coordinador
-- durante un simulacro, con acción correctiva y owner asignado.
-- ============================================================

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  scenario_label text not null check (char_length(scenario_label) between 1 and 160),
  description text not null check (char_length(description) between 1 and 2000),
  corrective_action text not null check (char_length(corrective_action) between 1 and 2000),
  deadline date not null,
  -- pending_review/approved/rejected llegan con las Features 3 y 4 — la
  -- columna existe desde ahora para no tener que migrar el status más
  -- tarde.
  status text not null default 'open' check (status in ('open', 'pending_review', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.findings enable row level security;

drop policy if exists "members select own org findings" on public.findings;
create policy "members select own org findings"
  on public.findings for select
  using (
    org_id = public.my_org_id()
  );

-- El insert exige, en el mismo WHERE, que quien loguea el hallazgo sea el
-- reporter (no se puede loguear en nombre de otro), que el org_id sea el
-- propio, y que el owner_id asignado pertenezca a esa misma organización
-- — así un coordinador no puede, ni por error de UI ni por request directo,
-- asignar el hallazgo a alguien fuera de su escuela.
drop policy if exists "members insert findings in own org" on public.findings;
create policy "members insert findings in own org"
  on public.findings for insert
  with check (
    reporter_id = auth.uid()
    and org_id = public.my_org_id()
    and exists (
      select 1 from public.profiles po
      where po.id = owner_id and po.org_id = findings.org_id
    )
  );

-- La única transición de estado que le toca a esta feature: el owner
-- manda su propio finding abierto (o rechazado, para un segundo intento)
-- a revisión al enviar evidencia de cierre. USING mira la fila vieja
-- (solo el owner, solo si estaba open/rejected), WITH CHECK mira la fila
-- nueva (debe quedar en pending_review, sin cambiar de owner). Ninguna
-- otra transición de estado es válida por esta vía — aprobar/rechazar
-- trae su propia policy en la Feature 4.
drop policy if exists "owner sends own finding to review" on public.findings;
create policy "owner sends own finding to review"
  on public.findings for update
  using (owner_id = auth.uid() and status in ('open', 'rejected'))
  with check (owner_id = auth.uid() and status = 'pending_review');

-- ============================================================
-- Feature 3: closures — evidencia de cierre (foto obligatoria) que envía
-- el owner de un finding, más las señales de consistencia: el flag de
-- mismo-día (regla fija, ver lib/closures.ts) y la nota asistiva de
-- visión por IA (lib/vision.ts) — ninguna de las dos bloquea ni
-- autoaprueba nada, son solo información para el verificador de la
-- Feature 4.
-- ============================================================

create table if not exists public.closures (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings (id) on delete cascade,
  -- Denormalizado a propósito: simplifica las policies de RLS de abajo
  -- (comparar org_id directo en vez de un join contra findings en cada
  -- policy) y hace la fila autocontenida para el aislamiento por
  -- Storage (ver bucket más abajo, mismo org_id en el path).
  org_id uuid not null references public.orgs (id) on delete cascade,
  closed_by uuid not null references auth.users (id) on delete cascade,
  photo_path text not null check (char_length(photo_path) > 0),
  description text not null check (char_length(description) between 1 and 1000),
  same_day_flag boolean not null,
  ai_note text,
  ai_label text default 'Análisis asistido por IA — apoyo, no veredicto',
  -- null hasta que la Feature 4 lo revise.
  verifier_id uuid references auth.users (id),
  decision text check (decision in ('approved', 'rejected')),
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.closures enable row level security;

drop policy if exists "members select own org closures" on public.closures;
create policy "members select own org closures"
  on public.closures for select
  using (
    org_id = public.my_org_id()
  );

-- El insert exige que quien cierra sea el owner del finding referenciado,
-- que el finding esté realmente abierto/rechazado (no se puede cerrar
-- dos veces algo que ya está en revisión o ya aprobado), y que el org_id
-- de la fila coincida con el del finding — este último es lo que hace
-- imposible fabricar una fila de closure con un org_id distinto al real
-- para intentar burlar el aislamiento de Storage.
drop policy if exists "owner inserts closure for own finding" on public.closures;
create policy "owner inserts closure for own finding"
  on public.closures for insert
  with check (
    closed_by = auth.uid()
    and org_id = public.my_org_id()
    and exists (
      select 1 from public.findings f
      where f.id = finding_id
        and f.owner_id = auth.uid()
        and f.org_id = closures.org_id
        and f.status in ('open', 'rejected')
    )
  );

-- Sin policy de update/delete todavía: la decisión del verificador
-- (aprobar/rechazar) llega con su propia policy, más estricta, en la
-- Feature 4 — incluyendo el trigger que hace imposible que el owner
-- apruebe su propio cierre a nivel de base de datos.

-- ============================================================
-- Storage: bucket privado para las fotos de evidencia. Nunca público —
-- se sirven siempre por URL firmada de corta duración (lib/storage.ts),
-- para que el aislamiento por organización cubra también la evidencia,
-- no solo las filas de las tablas.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('closure-evidence', 'closure-evidence', false)
on conflict (id) do nothing;

-- Convención de path: "<org_id>/<finding_id>/<closure_id>.<ext>" — el
-- primer segmento del path (storage.foldername) es siempre el org_id de
-- quien sube, así que comparar ese segmento contra el org_id del perfil
-- es suficiente para el mismo aislamiento que las tablas.
drop policy if exists "org members read own org evidence" on storage.objects;
create policy "org members read own org evidence"
  on storage.objects for select
  using (
    bucket_id = 'closure-evidence'
    and (storage.foldername(name))[1] = public.my_org_id()::text
  );

drop policy if exists "org members upload own org evidence" on storage.objects;
create policy "org members upload own org evidence"
  on storage.objects for insert
  with check (
    bucket_id = 'closure-evidence'
    and (storage.foldername(name))[1] = public.my_org_id()::text
  );

-- ============================================================
-- Feature 4: revisión del verificador independiente + inmutabilidad.
--
-- La regla central de todo el packet — "quien cierra un hallazgo nunca
-- puede también verificarlo" — se aplica DOS veces, a propósito:
--   1. La policy de update de `closures` de abajo ya exige que quien
--      revisa no sea el owner (vía RLS).
--   2. El trigger `closures_verificador_no_es_owner` de abajo vuelve a
--      exigir lo mismo dentro de la propia base de datos, sin depender de
--      RLS — así, aunque una policy tuviera un error algún día, la regla
--      sigue siendo imposible de romper. Es la pieza que el piso de
--      seguridad pide explícitamente "server-side, no solo escondido en
--      la UI": aquí está server-side dos veces.
-- ============================================================

drop policy if exists "non-owner reviews pending closure" on public.closures;
create policy "non-owner reviews pending closure"
  on public.closures for update
  using (
    decision is null
    and org_id = public.my_org_id()
    and exists (
      select 1 from public.findings f
      where f.id = finding_id and f.owner_id <> auth.uid()
    )
  )
  with check (
    verifier_id = auth.uid()
    and decision in ('approved', 'rejected')
    and reviewed_at is not null
  );

create or replace function public.closures_verificador_no_es_owner()
returns trigger
language plpgsql
as $$
declare
  v_owner_id uuid;
begin
  if new.decision is not null then
    select owner_id into v_owner_id from public.findings where id = new.finding_id;
    if new.verifier_id is null then
      raise exception 'Falta el verificador al decidir un cierre.';
    end if;
    if new.verifier_id = v_owner_id then
      raise exception 'El owner del hallazgo no puede verificar su propio cierre.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists closures_verificador_no_es_owner on public.closures;
create trigger closures_verificador_no_es_owner
  before insert or update on public.closures
  for each row execute function public.closures_verificador_no_es_owner();

-- El verificador (no-owner) puede mover el finding de pending_review a
-- approved/rejected — misma forma que la policy de update de la Feature 3
-- (USING mira la fila vieja, WITH CHECK la nueva), pero aquí exige lo
-- contrario en cuanto a identidad: NO puede ser el owner.
drop policy if exists "non-owner reviews pending finding" on public.findings;
create policy "non-owner reviews pending finding"
  on public.findings for update
  using (
    status = 'pending_review'
    and owner_id <> auth.uid()
    and org_id = public.my_org_id()
  )
  with check (
    status in ('approved', 'rejected')
    and owner_id <> auth.uid()
  );

-- Inmutabilidad real: una vez que un finding queda `approved`, este
-- trigger bloquea CUALQUIER update posterior — no solo los que pasan por
-- RLS, sino cualquier intento, incluyendo uno con la service role key.
-- "Inmutable a nivel de base de datos" significa literalmente esto: ni
-- siquiera el dueño del proyecto de Supabase puede editarlo por accidente
-- sin primero borrar el trigger.
create or replace function public.findings_inmutable_tras_aprobacion()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' then
    raise exception 'Un hallazgo aprobado es inmutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists findings_inmutable_tras_aprobacion on public.findings;
create trigger findings_inmutable_tras_aprobacion
  before update on public.findings
  for each row execute function public.findings_inmutable_tras_aprobacion();
