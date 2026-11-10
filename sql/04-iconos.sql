-- COM 2 — ícono y color de cada tarjeta del menú (mismo estilo que el index de Dashboard).
-- Pegar entero en Supabase → SQL Editor → Run. Se puede correr más de una vez.
--   icono: nombre de un ícono de assets/comun.js (ICONOS): usuarios, planilla, documento, tareas, calendario, camion, mapa, bolsa, grafico
--   color: teal, blue, amber, violet

alter table public.secciones add column if not exists icono text not null default 'planilla';
alter table public.secciones add column if not exists color text not null default 'teal'
  check (color in ('teal', 'blue', 'amber', 'violet'));

update public.secciones set icono = 'usuarios', color = 'violet' where id = 'usuarios';
