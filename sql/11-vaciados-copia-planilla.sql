-- Copia de la planilla "Validación Barrios Sustentables" (10/11/2026): las filas con bolsones > 0 que leía el tablero.
insert into public.vaciados (tablero, edificio, direccion, fecha, bolsones)
select v.tablero, v.edificio, l.direccion, v.fecha::timestamp, v.bolsones
from (values
  ('cerro', 'Plaza Débora Céspedes', '2026-10-22 16:44', 1),
  ('cerro', 'Federación FOICA', '2026-10-22 17:35', 1),
  ('cerro', 'Plaza Débora Céspedes', '2026-10-24 17:02', 1),
  ('cerro', 'Plaza Débora Céspedes', '2026-10-26 16:17', 2),
  ('cerro', 'Federación FOICA', '2026-10-27 10:25', 2),
  ('cerro', 'Plaza Débora Céspedes', '2026-10-28 13:22', 1),
  ('cerro', 'Federación FOICA', '2026-10-28 14:10', 1),
  ('cerro', 'Plaza Débora Céspedes', '2026-11-01 17:30', 2),
  ('cerro', 'Plaza de Deportes N11', '2026-11-03 16:49', 2),
  ('cerro', 'Plaza de Deportes N11', '2026-10-28 14:52', 2),
  ('cerro', 'Plaza Débora Céspedes', '2026-10-20 17:45', 1),
  ('cerro', 'Federación FOICA', '2026-11-03 13:02', 3),
  ('cerro', 'Plaza Débora Céspedes', '2026-11-06 11:15', 2),
  ('cerro', 'Plaza de Deportes N11', '2026-11-06 13:20', 2),
  ('cerro', 'Seccional N24', '2026-11-09 12:00', 2),
  ('cerro', 'Escuela Luisa Casteran', '2026-11-09 12:24', 2),
  ('cerro', 'Club de Pesca', '2026-11-09 13:12', 1),
  ('im', 'Edificio IM', '2026-11-03 11:17', 1),
  ('im', 'Edificio IM', '2026-11-04 09:40', 4),
  ('im', 'Edificio IM', '2026-11-05 09:25', 2),
  ('im', 'Edificio IM', '2026-11-06 07:22', 2),
  ('im', 'Edificio IM', '2026-11-09 10:26', 4),
  ('im', 'Edificio IM', '2026-11-10 08:43', 1)
) as v (tablero, edificio, fecha, bolsones)
join public.vaciados_lugares l on l.tablero = v.tablero and l.nombre = v.edificio
where not exists (select 1 from public.vaciados);   -- una sola vez

select tablero, count(*) as cargas, sum(bolsones) as bolsones, min(fecha), max(fecha) from public.vaciados group by tablero order by tablero;