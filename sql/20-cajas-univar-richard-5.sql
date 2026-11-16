-- 20 (16/11/2026): Recambio de cajas, a pedido del usuario.
-- Univar pasa a tener 5 cajas de Richard Gonzalez (antes 2): se reactivan la 3 y la 4 (estaban inactivas,
-- con historia de la planilla) y se suma la 5. La página no cambia: lee las activas de la tabla cajas.
-- Se puede correr más de una vez.

insert into public.cajas (lugar, caja, empresa, activa, orden) values
  ('Univar', 'Richard Gonzalez 3', 'Richard Gonzalez', true, 22),
  ('Univar', 'Richard Gonzalez 4', 'Richard Gonzalez', true, 23),
  ('Univar', 'Richard Gonzalez 5', 'Richard Gonzalez', true, 24)
on conflict (lugar, caja) do update set empresa = excluded.empresa, activa = excluded.activa, orden = excluded.orden;

-- "Richard Gonzalez Voluminosos" (vieja, inactiva) deja el orden 24 a la 5
update public.cajas set orden = 25 where lugar = 'Univar' and caja = 'Richard Gonzalez Voluminosos';

select lugar, caja, empresa, activa, orden from public.cajas where lugar = 'Univar' order by activa desc, orden, caja;
