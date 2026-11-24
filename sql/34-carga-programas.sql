-- Puntos nuevos de Municipio A para Carga Patricia.
begin;

insert into public.vaciados_lugares (tablero, nombre, direccion, orden) values
  ('cerro', 'Cooperativa Mesa 4', 'Av. Luis Batlle Berres 5870', 110),
  ('cerro', 'Colegio Centro Infantil Kala – Bethuel', 'Av. Cibils 5878', 120),
  ('cerro', 'Colegio Kala Infantil', 'Fray Luis de León 2458', 130),
  ('cerro', 'Sede Social Las Torres Tomkinson', 'Francisco de Quevedo 6081', 140),
  ('cerro', 'CAIF Anacahuita', 'Las Lilas esq. Los Lirios', 150),
  ('cerro', 'Club Baby Fútbol Naranja Mecánica', 'Costanera Parque Tomkinson esq. Los Plátanos', 160),
  ('cerro', 'Escuela 188', 'Camino Cibils 6221 esq. Mirunga', 170)
on conflict (tablero, nombre) do update set direccion = excluded.direccion, orden = excluded.orden;

commit;
