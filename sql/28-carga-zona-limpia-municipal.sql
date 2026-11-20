begin;

create table if not exists public.zona_limpia_municipal_cargas (
  id bigint generated always as identity primary key,
  solicitud uuid not null unique,
  circuito text not null check (circuito = upper(btrim(circuito)) and char_length(circuito) between 1 and 80),
  hora_inicio time(0) without time zone not null check (hora_inicio < time '24:00'),
  hora_fin time(0) without time zone not null check (hora_fin < time '24:00'),
  desde_cont integer not null check (desde_cont > 0),
  hasta_cont integer not null check (hasta_cont >= desde_cont),
  creado timestamptz not null default now(),
  creado_por uuid default auth.uid() references auth.users (id) on delete set null
);

alter table public.zona_limpia_municipal_cargas enable row level security;
revoke all on public.zona_limpia_municipal_cargas from public, anon, authenticated;
grant select on public.zona_limpia_municipal_cargas to authenticated;
grant insert (solicitud, circuito, hora_inicio, hora_fin, desde_cont, hasta_cont)
  on public.zona_limpia_municipal_cargas to authenticated;

drop policy if exists "supervision lee cargas municipales" on public.zona_limpia_municipal_cargas;
create policy "supervision lee cargas municipales" on public.zona_limpia_municipal_cargas
  for select to authenticated using (
    (select public.mi_rol()) <= 'supervisor'
    and exists (
      select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave
    )
  );

drop policy if exists "supervision registra cargas municipales" on public.zona_limpia_municipal_cargas;
create policy "supervision registra cargas municipales" on public.zona_limpia_municipal_cargas
  for insert to authenticated with check (
    (select public.mi_rol()) <= 'supervisor'
    and exists (
      select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave
    )
  );

insert into public.secciones (id, nombre, archivo, grupo, orden, panel, icono, color)
values ('carga-zona-limpia-municipal', 'Carga Zona Limpia Municipal',
  'carga-zona-limpia-municipal.html', 'Zona Limpia', 20, 'supervisor', 'documento', 'teal')
on conflict (id) do update set
  nombre = excluded.nombre,
  archivo = excluded.archivo,
  grupo = excluded.grupo,
  orden = excluded.orden,
  panel = excluded.panel,
  icono = excluded.icono,
  color = excluded.color,
  activa = true;

commit;
