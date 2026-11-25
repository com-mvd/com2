-- Vaciar la última Base GOL a las 02:10, 10:10 y 18:10 de Montevideo.
begin;

create extension if not exists pg_cron;

create or replace function public.asignador_zl_gol_proximo_corte(carga timestamptz)
returns timestamptz language sql immutable strict set search_path = ''
as $$
  select (
    case
      when local::time < time '02:10' then local::date + time '02:10'
      when local::time < time '10:10' then local::date + time '10:10'
      when local::time < time '18:10' then local::date + time '18:10'
      else (local::date + 1) + time '02:10'
    end
  ) at time zone 'America/Montevideo'
  from (select carga at time zone 'America/Montevideo' as local) as hora;
$$;

alter table public.zona_limpia_asignador_gol add column if not exists vence_en timestamptz
  generated always as (public.asignador_zl_gol_proximo_corte(actualizada)) stored;

-- El trabajo de Cron puede vaciar la fila. Las cargas del Asignador conservan la validación original.
create or replace function public.asignador_zl_gol_actualizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  if new.filas is null then
    new.actualizada := null;
    return new;
  end if;

  if pg_catalog.jsonb_typeof(new.filas) <> 'array' then
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

  new.actualizada := pg_catalog.clock_timestamp();
  return new;
end;
$$;

alter policy "supervision carga base gol" on public.zona_limpia_asignador_gol
with check (
  filas is not null
  and (select public.mi_rol()) <= 'supervisor'
  and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
);

-- Si llega tarde, el corte solo borra una base vencida. Una carga posterior queda guardada.
do $$
declare
  zona text := coalesce(current_setting('cron.timezone', true), 'GMT');
  horario text;
begin
  horario := case
    when zona in ('GMT', 'UTC', 'Etc/UTC', 'Etc/GMT') then '10 5,13,21 * * *'
    when zona = 'America/Montevideo' then '10 2,10,18 * * *'
  end;
  if horario is null then
    raise exception 'Zona horaria de pg_cron no reconocida: %', zona;
  end if;

  perform cron.schedule('asignador-base-gol-cortes', horario, $tarea$
    update public.zona_limpia_asignador_gol
    set filas = null
    where id = 1 and filas is not null and vence_en <= statement_timestamp();
  $tarea$);
end;
$$;

notify pgrst, 'reload schema';
commit;
