-- Asignador de Zona Limpia: recursos del día, plan del día y tarjeta del menú.
-- Pegar entero en Supabase → SQL Editor → Run. Se puede correr más de una vez.
-- Requiere la planilla de circuitos creada en sql/31.
-- Leen supervisor y superiores. Escriben auxiliar, sup. general y admin.
begin;

-- 1. Recursos del día: solo las diferencias respecto de la planilla del Semáforo ({"add":{turno:{municipio:[empresas]}}, "del":{...}}).
create table if not exists public.zona_limpia_asignador_recursos (
  fecha date primary key,
  diferencias jsonb not null default '{"add":{},"del":{}}'::jsonb check (jsonb_typeof(diferencias) = 'object'),
  revision integer not null default 0,
  actualizado timestamptz not null default now(),
  actualizado_por uuid default auth.uid() references auth.users (id) on delete set null
);

create or replace function public.asignador_zl_recursos_avanzar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.actualizado := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;
drop trigger if exists avanzar on public.zona_limpia_asignador_recursos;
create trigger avanzar before update on public.zona_limpia_asignador_recursos
  for each row execute function public.asignador_zl_recursos_avanzar();

-- 2. Plan del día: una fila por circuito y turno (la clave evita que dos personas asignen el mismo circuito a la vez).
create table if not exists public.zona_limpia_asignador_plan (
  fecha date not null,
  turno smallint not null check (turno in (0, 1, 2)),                  -- 0 Matutino, 1 Vespertino, 2 Nocturno
  circuito text not null check (circuito = upper(btrim(circuito)) and char_length(circuito) between 1 and 20),
  recurso text not null check (char_length(btrim(recurso)) between 1 and 120),
  tramos text not null check (char_length(btrim(tramos)) between 1 and 500),
  criterio text not null check (criterio in ('GOL', 'Semáforo', 'Reclamos')),
  edades jsonb check (edades is null or jsonb_typeof(edades) = 'object'),   -- antigüedad de la última atención de lo pendiente
  creado timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  actualizado timestamptz not null default now(),
  primary key (fecha, turno, circuito)
);

create or replace function public.asignador_zl_plan_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado := now();
  return new;
end;
$$;
drop trigger if exists actualizado on public.zona_limpia_asignador_plan;
create trigger actualizado before update on public.zona_limpia_asignador_plan
  for each row execute function public.asignador_zl_plan_actualizado();

-- 3. Permisos y reglas (RLS)
alter table public.zona_limpia_asignador_recursos enable row level security;
alter table public.zona_limpia_asignador_plan enable row level security;
revoke all on public.zona_limpia_asignador_recursos from public, anon, authenticated;
revoke all on public.zona_limpia_asignador_plan from public, anon, authenticated;
revoke execute on function public.asignador_zl_recursos_avanzar() from public, anon, authenticated;
revoke execute on function public.asignador_zl_plan_actualizado() from public, anon, authenticated;

grant select on public.zona_limpia_asignador_recursos to authenticated;
grant insert (fecha, diferencias) on public.zona_limpia_asignador_recursos to authenticated;
grant update (diferencias) on public.zona_limpia_asignador_recursos to authenticated;

grant select on public.zona_limpia_asignador_plan to authenticated;
grant insert (fecha, turno, circuito, recurso, tramos, criterio, edades) on public.zona_limpia_asignador_plan to authenticated;
grant update (recurso, tramos, criterio, edades) on public.zona_limpia_asignador_plan to authenticated;
grant delete on public.zona_limpia_asignador_plan to authenticated;

drop policy if exists "supervision lee recursos del asignador" on public.zona_limpia_asignador_recursos;
create policy "supervision lee recursos del asignador" on public.zona_limpia_asignador_recursos
  for select to authenticated using (
    (select public.mi_rol()) <= 'supervisor'
    and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
  );
drop policy if exists "auxiliares y superiores crean recursos del asignador" on public.zona_limpia_asignador_recursos;
create policy "auxiliares y superiores crean recursos del asignador" on public.zona_limpia_asignador_recursos
  for insert to authenticated with check (
    (select public.mi_rol()) <= 'auxiliar'
    and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
  );
drop policy if exists "auxiliares y superiores editan recursos del asignador" on public.zona_limpia_asignador_recursos;
create policy "auxiliares y superiores editan recursos del asignador" on public.zona_limpia_asignador_recursos
  for update to authenticated
  using (
    (select public.mi_rol()) <= 'auxiliar'
    and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
  )
  with check (
    (select public.mi_rol()) <= 'auxiliar'
    and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
  );

drop policy if exists "supervision lee el plan del asignador" on public.zona_limpia_asignador_plan;
create policy "supervision lee el plan del asignador" on public.zona_limpia_asignador_plan
  for select to authenticated using (
    (select public.mi_rol()) <= 'supervisor'
    and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
  );
drop policy if exists "auxiliares y superiores crean el plan del asignador" on public.zona_limpia_asignador_plan;
create policy "auxiliares y superiores crean el plan del asignador" on public.zona_limpia_asignador_plan
  for insert to authenticated with check (
    (select public.mi_rol()) <= 'auxiliar'
    and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
  );
drop policy if exists "auxiliares y superiores editan el plan del asignador" on public.zona_limpia_asignador_plan;
create policy "auxiliares y superiores editan el plan del asignador" on public.zona_limpia_asignador_plan
  for update to authenticated
  using (
    (select public.mi_rol()) <= 'auxiliar'
    and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
  )
  with check (
    (select public.mi_rol()) <= 'auxiliar'
    and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
  );
drop policy if exists "auxiliares y superiores borran el plan del asignador" on public.zona_limpia_asignador_plan;
create policy "auxiliares y superiores borran el plan del asignador" on public.zona_limpia_asignador_plan
  for delete to authenticated using (
    (select public.mi_rol()) <= 'auxiliar'
    and exists (select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave)
  );

-- Vaciar solo las filas y versiones que se mostraron al confirmar.
-- Si una de ellas cambió, se revierte el borrado completo.
create or replace function public.asignador_zl_vaciar_plan(dia date, filas jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  borradas integer;
begin
  delete from public.zona_limpia_asignador_plan as plan
  using pg_catalog.jsonb_to_recordset(filas) as vista(turno smallint, circuito text, actualizado timestamptz)
  where plan.fecha = dia
    and (plan.turno, plan.circuito, plan.actualizado) = (vista.turno, vista.circuito, vista.actualizado);

  get diagnostics borradas = row_count;
  if borradas <> pg_catalog.jsonb_array_length(filas) then
    raise exception 'El plan cambió desde la última lectura' using errcode = '40001';
  end if;
end;
$$;

revoke execute on function public.asignador_zl_vaciar_plan(date, jsonb) from public, anon;
grant execute on function public.asignador_zl_vaciar_plan(date, jsonb) to authenticated;

-- 4. El Asignador ocupa el lugar del Semáforo en el panel Supervisor.
-- El Asignador abre la página existente para consultar o editar la planilla.
insert into public.secciones (id, nombre, archivo, grupo, orden, panel, icono, color)
values ('asignador-zona-limpia', 'Asignador de Zona Limpia', 'asignador-zona-limpia.html', 'Zona Limpia', 10, 'supervisor', 'planilla', 'teal')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, panel = excluded.panel, icono = excluded.icono, color = excluded.color, activa = true;

update public.secciones set activa = false where id = 'circuitos-zona-limpia';

commit;
