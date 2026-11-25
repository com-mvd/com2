-- Ejecutar cuando GitHub Pages ya sirva la versión de Monitoreo de plantas.
begin;

update public.secciones set nombre = 'Monitoreo de plantas' where id = 'recambio-cajas-sup';

insert into public.secciones (id, nombre, archivo, grupo, orden, panel, icono, color)
values ('recambio-cajas', 'Monitoreo de plantas', 'recambio-cajas.html', 'Generales', 20, 'operador', 'documento', 'amber')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, panel = excluded.panel, icono = excluded.icono, color = excluded.color;

commit;
