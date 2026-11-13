-- Agrega Supervisión de Agenda al panel Supervisor cuando su página esté publicada.
-- 13/11: el ícono pasó de 'calendario' a 'documento', como las demás páginas (ver sql/14). Ya corrido.
insert into public.secciones (id, nombre, archivo, grupo, orden, panel, icono, color)
values ('supervision-agenda', 'Supervisión de Agenda', 'supervision-agenda.html', 'Agenda', 20, 'supervisor', 'documento', 'blue')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, panel = excluded.panel, icono = excluded.icono, color = excluded.color;
