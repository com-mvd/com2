-- Agrega Semáforo de Zona Limpia al panel Supervisor de COM2.
insert into public.secciones (id, nombre, archivo, grupo, orden, panel, icono, color)
values ('circuitos-zona-limpia', 'Semáforo de Zona Limpia', 'circuitos-zona-limpia.html', 'Zona Limpia', 10, 'supervisor', 'documento', 'teal')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, panel = excluded.panel, icono = excluded.icono, color = excluded.color
returning id, nombre, archivo, grupo, panel;
