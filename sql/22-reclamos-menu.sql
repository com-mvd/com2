-- 22 (17/11/2026): tarjetas de Reclamos Coordinación en el menú. Correr DESPUÉS de publicar reclamos-coordinacion.html y el
-- index.html con el recuadro Generales (si no, la tarjeta lleva a una página que todavía no existe). Va después de sql/21.
-- Recuadro "Generales" (17/11): a la izquierda de los servicios en el panel Supervisor, sin botón Actualizar, y el mismo
-- recuadro en el panel Operador. El recuadro sale de SERVICIOS en index.html; sus páginas son las filas con grupo 'Generales'.
insert into public.secciones (id, nombre, archivo, grupo, orden, panel, icono, color) values
  ('reclamos-coordinacion', 'Reclamos Coordinación', 'reclamos-coordinacion.html', 'Generales', 10, 'supervisor', 'mapa', 'violet'),
  ('reclamos-coordinacion-op', 'Reclamos Coordinación', 'reclamos-coordinacion.html', 'Generales', 10, 'operador', 'mapa', 'violet')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, panel = excluded.panel, icono = excluded.icono, color = excluded.color;

select id, nombre, grupo, orden, panel from public.secciones where grupo = 'Generales' order by panel;
