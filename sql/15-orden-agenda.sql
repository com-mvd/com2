-- 15 (13/11/2026): en el recuadro Agenda del panel Supervisor, Supervisión de Agenda va primero y el Planificador
-- debajo (pedido del usuario). Ya aplicado: lo hizo Claude con la sesión del admin desde la página
-- (regla "admin modifica secciones").
update public.secciones set orden = 10 where id = 'supervision-agenda';
update public.secciones set orden = 20 where id = 'planificador-agenda';
