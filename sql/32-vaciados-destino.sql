-- 32 (24/11/2026): "Destino final" de cada vaciado de Barrios Sustentables Cerro y Edificio IM.
-- Se elige en las páginas de carga (panel Admin) y se ve en los informes de dashboard (programas.html).
-- Lo que ya estaba cargado: Cerro → La Paloma, Edificio IM → Géminis (a pedido del usuario).
-- Se puede volver a correr sin problema.

alter table public.vaciados add column if not exists destino text;

alter table public.vaciados drop constraint if exists vaciados_destino_check;
alter table public.vaciados add constraint vaciados_destino_check
  check (destino in ('La Paloma', 'Burgues', 'Durán', 'Géminis', 'Usina 5 bis'));

update public.vaciados set destino = 'La Paloma' where tablero = 'cerro' and destino is null;
update public.vaciados set destino = 'Géminis'   where tablero = 'im'    and destino is null;

-- La vista de los tableros sin login suma el destino (al final, para que create or replace la acepte)
create or replace view public.vaciados_publico as
  select tablero, edificio, fecha, bolsones, destino from public.vaciados where bolsones > 0;
revoke all on public.vaciados_publico from public, anon, authenticated;
grant select on public.vaciados_publico to anon, authenticated;

select tablero, destino, count(*) from public.vaciados group by 1, 2 order by 1, 2;
