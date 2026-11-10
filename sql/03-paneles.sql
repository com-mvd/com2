-- COM 2 — paneles del menú (Operador / Supervisor / Admin).
-- Pegar entero en Supabase → SQL Editor → Run. Se puede correr más de una vez.
--
-- Cada sección del menú pertenece a un panel. Cada rol ve su panel y los de abajo:
--   admin      → Admin, Supervisor y Operador
--   supervisor → Supervisor y Operador
--   operador   → Operador
-- El tipo rol está declarado en el orden ('admin', 'supervisor', 'operador'), así que
-- "mi rol <= panel" quiere decir "mi rol está a la altura del panel o por encima".

alter table public.secciones add column if not exists panel public.rol not null default 'operador';

insert into public.secciones (id, nombre, archivo, grupo, orden, panel)
values ('usuarios', 'Usuarios', 'usuarios.html', 'Administración', 10, 'admin')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, panel = excluded.panel;

-- Primero la regla nueva (la vieja usaba la columna roles), después se borra roles, que quedó sin uso.
drop policy if exists "ver secciones de mi rol" on public.secciones;
create policy "ver secciones de mi rol" on public.secciones for select to authenticated
  using (activa and public.mi_rol() <= panel);

alter table public.secciones drop column if exists roles;
