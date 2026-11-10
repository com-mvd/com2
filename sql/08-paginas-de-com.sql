-- 08 (10/11/2026): el resto de las páginas del repo com pasan a COM 2, panel Supervisor, cada una en el
-- recuadro de su servicio (grupo = nombre del servicio, ver SERVICIOS en index.html).
-- Las cargas de Barrios Sustentables Cerro y Edificio IM van en Bolsones (siguen pidiendo su clave de carga).
-- Todas con el ícono de documento, como en la portada de com.
insert into public.secciones (id, nombre, archivo, grupo, orden, panel, icono, color) values
  ('supervision-bolsones', 'Supervisión de Bolsones', 'supervision-bolsones.html', 'Bolsones', 10, 'supervisor', 'documento', 'amber'),
  ('carga-cerro', 'Carga Barrios Sustentables: Cerro', 'barrios-sustentables-carga.html', 'Bolsones', 20, 'supervisor', 'documento', 'amber'),
  ('carga-edificio-im', 'Carga vaciados edificio IM', 'bolsones-edificio-im-carga.html', 'Bolsones', 30, 'supervisor', 'documento', 'amber'),
  ('planificador-agenda', 'Planificador de Agenda', 'planificador-agenda.html', 'Agenda', 10, 'supervisor', 'documento', 'blue'),
  ('trazador-recorridos', 'Trazador de recorridos intradomiciliarios', 'trazador-recorridos.html', 'Zona Limpia', 10, 'supervisor', 'documento', 'teal'),
  ('generador-informes', 'Generador de informes intradomiciliarios', 'generador-informes.html', 'Zona Limpia', 20, 'supervisor', 'documento', 'teal')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, panel = excluded.panel, icono = excluded.icono, color = excluded.color;

select id, nombre, grupo, orden, panel, icono from public.secciones order by panel, grupo, orden;
