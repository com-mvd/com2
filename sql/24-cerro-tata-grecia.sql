-- 24 (17/11/2026): Barrios Sustentables Cerro suma un punto: TATA Grecia (Ta-Ta de Grecia, 3396 aprox.).
-- Ubicación del link de Google Maps que pasó el usuario (-34.8903134, -56.2479785; va en LUGARES del tablero de dashboard).
-- También va en LUGARES de barrios-sustentables-carga.html (com-2) y de barrios-sustentables-cerro.html (dashboard).
insert into public.vaciados_lugares (tablero, nombre, direccion, orden) values
  ('cerro', 'TATA Grecia', 'GRECIA 3396', 100)
on conflict (tablero, nombre) do update set direccion = excluded.direccion, orden = excluded.orden;

select tablero, nombre, direccion, orden from public.vaciados_lugares where tablero = 'cerro' order by orden;
