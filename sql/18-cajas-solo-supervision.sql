-- 18 (15/11/2026): Recambio de cajas pasa a ser solo de supervisor o más arriba (supervisor, auxiliar, sup_gral, admin),
-- igual que Supervisión de Bolsones. Antes (sql/16) cualquier usuario activo veía, pedía y cambiaba.
-- El enum rol va admin < sup_gral < auxiliar < supervisor < operador: "<= 'supervisor'" deja afuera al operador.
-- Se puede correr más de una vez.

drop policy if exists "usuarios ven cajas" on public.cajas;
drop policy if exists "supervision ve cajas" on public.cajas;
create policy "supervision ve cajas" on public.cajas for select to authenticated using (public.mi_rol() <= 'supervisor');

drop policy if exists "usuarios ven recambios" on public.cajas_recambios;
drop policy if exists "supervision ve recambios" on public.cajas_recambios;
create policy "supervision ve recambios" on public.cajas_recambios for select to authenticated using (public.mi_rol() <= 'supervisor');

drop policy if exists "usuarios piden recambios" on public.cajas_recambios;
drop policy if exists "supervision pide recambios" on public.cajas_recambios;
create policy "supervision pide recambios" on public.cajas_recambios for insert to authenticated with check (public.mi_rol() <= 'supervisor');

drop policy if exists "usuarios cambian recambios" on public.cajas_recambios;
drop policy if exists "supervision cambia recambios" on public.cajas_recambios;
create policy "supervision cambia recambios" on public.cajas_recambios for update to authenticated
  using (public.mi_rol() <= 'supervisor') with check (public.mi_rol() <= 'supervisor');

-- Quedan igual: "admin cambia cajas" y "admin borra recambios"

select tablename, policyname, cmd from pg_policies where tablename in ('cajas', 'cajas_recambios') order by 1, 2;
