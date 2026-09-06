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

create policy "employers select own criteria_sets"
  on public.criteria_sets for select
  using (auth.uid() = employer_id);

create policy "employers insert own criteria_sets"
  on public.criteria_sets for insert
  with check (auth.uid() = employer_id);

create policy "employers update own criteria_sets"
  on public.criteria_sets for update
  using (auth.uid() = employer_id)
  with check (auth.uid() = employer_id);

create policy "employers delete own criteria_sets"
  on public.criteria_sets for delete
  using (auth.uid() = employer_id);
