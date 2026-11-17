-- 23 (17/11/2026): menú del panel Supervisor, a pedido del usuario. Correr DESPUÉS de publicar index.html y
-- monitoreo-intradomiciliarios.html.
--   - Recuadro nuevo "Intradomiciliarios" (verde, sin Actualizar; sale de SERVICIOS en index.html): pasan ahí el
--     Trazador de recorridos y el Monitoreo Intradomiciliarios, que reemplaza al Generador de informes
--     (generador-informes.html se borró del repo). Zona Limpia queda sin páginas por ahora.
--   - Reclamos Coordinación sale del panel Supervisor: queda solo en el Operador (recuadro Generales). Los supervisores
--     igual lo ven, porque cada rol ve también los paneles de abajo.
update public.secciones set grupo = 'Intradomiciliarios', orden = 10 where id = 'trazador-recorridos';
update public.secciones set nombre = 'Monitoreo Intradomiciliarios', archivo = 'monitoreo-intradomiciliarios.html',
  grupo = 'Intradomiciliarios', orden = 20 where id = 'generador-informes';
delete from public.secciones where id = 'reclamos-coordinacion';

select id, nombre, archivo, grupo, orden, panel from public.secciones
where grupo in ('Intradomiciliarios', 'Zona Limpia', 'Generales') order by panel, grupo, orden;
