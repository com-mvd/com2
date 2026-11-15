-- 16 (15/11/2026): Recambio de cajas. Pasa a COM 2 la planilla "Vaciados Cajas 2026" (Ingreso → Pendientes →
-- Resueltos, con dos Apps Script). Desde el 15/11 solo supervisor o más arriba (sql/18 cambia los permisos).
--   cajas:            catálogo lugar + caja (+ empresa). activa = se puede pedir hoy; las viejas quedan para la historia
--   cajas_recambios:  un pedido de recambio por fila, de pendiente a realizado (o cancelado)
-- Reemplaza lo que hacían los scripts:
--   - "ya existe un vaciado pendiente para ese lugar y caja" → índice único parcial (vale aunque carguen dos a la vez)
--   - la fecha del pedido no puede ser futura y la de realizado tiene que ser posterior → trigger
--   - quién cargó, quién resolvió y quién cambió algo → columnas *_por y *_nombre (las llena el trigger)
-- Se puede correr más de una vez.

create table if not exists public.cajas (
  lugar   text not null,
  caja    text not null,
  empresa text not null default '',
  activa  boolean not null default true,
  orden   int not null default 100,
  primary key (lugar, caja)
);

create table if not exists public.cajas_recambios (
  id              bigint generated always as identity primary key,
  lugar           text not null,
  caja            text not null,
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'realizado', 'cancelado')),
  pedido          timestamp not null,          -- fecha y hora del pedido, hora de Montevideo (sin zona)
  obs_pedido      text not null default '',
  prioridad       int check (prioridad between 1 and 99),   -- orden que se le da a la empresa (1 = primero)
  eta             timestamp,                   -- hora estimada que dio la empresa
  realizado       timestamp,                   -- fecha y hora en que se hizo el recambio
  obs_realizado   text not null default '',
  creado          timestamptz not null default now(),
  creado_por      uuid default auth.uid() references auth.users (id) on delete set null,
  creado_nombre   text not null default '',
  resuelto_por    uuid references auth.users (id) on delete set null,
  resuelto_nombre text not null default '',
  modificado      timestamptz,
  modificado_por  uuid references auth.users (id) on delete set null,
  modificado_nombre text not null default '',
  foreign key (lugar, caja) references public.cajas (lugar, caja) on update cascade,
  check ((estado = 'realizado') = (realizado is not null)),
  check (realizado is null or realizado >= pedido),
  check (length(obs_pedido) <= 500 and length(obs_realizado) <= 500)
);
create index if not exists cajas_recambios_pedido on public.cajas_recambios (pedido desc);
-- Un solo pendiente por lugar y caja
create unique index if not exists cajas_un_pendiente on public.cajas_recambios (lugar, caja) where estado = 'pendiente';

-- Nombre de quien hace el cambio (los operadores no pueden leer perfiles ajenos: por eso se guarda el nombre)
create or replace function public.cajas_mi_nombre()
returns text language sql stable security definer set search_path = public as
$$ select coalesce((select nombre from public.perfiles where id = auth.uid()), '') $$;

create or replace function public.cajas_recambios_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ahora timestamp := (now() at time zone 'America/Montevideo');
  -- false en la copia de la planilla (cajas_importar): ahí se respetan fechas, nombres y estados que vienen
  usuario boolean := auth.uid() is not null and coalesce(current_setting('cajas.importando', true), '') <> '1';
begin
  if tg_op = 'INSERT' then
    if usuario then
      new.creado := now();
      new.creado_por := auth.uid();
      new.creado_nombre := public.cajas_mi_nombre();
      if new.estado <> 'pendiente' then raise exception 'Un pedido nuevo empieza pendiente'; end if;
      if not exists (select 1 from public.cajas where lugar = new.lugar and caja = new.caja and activa) then
        raise exception 'Esa caja no está habilitada en ese lugar';
      end if;
    end if;
  else
    -- Lo de la carga no se cambia
    new.creado := old.creado; new.creado_por := old.creado_por; new.creado_nombre := old.creado_nombre;
    new.modificado := now(); new.modificado_por := auth.uid(); new.modificado_nombre := public.cajas_mi_nombre();
    if new.estado = 'realizado' and old.estado <> 'realizado' then
      new.resuelto_por := auth.uid(); new.resuelto_nombre := public.cajas_mi_nombre();
    elsif new.estado <> 'realizado' then
      new.resuelto_por := null; new.resuelto_nombre := ''; new.realizado := null;
    else
      new.resuelto_por := old.resuelto_por; new.resuelto_nombre := old.resuelto_nombre;
    end if;
  end if;
  if usuario then
    if new.pedido > ahora + interval '5 minutes' then raise exception 'La fecha y hora del pedido no puede ser futura'; end if;
    if new.realizado > ahora + interval '5 minutes' then raise exception 'La fecha y hora de realizado no puede ser futura'; end if;
  end if;
  return new;
end $$;
drop trigger if exists cajas_recambios_antes on public.cajas_recambios;
create trigger cajas_recambios_antes before insert or update on public.cajas_recambios
  for each row execute function public.cajas_recambios_antes();

-- Permisos: supervisor o más arriba ve, pide, resuelve y corrige (15/11; antes, cualquier usuario activo). Borrar: solo el admin
-- (para sacar un pedido mal hecho se usa "Cancelar", que queda registrado).
alter table public.cajas enable row level security;
alter table public.cajas_recambios enable row level security;

drop policy if exists "usuarios ven cajas" on public.cajas;
create policy "usuarios ven cajas" on public.cajas for select to authenticated using (public.mi_rol() <= 'supervisor');
drop policy if exists "admin cambia cajas" on public.cajas;
create policy "admin cambia cajas" on public.cajas for all to authenticated
  using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

drop policy if exists "usuarios ven recambios" on public.cajas_recambios;
create policy "usuarios ven recambios" on public.cajas_recambios for select to authenticated using (public.mi_rol() <= 'supervisor');
drop policy if exists "usuarios piden recambios" on public.cajas_recambios;
create policy "usuarios piden recambios" on public.cajas_recambios for insert to authenticated with check (public.mi_rol() <= 'supervisor');
drop policy if exists "usuarios cambian recambios" on public.cajas_recambios;
create policy "usuarios cambian recambios" on public.cajas_recambios for update to authenticated
  using (public.mi_rol() <= 'supervisor') with check (public.mi_rol() <= 'supervisor');
drop policy if exists "admin borra recambios" on public.cajas_recambios;
create policy "admin borra recambios" on public.cajas_recambios for delete to authenticated using (public.mi_rol() = 'admin');

revoke all on public.cajas, public.cajas_recambios from anon;
grant select, insert, update, delete on public.cajas to authenticated;
grant select, insert, update, delete on public.cajas_recambios to authenticated;
revoke execute on function public.cajas_mi_nombre() from public, anon;
grant execute on function public.cajas_mi_nombre() to authenticated;

-- Copia única de la planilla "Vaciados Cajas 2026" (la llama el admin desde la página, con el JSON que arma
-- Desktop/IA/recambio-cajas/armar_importacion.py). Conserva fechas y deja "Planilla" como quién cargó y resolvió.
create or replace function public.cajas_importar(filas jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public.mi_rol() is distinct from 'admin' then raise exception 'Solo el administrador puede copiar la planilla'; end if;
  if exists (select 1 from public.cajas_recambios where creado_nombre = 'Planilla') then raise exception 'La planilla ya se copió'; end if;
  perform set_config('cajas.importando', '1', true);
  insert into public.cajas_recambios (lugar, caja, estado, pedido, obs_pedido, realizado, obs_realizado, creado, creado_nombre, resuelto_nombre)
  select x.lugar, x.caja, x.estado, x.pedido, coalesce(x.obs_pedido, ''), x.realizado, coalesce(x.obs_realizado, ''),
         x.pedido at time zone 'America/Montevideo', 'Planilla', case when x.estado = 'realizado' then 'Planilla' else '' end
  from jsonb_to_recordset(filas) as x(lugar text, caja text, estado text, pedido timestamp, obs_pedido text, realizado timestamp, obs_realizado text);
  get diagnostics n = row_count;
  perform set_config('cajas.importando', '', true);
  return n;
end $$;
revoke execute on function public.cajas_importar(jsonb) from public, anon;
grant execute on function public.cajas_importar(jsonb) to authenticated;

-- En vivo: los cambios de uno le llegan a los demás sin recargar (Realtime respeta RLS)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cajas_recambios') then
    alter publication supabase_realtime add table public.cajas_recambios;
  end if;
end $$;

-- Catálogo: las activas son las de la hoja AUX de la planilla; las demás aparecen solo en la historia
insert into public.cajas (lugar, caja, empresa, activa, orden) values
  ('Univar', 'Volkemax', 'Volkemax', true, 10),
  ('Univar', 'Volkemax 2', 'Volkemax', true, 11),
  ('Univar', 'Volkemax 3', 'Volkemax', true, 12),
  ('Univar', 'Richard Gonzalez 1', 'Richard Gonzalez', true, 20),
  ('Univar', 'Richard Gonzalez 2', 'Richard Gonzalez', true, 21),
  ('Univar', 'Contenedores plasticos', 'Contenedores plásticos', true, 30),
  ('Filadelfia', 'Volkemax', 'Volkemax', false, 10),
  ('Filadelfia', 'Richard Gonzalez 1', 'Richard Gonzalez', true, 20),
  ('Filadelfia', 'Richard Gonzalez 2', 'Richard Gonzalez', true, 21),
  ('Faro', 'Volkemax', 'Volkemax', true, 10),
  ('Faro', 'Richard Gonzalez 1', 'Richard Gonzalez', true, 20),
  -- solo en la historia
  ('Univar', 'Volkemax apoyo', 'Volkemax', false, 13),
  ('Univar', 'Richard Gonzalez', 'Richard Gonzalez', false, 19),
  ('Univar', 'Richard Gonzalez 3', 'Richard Gonzalez', false, 22),
  ('Univar', 'Richard Gonzalez 4', 'Richard Gonzalez', false, 23),
  ('Univar', 'Richard Gonzalez Voluminosos', 'Richard Gonzalez', false, 24),
  ('Filadelfia', 'Richard Gonzalez 3', 'Richard Gonzalez', false, 22),
  ('Faro', 'Richard Gonzalez 2', 'Richard Gonzalez', false, 21),
  ('Faro', 'Richard Gonzalez 3', 'Richard Gonzalez', false, 22)
on conflict (lugar, caja) do update set empresa = excluded.empresa, activa = excluded.activa, orden = excluded.orden;

-- Las tarjetas del menú van aparte (sql/17-cajas-menu.sql), recién cuando la página esté publicada.

select (select count(*) from public.cajas) as cajas, (select count(*) from public.cajas where activa) as activas,
       (select count(*) from public.cajas_recambios) as recambios;
