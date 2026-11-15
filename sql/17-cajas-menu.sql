-- 17: tarjeta de "Recambio de cajas" en el menú. Correr DESPUÉS de publicar recambio-cajas.html (si no, la
-- tarjeta lleva a una página que todavía no existe). Va solo en el panel Supervisor, dentro del recuadro del
-- servicio Bolsones (grupo 'Bolsones'), después de Supervisión de Bolsones (15/11). Los operadores no la ven.
delete from public.secciones where id = 'recambio-cajas';   -- la del panel Operador (por si se llegó a correr la versión vieja)
insert into public.secciones (id, nombre, archivo, grupo, orden, panel, icono, color) values
  ('recambio-cajas-sup', 'Recambio de cajas', 'recambio-cajas.html', 'Bolsones', 20, 'supervisor', 'camion', 'teal')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, panel = excluded.panel, icono = excluded.icono, color = excluded.color;

select id, nombre, grupo, orden, panel, icono, color from public.secciones where grupo = 'Bolsones' order by orden;
