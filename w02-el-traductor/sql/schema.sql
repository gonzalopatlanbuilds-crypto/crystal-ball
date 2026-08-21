-- El Traductor — schema de solicitudes de revisión humana
-- Ejecutar en el SQL editor del proyecto Supabase "semestre".
--
-- Shadow Clause del equipo: esta tabla solo guarda lo que la persona
-- decidió objetar y el mensaje redactado. Nunca se guarda un score,
-- probabilidad, ni una decisión de aprobación/rechazo — esas siempre
-- las toma el banco, no esta plataforma.

create extension if not exists "pgcrypto";

create table if not exists public.solicitudes_revision (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  aviso_simulado jsonb not null,
  datos_objetados jsonb not null,
  mensaje_generado text not null
);

alter table public.solicitudes_revision enable row level security;

-- Cualquiera (rol anónimo) puede crear una solicitud desde el formulario
-- público. No existe política de SELECT/UPDATE/DELETE a propósito: nadie
-- puede leer, modificar ni borrar solicitudes usando la anon key desde el
-- cliente. Revisar/administrar solicitudes requiere entrar al dashboard
-- de Supabase con la cuenta del proyecto.
create policy "Cualquiera puede insertar solicitudes"
  on public.solicitudes_revision
  for insert
  to anon
  with check (true);
