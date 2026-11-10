-- 07 (10/11/2026): Supervisión de Bolsones pasa del repo com a COM 2, en el panel Supervisor,
-- dentro del recuadro del servicio Bolsones (grupo = 'Bolsones', ver SERVICIOS en index.html).
insert into public.secciones (id, nombre, archivo, grupo, orden, panel, icono, color)
values ('supervision-bolsones', 'Supervisión de Bolsones', 'supervision-bolsones.html', 'Bolsones', 10, 'supervisor', 'bolsa', 'amber')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, panel = excluded.panel, icono = excluded.icono, color = excluded.color;

select id, nombre, archivo, grupo, orden, panel, icono, color, activa from public.secciones order by panel, grupo, orden;
