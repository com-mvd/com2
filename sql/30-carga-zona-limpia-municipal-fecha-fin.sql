begin;

-- Fecha y hora local de Montevideo. Las cargas anteriores solo tienen hora_fin.
alter table public.zona_limpia_municipal_cargas
  add column fecha_hora_fin timestamp(0) without time zone,
  add constraint cargas_municipales_hora_fin_coincide
    check (fecha_hora_fin is null or fecha_hora_fin::time = hora_fin);

grant insert (fecha_hora_fin) on public.zona_limpia_municipal_cargas to authenticated;

commit;
