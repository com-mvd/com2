begin;

create or replace function public.semaforo_zona_limpia_filas_validas(filas jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
  select case
    when filas is null then true
    when pg_catalog.jsonb_typeof(filas) <> 'array' then false
    else not exists (
      select 1 from pg_catalog.jsonb_array_elements(filas) as f(fila)
      where (
        pg_catalog.jsonb_typeof(fila) = 'object'
        and fila->'turno' in ('0'::jsonb, '1'::jsonb, '2'::jsonb)
        and pg_catalog.jsonb_typeof(fila->'municipio') = 'string'
        and char_length(btrim(fila->>'municipio')) between 1 and 80
        and pg_catalog.jsonb_typeof(fila->'camion') = 'string'
        and char_length(fila->>'camion') <= 120
        and pg_catalog.jsonb_typeof(fila->'circuito') = 'string'
        and char_length(btrim(fila->>'circuito')) between 1 and 80
        and (
          (fila->'desde' = 'null'::jsonb and fila->'hasta' = 'null'::jsonb)
          or (
            pg_catalog.jsonb_typeof(fila->'desde') = 'number'
            and pg_catalog.jsonb_typeof(fila->'hasta') = 'number'
            and (fila->>'desde') ~ '^[1-9][0-9]*$'
            and (fila->>'hasta') ~ '^[1-9][0-9]*$'
            and fila->'hasta' >= fila->'desde'
            and fila->'hasta' <= '2147483647'::jsonb
          )
        )
      ) is not true
    )
  end;
$$;

-- Una versión compartida para los tres turnos. NULL usa la planilla incluida en el HTML.
create table if not exists public.zona_limpia_semaforo_planilla (
  id smallint primary key default 1 check (id = 1),
  filas jsonb check (public.semaforo_zona_limpia_filas_validas(filas)),
  revision integer not null default 0
);
insert into public.zona_limpia_semaforo_planilla (id) values (1) on conflict do nothing;

create or replace function public.semaforo_zona_limpia_avanzar_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;

drop trigger if exists avanzar_revision on public.zona_limpia_semaforo_planilla;
create trigger avanzar_revision
  before update on public.zona_limpia_semaforo_planilla
  for each row execute function public.semaforo_zona_limpia_avanzar_revision();

alter table public.zona_limpia_semaforo_planilla enable row level security;
revoke all on public.zona_limpia_semaforo_planilla from public, anon, authenticated;
grant select on public.zona_limpia_semaforo_planilla to authenticated;
grant update (filas) on public.zona_limpia_semaforo_planilla to authenticated;
revoke execute on function public.semaforo_zona_limpia_filas_validas(jsonb) from public, anon;
grant execute on function public.semaforo_zona_limpia_filas_validas(jsonb) to authenticated;
revoke execute on function public.semaforo_zona_limpia_avanzar_revision() from public, anon, authenticated;

drop policy if exists "supervision lee planilla del semaforo" on public.zona_limpia_semaforo_planilla;
create policy "supervision lee planilla del semaforo" on public.zona_limpia_semaforo_planilla
  for select to authenticated using (
    (select public.mi_rol()) <= 'supervisor'
    and exists (
      select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave
    )
  );

drop policy if exists "auxiliares y superiores editan planilla del semaforo" on public.zona_limpia_semaforo_planilla;
create policy "auxiliares y superiores editan planilla del semaforo" on public.zona_limpia_semaforo_planilla
  for update to authenticated
  using (
    (select public.mi_rol()) <= 'auxiliar'
    and exists (
      select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave
    )
  )
  with check (
    (select public.mi_rol()) <= 'auxiliar'
    and exists (
      select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave
    )
  );

commit;
