-- 19 (15/11/2026): Recambio de cajas, a pedido del usuario.
--  * La tarjeta del panel Supervisor lleva el mismo ícono y color que las demás de Bolsones (documento, ámbar).
--  * En curso (pendiente): supervisor, auxiliar, sup gral y admin pueden editar, cerrar y borrar.
--  * Historial (ya realizado): editar y borrar solo el admin. Ya no se puede volver a pendiente desde la página.
-- El enum rol va admin < sup_gral < auxiliar < supervisor < operador. Se puede correr más de una vez.

update public.secciones set icono = 'documento', color = 'amber' where id = 'recambio-cajas-sup';

-- Cambiar: la fila de antes tiene que estar pendiente (o ser el admin). Cerrarla (pasar a realizado) sigue permitido.
drop policy if exists "supervision cambia recambios" on public.cajas_recambios;
create policy "supervision cambia recambios" on public.cajas_recambios for update to authenticated
  using (public.mi_rol() <= 'supervisor' and (estado = 'pendiente' or public.mi_rol() = 'admin'))
  with check (public.mi_rol() <= 'supervisor');

-- Borrar: el admin cualquiera; el resto de supervisión solo los pendientes
drop policy if exists "admin borra recambios" on public.cajas_recambios;
drop policy if exists "supervision borra recambios" on public.cajas_recambios;
create policy "supervision borra recambios" on public.cajas_recambios for delete to authenticated
  using (public.mi_rol() = 'admin' or (public.mi_rol() <= 'supervisor' and estado = 'pendiente'));

select tablename, policyname, cmd from pg_policies where tablename = 'cajas_recambios' order by 2;
select id, nombre, icono, color from public.secciones where grupo = 'Bolsones' order by orden;
