-- Recambios de cajas: el operador registra la caja llena y supervisión completa el pedido.
begin;

alter table public.cajas_recambios
  add column if not exists llena timestamp,
  add column if not exists llena_regularizada boolean not null default false,
  alter column pedido drop not null;

-- Las filas históricas conservan el pedido; la hora de llenado no se registraba.
alter table public.cajas_recambios
  drop constraint if exists cajas_recambios_secuencia_fechas;
alter table public.cajas_recambios
  add constraint cajas_recambios_secuencia_fechas check (
    (llena is not null or pedido is not null)
    and (not llena_regularizada or llena is not null)
    and (llena_regularizada or pedido is null or llena is null or pedido >= llena)
    and (realizado is null or (pedido is not null and realizado >= pedido))
  );

create or replace function public.cajas_validar_llena()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.llena is distinct from old.llena or new.llena_regularizada is distinct from old.llena_regularizada then
      raise exception 'La fecha y hora de caja llena no se puede cambiar';
    end if;
  elsif new.llena_regularizada then
    raise exception 'La regularización de caja llena se realiza desde la migración';
  end if;
  if auth.uid() is not null and new.llena > (now() at time zone 'America/Montevideo') + interval '5 minutes' then
    raise exception 'La fecha y hora de caja llena no puede ser futura';
  end if;
  return new;
end $$;

drop trigger if exists cajas_validar_llena on public.cajas_recambios;
create trigger cajas_validar_llena before insert or update on public.cajas_recambios
  for each row execute function public.cajas_validar_llena();

drop policy if exists "supervision ve cajas" on public.cajas;
drop policy if exists "usuarios activos ven cajas" on public.cajas;
create policy "usuarios activos ven cajas" on public.cajas for select to authenticated
  using ((select public.mi_rol()) <= 'operador');

-- El operador consulta los recambios abiertos y los cerrados de las tres plantas.
drop policy if exists "operador ve recambios en curso" on public.cajas_recambios;
drop policy if exists "operador consulta recambios" on public.cajas_recambios;
create policy "operador consulta recambios" on public.cajas_recambios for select to authenticated
  using ((select public.mi_rol()) = 'operador' and estado in ('pendiente', 'realizado'));

-- Las reglas existentes de actualización y borrado siguen reservadas a supervisión.
drop policy if exists "operador registra caja llena" on public.cajas_recambios;
create policy "operador registra caja llena" on public.cajas_recambios for insert to authenticated
  with check (
    (select public.mi_rol()) = 'operador'
    and estado = 'pendiente' and llena is not null and not llena_regularizada and pedido is null
    and obs_pedido = '' and eta is null and prioridad is null
    and realizado is null and obs_realizado = ''
    and resuelto_por is null and resuelto_nombre = ''
    and modificado is null and modificado_por is null and modificado_nombre = ''
  );

notify pgrst, 'reload schema';

commit;
