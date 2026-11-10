-- 09 (10/11/2026): las cargas de Barrios Sustentables Cerro y Edificio IM pasan del panel Supervisor al
-- panel Admin (pedido del usuario), en su propio grupo "Cargas". Las páginas también quedan solo para admin
-- (COM2.acceso con roles ['admin']). Siguen pidiendo su clave de carga.
update public.secciones set panel = 'admin', grupo = 'Cargas', icono = 'bolsa', color = 'teal'
where id in ('carga-cerro', 'carga-edificio-im');

select id, nombre, grupo, orden, panel, icono, color from public.secciones order by panel, grupo, orden;
