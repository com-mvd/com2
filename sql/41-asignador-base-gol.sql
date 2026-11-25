-- Última Base GOL compartida entre los usuarios del Asignador.
begin;

create table if not exists public.zona_limpia_asignador_gol (
  id smallint primary key check (id = 1),
  filas jsonb,
  revision bigint not null default 0,
  actualizada timestamptz
);

insert into public.zona_limpia_asignador_gol (id) values (1) on conflict do nothing;

create or replace function public.asignador_zl_gol_actualizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.filas is null or pg_catalog.jsonb_typeof(new.filas) <> 'array' then
    raise exception 'La Base GOL debe contener una lista de puntos' using errcode = '23514';
  end if;

  if pg_catalog.jsonb_array_length(new.filas) not between 1 and 50000 then
    raise exception 'La Base GOL debe contener entre 1 y 50000 puntos' using errcode = '23514';
  end if;

  if exists (
    select 1 from pg_catalog.jsonb_array_elements(new.filas) as puntos(fila)
    where case
      when pg_catalog.jsonb_typeof(fila) <> 'array' then true
      when pg_catalog.jsonb_array_length(fila) <> 3 then true
      when pg_catalog.jsonb_typeof(fila -> 0) <> 'string' or
           pg_catalog.jsonb_typeof(fila -> 1) <> 'number' or
           pg_catalog.jsonb_typeof(fila -> 2) <> 'number' then true
      else (fila ->> 0) !~ '^(CH|[A-G])[0-9]{1,3}$' or
           (fila ->> 1) !~ '^[1-9][0-9]{0,15}$' or
           (fila ->> 1)::numeric > 9007199254740991 or (fila ->> 2)::numeric < 0
    end
  ) then
    raise exception 'La Base GOL contiene puntos inválidos' using errcode = '23514';
  end if;

  new.revision := old.revision + 1;
  new.actualizada := pg_catalog.clock_timestamp();
  return new;
end;
$$;

drop trigger if exists actualizar on public.zona_limpia_asignador_gol;
create trigger actualizar before update of filas on public.zona_limpia_asignador_gol
  for each row execute function public.asignador_zl_gol_actualizar();

alter table public.zona_limpia_asignador_gol enable row level security;
revoke all on public.zona_limpia_asignador_gol from public, anon, authenticated;
revoke execute on function public.asignador_zl_gol_actualizar() from public, anon, authenticated;
grant select on public.zona_limpia_asignador_gol to authenticated;
grant update (filas) on public.zona_limpia_asignador_gol to authenticated;

drop policy if exists "supervision lee base gol" on public.zona_limpia_asignador_gol;
create policy "supervision lee base gol" on public.zona_limpia_asignador_gol for select to authenticated
using (
  (select public.mi_rol()) <= 'supervisor'
  and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
);

drop policy if exists "supervision carga base gol" on public.zona_limpia_asignador_gol;
create policy "supervision carga base gol" on public.zona_limpia_asignador_gol for update to authenticated
using (
  (select public.mi_rol()) <= 'supervisor'
  and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
);

notify pgrst, 'reload schema';
commit;
