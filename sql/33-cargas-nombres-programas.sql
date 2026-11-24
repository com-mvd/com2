-- 33 (24/11/2026): nombres de las tarjetas de carga del panel Admin, iguales a los programas de dashboard/programas.html.
-- La de Cerro carga los dos programas de Cerro (Barrios Sustentables y Escuelas Sustentables); la de IM es el
-- "Programa Eco Oficinas". Solo cambia el nombre que se ve: archivo, panel y permisos quedan igual.

update public.secciones set nombre = 'Carga Barrios y Escuelas Sustentables' where id = 'carga-cerro';
update public.secciones set nombre = 'Carga Programa Eco Oficinas'           where id = 'carga-edificio-im';

select id, nombre, archivo, panel from public.secciones where id in ('carga-cerro', 'carga-edificio-im');
