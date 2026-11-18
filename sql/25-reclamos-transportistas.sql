-- 25 (18/11/2026): lista de transportistas para el desplegable "Transportista" de Reclamos Coordinación.
-- Son nombres de personas: van en esta tabla (solo se lee con el login de COM 2) y no en la página ni en este archivo,
-- porque el repo es público. La lista se carga aparte con Desktop/IA/reclamos-coordinacion-datos/25-transportistas-datos.sql
-- (en la PC del COM, no se sube), después de correr este.
-- Personas y unidades (DG, VCV, SA, TESSA…) en una sola lista; la página las ordena alfabéticamente.
-- Para sumar uno: insert into public.reclamos_transportistas (nombre) values ('Nombre');  para sacarlo: delete … where nombre = 'Nombre';
-- Se puede correr más de una vez.

create table if not exists public.reclamos_transportistas (
  nombre text primary key check (btrim(nombre) <> '')
);
alter table public.reclamos_transportistas enable row level security;
drop policy if exists "usuarios ven transportistas reclamos" on public.reclamos_transportistas;
create policy "usuarios ven transportistas reclamos" on public.reclamos_transportistas for select to authenticated
  using (public.mi_rol() <= 'operador');   -- cualquier usuario activo
drop policy if exists "supervision cambia transportistas reclamos" on public.reclamos_transportistas;
create policy "supervision cambia transportistas reclamos" on public.reclamos_transportistas for all to authenticated
  using (public.mi_rol() <= 'supervisor') with check (public.mi_rol() <= 'supervisor');


select count(*) as transportistas from public.reclamos_transportistas;
