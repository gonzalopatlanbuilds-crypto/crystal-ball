-- Proof of Skill — schema
-- Corre esto completo en el SQL Editor de tu proyecto de Supabase
-- (Project → SQL Editor → New query → pega y ejecuta).

-- ============================================================
-- Feature 1: auth + shell — no requiere tablas propias.
-- Supabase Auth ya administra auth.users; Google se configura desde
-- el dashboard (Authentication → Providers), no desde SQL.
-- ============================================================

-- ============================================================
-- Feature 2: criteria_sets — el empleador define y pesa sus propios
-- criterios de contratación para un rol.
-- ============================================================

create table if not exists public.criteria_sets (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references auth.users (id) on delete cascade,
  role_name text not null check (char_length(role_name) between 1 and 120),
  -- Cada elemento: { "label": string, "weight": number 0-100 }. La
  -- validación fina (longitud de label, tipo y rango de weight) vive
  -- server-side en lib/criteria.ts antes de todo insert/update; este
  -- CHECK es un respaldo a nivel de base de datos, no la validación
  -- principal.
  criteria jsonb not null check (
    jsonb_typeof(criteria) = 'array' and jsonb_array_length(criteria) >= 3
  ),
  created_at timestamptz not null default now()
);

alter table public.criteria_sets enable row level security;

-- drop policy if exists antes de cada create policy: a diferencia de
-- create table, "create policy" no tiene un IF NOT EXISTS nativo en
-- Postgres — sin este drop, volver a correr el archivo completo (por
-- ejemplo tras agregar la sección de Feature 3 más abajo) truena con
-- "policy ... already exists" aunque la tabla ya exista sin problema.
drop policy if exists "employers select own criteria_sets" on public.criteria_sets;
create policy "employers select own criteria_sets"
  on public.criteria_sets for select
  using (auth.uid() = employer_id);

drop policy if exists "employers insert own criteria_sets" on public.criteria_sets;
create policy "employers insert own criteria_sets"
  on public.criteria_sets for insert
  with check (auth.uid() = employer_id);

drop policy if exists "employers update own criteria_sets" on public.criteria_sets;
create policy "employers update own criteria_sets"
  on public.criteria_sets for update
  using (auth.uid() = employer_id)
  with check (auth.uid() = employer_id);

drop policy if exists "employers delete own criteria_sets" on public.criteria_sets;
create policy "employers delete own criteria_sets"
  on public.criteria_sets for delete
  using (auth.uid() = employer_id);

-- ============================================================
-- Feature 3: candidate_scores — datos simulados de un candidato
-- calificados contra los criterios (y pesos) de un criteria_set.
-- ============================================================

create table if not exists public.candidate_scores (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references auth.users (id) on delete cascade,
  criteria_set_id uuid not null references public.criteria_sets (id) on delete cascade,
  candidate_name text not null check (char_length(candidate_name) between 1 and 120),
  -- Snapshot de { label, weight, score } por criterio en el momento de
  -- calificar (no un join en vivo a criteria_sets.criteria): si el
  -- empleador edita los pesos del rol después, un scorecard ya emitido no
  -- debe cambiar retroactivamente. La validación fina vive server-side en
  -- lib/scoring.ts; este CHECK es respaldo, no la validación principal.
  scores jsonb not null check (
    jsonb_typeof(scores) = 'array' and jsonb_array_length(scores) >= 1
  ),
  created_at timestamptz not null default now()
);

alter table public.candidate_scores enable row level security;

drop policy if exists "employers select own candidate_scores" on public.candidate_scores;
create policy "employers select own candidate_scores"
  on public.candidate_scores for select
  using (auth.uid() = employer_id);

drop policy if exists "employers insert own candidate_scores" on public.candidate_scores;
create policy "employers insert own candidate_scores"
  on public.candidate_scores for insert
  with check (auth.uid() = employer_id);

drop policy if exists "employers delete own candidate_scores" on public.candidate_scores;
create policy "employers delete own candidate_scores"
  on public.candidate_scores for delete
  using (auth.uid() = employer_id);
