-- First Proof — schema
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

-- ============================================================
-- Feature 1: organizaciones piloto (mismo patrón que w06/w08).
-- Candidato y revisor son solo dos usuarios con sesión dentro de la misma
-- organización piloto; no hay columna de "rol".
-- ============================================================

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  join_code text not null unique check (join_code ~ '^[A-Z2-9]{3}-[A-Z2-9]{3}$'),
  -- Contador de seudónimos A-01, A-02… por organización. Nunca se reusa un
  -- número, ni siquiera si el candidato borra su expediente: un seudónimo
  -- reciclado podría hacer que un revisor confunda dos personas.
  next_pseudonym int not null default 1 check (next_pseudonym >= 1),
  created_at timestamptz not null default now()
);

alter table public.orgs enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  email text not null,
  display_name text,
  -- Contador de intentos por candidato (submissions.attempt_number). Igual
  -- que next_pseudonym: nunca se reusa un número, aunque se borre una
  -- entrega. Sin policy de update en profiles, el cliente no puede tocarlo.
  next_attempt int not null default 1 check (next_attempt >= 1),
  created_at timestamptz not null default now()
);

-- Para bases creadas antes de existir la columna.
alter table public.profiles
  add column if not exists next_attempt int not null default 1 check (next_attempt >= 1);

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

-- Ver perfiles de la misma org es necesario para mostrar en el expediente
-- quién revisó. No rompe el ciego: el revisor nunca recibe el candidate_id
-- de una entrega (ver blind_*), así que no puede ligar un perfil a un
-- seudónimo.
drop policy if exists "members select own org profiles" on public.profiles;
create policy "members select own org profiles"
  on public.profiles for select
  to authenticated
  using (org_id = public.my_org_id());

drop policy if exists "members select own org" on public.orgs;
create policy "members select own org"
  on public.orgs for select
  to authenticated
  using (id = public.my_org_id());

-- Sin policies de escritura en orgs/profiles: create_org() y join_org()
-- (security definer) son la única puerta.

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
-- Piso de seguridad (antes de la Feature 2): `submissions` y `reviews`
-- se crean desde ahora, con RLS, la función ciega y el trigger
-- revisor ≠ candidato, aunque las pantallas lleguen en las Features 2–4.
--
-- El caso ficticio y las respuestas correctas viven en código
-- (lib/caso.ts), no aquí: el chequeo automático se calcula al leer, con
-- una sola fuente de verdad.
-- ============================================================

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  -- Lo asigna el trigger asignar_seudonimo(); el cliente no puede elegirlo.
  pseudonym text not null check (pseudonym ~ '^A-[0-9]{2,}$'),
  -- Intento 1, 2, 3… de este candidato en esta org. Lo asigna el mismo
  -- trigger desde profiles.next_attempt; el cliente no tiene permiso de
  -- escribir la columna.
  attempt_number int not null check (attempt_number >= 1),
  -- Mismos límites que lib/validacion.ts: la base es la última línea de
  -- defensa si alguien se salta el server action.
  answer_growth numeric(9, 2) check (answer_growth between -1000 and 1000),
  answer_margin numeric(9, 2) check (answer_margin between -1000 and 1000),
  answer_dso numeric(9, 2) check (answer_dso between 0 and 3650),
  explanation text not null check (char_length(trim(explanation)) between 80 and 800),
  -- Observaciones preparadas por IA (Feature 3): arreglo JSON de
  -- {id, texto}. Null = la llamada falló o se descartó; la entrega sigue
  -- siendo válida sin ellas.
  ai_observations jsonb check (ai_observations is null or jsonb_typeof(ai_observations) = 'array'),
  status text not null default 'pending_review' check (status in ('pending_review', 'reviewed')),
  created_at timestamptz not null default now(),
  unique (org_id, pseudonym)
);

alter table public.submissions enable row level security;

-- Migración de attempt_number para bases que ya tenían entregas: se
-- numeran por candidato en orden de creación y el contador del perfil
-- queda después del último. Idempotente: en una base nueva o ya migrada no
-- cambia nada.
alter table public.submissions add column if not exists attempt_number int;

update public.submissions s
  set attempt_number = x.n
  from (
    select id, row_number() over (partition by candidate_id, org_id order by created_at, id) as n
    from public.submissions
  ) x
  where s.id = x.id and s.attempt_number is null;

alter table public.submissions alter column attempt_number set not null;

do $$
begin
  alter table public.submissions
    add constraint submissions_attempt_number_check check (attempt_number >= 1);
exception when duplicate_object then null;
end;
$$;

create unique index if not exists submissions_candidate_attempt_key
  on public.submissions (org_id, candidate_id, attempt_number);

update public.profiles p
  set next_attempt = m.siguiente
  from (
    select candidate_id, org_id, max(attempt_number) + 1 as siguiente
    from public.submissions
    group by candidate_id, org_id
  ) m
  where p.id = m.candidate_id and p.org_id = m.org_id and p.next_attempt < m.siguiente;

create or replace function public.asignar_seudonimo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  v_intento int;
begin
  -- UPDATE ... RETURNING toma lock de la fila de la org: dos entregas
  -- simultáneas no pueden recibir el mismo número.
  update public.orgs set next_pseudonym = next_pseudonym + 1
    where id = new.org_id
    returning next_pseudonym - 1 into v_n;
  if v_n is null then
    raise exception 'Organización no encontrada.';
  end if;

  -- Lo mismo con el perfil del candidato: dos envíos simultáneos de la
  -- misma persona no pueden quedar con el mismo intento. Si el perfil no es
  -- de esa org, no hay fila que actualizar y se rechaza.
  update public.profiles set next_attempt = next_attempt + 1
    where id = new.candidate_id and org_id = new.org_id
    returning next_attempt - 1 into v_intento;
  if v_intento is null then
    raise exception 'El candidato no pertenece a esta organización.';
  end if;

  new.pseudonym := 'A-' || lpad(v_n::text, 2, '0');
  new.attempt_number := v_intento;
  new.status := 'pending_review';
  return new;
end;
$$;

revoke all on function public.asignar_seudonimo() from public, anon, authenticated;

drop trigger if exists asignar_seudonimo on public.submissions;
create trigger asignar_seudonimo
  before insert on public.submissions
  for each row execute function public.asignar_seudonimo();

-- Un candidato ve SOLO sus propias entregas. El revisor no tiene ninguna
-- policy de select aquí: lee únicamente a través de blind_*().
drop policy if exists "candidates select own submissions" on public.submissions;
create policy "candidates select own submissions"
  on public.submissions for select
  to authenticated
  using (candidate_id = auth.uid() and org_id = public.my_org_id());

drop policy if exists "candidates insert own submissions" on public.submissions;
create policy "candidates insert own submissions"
  on public.submissions for insert
  to authenticated
  with check (candidate_id = auth.uid() and org_id = public.my_org_id());

-- "El candidato puede borrar todo en cualquier momento": borrar la entrega
-- borra su revisión por cascada, y el expediente se arma al leer, así que
-- deja de existir con ellas.
drop policy if exists "candidates delete own submissions" on public.submissions;
create policy "candidates delete own submissions"
  on public.submissions for delete
  to authenticated
  using (candidate_id = auth.uid());

-- Privilegios por columna: el candidato solo puede escribir sus respuestas
-- y su explicación. ai_observations y status no se pueden insertar ni
-- editar desde el cliente — si no, alguien podría fabricar "observaciones
-- de IA" a su favor con la llave pública. Las escribe el servidor
-- (Feature 3) y el trigger de reviews.
revoke insert, update on public.submissions from anon, authenticated;
grant insert (org_id, candidate_id, answer_growth, answer_margin, answer_dso, explanation)
  on public.submissions to authenticated;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  -- Una revisión por entrega; borrar la entrega la borra.
  submission_id uuid not null unique references public.submissions (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  -- {"<id de observación>": "confirmada" | "descartada"}
  observation_decisions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(observation_decisions) = 'object'),
  conflict_declaration text not null check (char_length(trim(conflict_declaration)) between 1 and 200),
  -- A propósito NO existe "rechazar": este slice nunca cierra una puerta.
  recommendation text not null check (recommendation in ('conversar', 'mas_evidencia')),
  note text not null check (char_length(trim(note)) between 1 and 400),
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

-- Defensa en profundidad: aunque la única puerta sea submit_review(), el
-- trigger rechaza cualquier revisión cuyo revisor sea el candidato o que
-- cruce organizaciones, venga de donde venga.
create or replace function public.validar_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidato uuid;
  v_org uuid;
begin
  select candidate_id, org_id into v_candidato, v_org
    from public.submissions where id = new.submission_id;
  if v_candidato is null then
    raise exception 'Entrega no encontrada.';
  end if;
  if v_candidato = new.reviewer_id then
    raise exception 'No puedes revisar tu propia entrega.' using errcode = 'P0001';
  end if;
  if v_org <> new.org_id then
    raise exception 'La entrega es de otra organización.';
  end if;
  return new;
end;
$$;

revoke all on function public.validar_revision() from public, anon, authenticated;

drop trigger if exists validar_revision on public.reviews;
create trigger validar_revision
  before insert or update on public.reviews
  for each row execute function public.validar_revision();

-- El candidato ve la revisión de SU entrega; el revisor ve las que firmó.
drop policy if exists "candidate or reviewer select review" on public.reviews;
create policy "candidate or reviewer select review"
  on public.reviews for select
  to authenticated
  using (
    reviewer_id = auth.uid()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.candidate_id = auth.uid()
    )
  );

-- Sin policies de insert/update/delete: submit_review() es la única puerta.
revoke insert, update, delete on public.reviews from anon, authenticated;

-- ============================================================
-- Lectura ciega para el revisor. Devuelve SOLO campos ciegos: seudónimo,
-- respuestas, explicación y observaciones. Nunca candidate_id, nombre,
-- correo ni fecha de creación (una hora exacta podría delatar a alguien
-- en un piloto pequeño).
-- ============================================================

create or replace function public.blind_pending_submissions()
returns table (id uuid, pseudonym text)
language sql
security definer
stable
set search_path = public
as $$
  select s.id, s.pseudonym
  from public.submissions s
  where auth.uid() is not null
    and s.org_id = public.my_org_id()
    and s.status = 'pending_review'
    and s.candidate_id <> auth.uid()
  order by s.pseudonym;
$$;

revoke all on function public.blind_pending_submissions() from public, anon;
grant execute on function public.blind_pending_submissions() to authenticated;

-- Para revisar (pendiente, no propia) o para ver el expediente que uno
-- mismo revisó.
create or replace function public.blind_submission(p_id uuid)
returns table (
  id uuid,
  pseudonym text,
  answer_growth numeric,
  answer_margin numeric,
  answer_dso numeric,
  explanation text,
  ai_observations jsonb,
  status text
)
language sql
security definer
stable
set search_path = public
as $$
  select s.id, s.pseudonym, s.answer_growth, s.answer_margin, s.answer_dso,
         s.explanation, s.ai_observations, s.status
  from public.submissions s
  where auth.uid() is not null
    and s.id = p_id
    and s.org_id = public.my_org_id()
    and s.candidate_id <> auth.uid()
    and (
      s.status = 'pending_review'
      or exists (
        select 1 from public.reviews r
        where r.submission_id = s.id and r.reviewer_id = auth.uid()
      )
    );
$$;

revoke all on function public.blind_submission(uuid) from public, anon;
grant execute on function public.blind_submission(uuid) to authenticated;

create or replace function public.submit_review(
  p_submission_id uuid,
  p_observation_decisions jsonb,
  p_conflict_declaration text,
  p_recommendation text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.my_org_id();
  v_review_id uuid;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Se requiere sesión y organización.';
  end if;

  -- Lock de la entrega: dos revisores al mismo tiempo no pueden firmar la
  -- misma (además del unique de reviews.submission_id).
  perform 1 from public.submissions
    where id = p_submission_id and org_id = v_org and status = 'pending_review'
    for update;
  if not found then
    raise exception 'La entrega no existe o ya fue revisada.';
  end if;

  insert into public.reviews (
    submission_id, org_id, reviewer_id, observation_decisions,
    conflict_declaration, recommendation, note
  ) values (
    p_submission_id, v_org, auth.uid(), coalesce(p_observation_decisions, '{}'::jsonb),
    trim(p_conflict_declaration), p_recommendation, trim(p_note)
  ) returning id into v_review_id;

  update public.submissions set status = 'reviewed' where id = p_submission_id;

  return v_review_id;
end;
$$;

revoke all on function public.submit_review(uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.submit_review(uuid, jsonb, text, text, text) to authenticated;
