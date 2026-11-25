-- Registro de incidentes de transportistas en Monitoreo de plantas.
begin;

create table if not exists public.incidentes_plantas (
  id bigint generated always as identity primary key,
  incidente text not null check (char_length(btrim(incidente)) between 1 and 120),
  transportista text not null check (char_length(btrim(transportista)) between 1 and 120),
  ocurrido timestamp not null,  -- hora de Montevideo
  observaciones text not null default '' check (char_length(observaciones) <= 500),
  creado_en timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users (id) on delete set null
);

create index if not exists incidentes_plantas_ocurrido
  on public.incidentes_plantas (ocurrido desc, id desc);

alter table public.incidentes_plantas enable row level security;
revoke all on public.incidentes_plantas from anon, authenticated;
grant select on public.incidentes_plantas to authenticated;
grant insert (incidente, transportista, ocurrido, observaciones) on public.incidentes_plantas to authenticated;

drop policy if exists "usuarios activos ven incidentes de plantas" on public.incidentes_plantas;
create policy "usuarios activos ven incidentes de plantas" on public.incidentes_plantas
  for select to authenticated using ((select public.mi_rol()) <= 'operador');

drop policy if exists "usuarios activos registran incidentes de plantas" on public.incidentes_plantas;
create policy "usuarios activos registran incidentes de plantas" on public.incidentes_plantas
  for insert to authenticated with check (
    (select public.mi_rol()) <= 'operador'
    and ocurrido <= (now() at time zone 'America/Montevideo') + interval '5 minutes'
  );

commit;
