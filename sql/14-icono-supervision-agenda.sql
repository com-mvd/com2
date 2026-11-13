-- 14 (13/11/2026): la tarjeta de Supervisión de Agenda lleva el mismo ícono que las demás páginas (documento),
-- pedido del usuario. Ya aplicado: lo hizo Claude con la sesión del admin desde la página (regla "admin modifica secciones").
update public.secciones set icono = 'documento' where id = 'supervision-agenda';
