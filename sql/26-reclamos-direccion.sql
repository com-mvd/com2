-- 26 (18/11/2026): Reclamos Coordinación guarda el "enlace de VIPS": la dirección que copia Google Maps al tocar la línea
-- del 📍 (p. ej. "Av.Gral Rivera 2251-2201, 11200 Montevideo, Departamento de Montevideo"), tal cual: ese formato se usa
-- para otras cosas. Es lo único que acepta el campo Ubicación (obligatorio); la página busca el punto en OpenStreetMap
-- (aproximado) y lat/lng siguen siendo el punto del mapa. Los reclamos de antes quedan con la dirección vacía.
-- El operador tampoco puede cambiarla (se suma al control del trigger). Se puede correr más de una vez.

alter table public.reclamos_coordinacion add column if not exists direccion text not null default '';
alter table public.reclamos_coordinacion drop constraint if exists reclamos_coordinacion_direccion_largo;
alter table public.reclamos_coordinacion add constraint reclamos_coordinacion_direccion_largo check (length(direccion) <= 300);

-- Mismo trigger de sql/21, con direccion entre lo que el operador no puede cambiar
create or replace function public.reclamos_coordinacion_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ahora timestamp := (now() at time zone 'America/Montevideo');
  quien text := public.cajas_mi_nombre();
begin
  -- El operador solo asigna y resuelve: no puede cambiar los datos del reclamo ni Respondido (17/11)
  if tg_op = 'UPDATE' and public.mi_rol() = 'operador' and
     (new.lat, new.lng, new.municipio, new.direccion, new.servicio, new.grupo, new.solicitante, new.pedido, new.foto, new.respondido)
     is distinct from (old.lat, old.lng, old.municipio, old.direccion, old.servicio, old.grupo, old.solicitante, old.pedido, old.foto, old.respondido) then
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

select count(*) filter (where direccion <> '') as con_direccion, count(*) as reclamos from public.reclamos_coordinacion;
