-- Agrega Supervisión de Agenda al panel Supervisor cuando su página esté publicada.
insert into public.secciones (id, nombre, archivo, grupo, orden, panel, icono, color)
values ('supervision-agenda', 'Supervisión de Agenda', 'supervision-agenda.html', 'Agenda', 20, 'supervisor', 'calendario', 'blue')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, panel = excluded.panel, icono = excluded.icono, color = excluded.color;
