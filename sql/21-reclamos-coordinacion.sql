-- 21 (17/11/2026): Reclamos Coordinación (reclamos-coordinacion.html). Pedidos que se cargan con foto y ubicación, se ven en un mapa y se mandan a atender
-- (Sin asignar → Asignado → Resuelto). Reemplaza la idea del "Mapa operativo (activos + pendientes)" que pasó un
-- compañero, que guardaba en el navegador o en la planilla "CASOS VIP" por un Apps Script.
--   reclamos_coordinacion:  un pedido por fila. Hora de Montevideo sin zona en pedido / asignado / resuelto.
--   bucket "reclamos-fotos" (privado): la foto inicial y la de resuelto, comprimidas en el navegador (jpg, ~150 KB).
-- Permisos (17/11): todos los usuarios activos ven. El OPERADOR solo asigna y resuelve lo que está en curso (no carga
-- reclamos, no cambia los datos del reclamo, no toca el historial ni Respondido; lo controla el trigger).
-- Supervisor, auxiliar, sup gral y admin cargan, editan todo (también lo resuelto), marcan Respondido y borran.
-- Se puede correr más de una vez. Las tarjetas del menú van aparte (sql/22), después del push.

create table if not exists public.reclamos_coordinacion (
  id               bigint generated always as identity primary key,
  lat              double precision not null check (lat between -36 and -33),    -- Uruguay, con margen
  lng              double precision not null check (lng between -59 and -53),
  municipio        text not null default '',       -- lo calcula la página con los polígonos (assets/municipios.js)
  servicio         text not null default '' check (servicio in ('', 'Municipio', 'Zona Limpia')),   -- servicio a asignar
  grupo            text not null default '' check (grupo in ('', 'Coordinación', 'Monitoreo', 'Interno IM')),
  solicitante      text not null default '',
  pedido           timestamp not null,             -- fecha y hora de la solicitud, hora de Montevideo (sin zona)
  foto             text not null default '',       -- ruta dentro del bucket reclamos-fotos
  estado           text not null default 'sin_asignar' check (estado in ('sin_asignar', 'asignado', 'resuelto')),
  respondido       boolean not null default false,   -- casilla del historial (17/11)
  asignado_a       text not null default '',
  asignado         timestamp,
  resuelto         timestamp,
  foto_resuelto    text not null default '',
  obs_resuelto     text not null default '',
  creado           timestamptz not null default now(),
  creado_por       uuid default auth.uid() references auth.users (id) on delete set null,
  creado_nombre    text not null default '',
  asignado_nombre  text not null default '',       -- quién lo mandó a atender
  resuelto_nombre  text not null default '',
  modificado       timestamptz,
  modificado_por   uuid references auth.users (id) on delete set null,
  modificado_nombre text not null default '',
  check ((estado = 'sin_asignar') = (asignado_a = '')),
  check ((estado = 'resuelto') = (resuelto is not null)),
  check (resuelto is null or resuelto >= pedido),
  check (length(solicitante) <= 80 and length(asignado_a) <= 80 and length(obs_resuelto) <= 1000),
  -- Todo obligatorio (17/11, a pedido): foto, solicitante y grupo al cargar; foto final al resolver
  check (foto <> '' and servicio <> '' and solicitante <> '' and grupo <> ''),
  check (estado <> 'resuelto' or foto_resuelto <> '')
);
create index if not exists reclamos_coordinacion_pedido on public.reclamos_coordinacion (pedido desc);
create index if not exists reclamos_coordinacion_abiertos on public.reclamos_coordinacion (estado) where estado <> 'resuelto';

-- OJO (18/11): sql/26 suma la columna direccion y rehace este trigger con ella. Si se vuelve a correr este archivo,
-- correr después sql/26, o el operador podría cambiar la dirección.
-- Nombre de quien hace el cambio (cajas_mi_nombre es de sql/16: lee perfiles con security definer)
create or replace function public.reclamos_coordinacion_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ahora timestamp := (now() at time zone 'America/Montevideo');
  quien text := public.cajas_mi_nombre();
begin
  -- El operador solo asigna y resuelve: no puede cambiar los datos del reclamo ni Respondido (17/11)
  if tg_op = 'UPDATE' and public.mi_rol() = 'operador' and
     (new.lat, new.lng, new.municipio, new.servicio, new.grupo, new.solicitante, new.pedido, new.foto, new.respondido)
     is distinct from (old.lat, old.lng, old.municipio, old.servicio, old.grupo, old.solicitante, old.pedido, old.foto, old.respondido) then
    raise exception 'El operador solo puede asignar y resolver reclamos';
  end if;
  if tg_op = 'INSERT' then
    new.creado := now(); new.creado_por := auth.uid(); new.creado_nombre := quien;
    new.modificado := null; new.modificado_por := null; new.modificado_nombre := '';
    if new.estado = 'resuelto' then raise exception 'Un reclamo nuevo no puede empezar resuelto'; end if;
  else
    new.creado := old.creado; new.creado_por := old.creado_por; new.creado_nombre := old.creado_nombre;
    new.modificado := now(); new.modificado_por := auth.uid(); new.modificado_nombre := quien;
  end if;
  -- Asignado: hora y quién lo mandó, solo al pasar a asignado (o al cambiar a quién)
  if new.estado = 'sin_asignar' then
    new.asignado := null; new.asignado_nombre := '';
  elsif tg_op = 'INSERT' or old.asignado_a is distinct from new.asignado_a or old.estado = 'sin_asignar' then
    new.asignado := coalesce(new.asignado, ahora); new.asignado_nombre := quien;
  else
    new.asignado := old.asignado; new.asignado_nombre := old.asignado_nombre;
  end if;
  -- Resuelto: quién, solo al pasar a resuelto; si se reabre se borra lo de resuelto
  if new.estado = 'resuelto' then
    if tg_op = 'UPDATE' and old.estado <> 'resuelto' then new.resuelto_nombre := quien;
    elsif tg_op = 'UPDATE' then new.resuelto_nombre := old.resuelto_nombre; end if;
  else
    new.resuelto := null; new.resuelto_nombre := ''; new.foto_resuelto := ''; new.obs_resuelto := '';
  end if;
  if new.pedido > ahora + interval '5 minutes' then raise exception 'La fecha y hora de la solicitud no puede ser futura'; end if;
  if new.resuelto > ahora + interval '5 minutes' then raise exception 'La fecha y hora de resuelto no puede ser futura'; end if;
  return new;
end $$;
drop trigger if exists reclamos_coordinacion_antes on public.reclamos_coordinacion;
create trigger reclamos_coordinacion_antes before insert or update on public.reclamos_coordinacion
  for each row execute function public.reclamos_coordinacion_antes();

alter table public.reclamos_coordinacion enable row level security;
drop policy if exists "supervision ve reclamos coordinacion" on public.reclamos_coordinacion;
drop policy if exists "usuarios ven reclamos coordinacion" on public.reclamos_coordinacion;
create policy "usuarios ven reclamos coordinacion" on public.reclamos_coordinacion for select to authenticated
  using (public.mi_rol() <= 'operador');   -- cualquier usuario activo (mi_rol() da null si está de baja)
drop policy if exists "supervision carga reclamos coordinacion" on public.reclamos_coordinacion;
create policy "supervision carga reclamos coordinacion" on public.reclamos_coordinacion for insert to authenticated
  with check (public.mi_rol() <= 'supervisor');
-- Supervisión cambia todo, también lo resuelto; el operador solo lo que está en curso (y el trigger le limita las columnas)
drop policy if exists "supervision cambia reclamos coordinacion" on public.reclamos_coordinacion;
drop policy if exists "usuarios cambian reclamos coordinacion" on public.reclamos_coordinacion;
create policy "usuarios cambian reclamos coordinacion" on public.reclamos_coordinacion for update to authenticated
  using (public.mi_rol() <= 'supervisor' or (public.mi_rol() = 'operador' and estado <> 'resuelto'))
  with check (public.mi_rol() <= 'operador');
drop policy if exists "supervision borra reclamos coordinacion" on public.reclamos_coordinacion;
create policy "supervision borra reclamos coordinacion" on public.reclamos_coordinacion for delete to authenticated
  using (public.mi_rol() <= 'supervisor');

-- Casilla "Respondido" del historial (17/11): la marca cualquiera de supervisión (no el operador). Va por esta función,
-- que cambia solo esa columna.
create or replace function public.reclamos_respondido(p_id bigint, p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.mi_rol() is null or public.mi_rol() > 'supervisor' then raise exception 'Tu usuario no tiene permiso para esto'; end if;
  update public.reclamos_coordinacion set respondido = p_valor where id = p_id;
  if not found then raise exception 'No existe ese reclamo'; end if;
end $$;
revoke execute on function public.reclamos_respondido(bigint, boolean) from public, anon;
grant execute on function public.reclamos_respondido(bigint, boolean) to authenticated;

revoke all on public.reclamos_coordinacion from anon;
grant select, insert, update, delete on public.reclamos_coordinacion to authenticated;

-- En vivo: lo que carga uno le aparece a los demás sin recargar (Realtime respeta RLS)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reclamos_coordinacion') then
    alter publication supabase_realtime add table public.reclamos_coordinacion;
  end if;
end $$;

-- Fotos: bucket privado, hasta 3 MB por foto (la página las achica a ~1280 px antes de subirlas)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reclamos-fotos', 'reclamos-fotos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "supervision ve fotos reclamos" on storage.objects;
create policy "supervision ve fotos reclamos" on storage.objects for select to authenticated
  using (bucket_id = 'reclamos-fotos' and public.mi_rol() <= 'operador');   -- el operador ve las fotos y sube la final
drop policy if exists "supervision sube fotos reclamos" on storage.objects;
create policy "supervision sube fotos reclamos" on storage.objects for insert to authenticated
  with check (bucket_id = 'reclamos-fotos' and public.mi_rol() <= 'operador');
drop policy if exists "supervision borra fotos reclamos" on storage.objects;
create policy "supervision borra fotos reclamos" on storage.objects for delete to authenticated
  using (bucket_id = 'reclamos-fotos' and public.mi_rol() <= 'supervisor');

select (select count(*) from public.reclamos_coordinacion) as reclamos,
       (select public from storage.buckets where id = 'reclamos-fotos') as bucket_publico;

-- Las tarjetas del menú van aparte (sql/22-reclamos-menu.sql), recién cuando la página y el index.html estén publicados.
