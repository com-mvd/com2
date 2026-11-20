begin;

-- Las cargas nuevas omiten la hora inicial. Las horas ya registradas se conservan.
alter table public.zona_limpia_municipal_cargas alter column hora_inicio drop not null;

grant delete on public.zona_limpia_municipal_cargas to authenticated;

create policy "admin borra cargas municipales" on public.zona_limpia_municipal_cargas
  for delete to authenticated using (
    (select public.mi_rol()) = 'admin'
    and exists (
      select 1 from public.perfiles where id = (select auth.uid()) and not debe_cambiar_clave
    )
  );

commit;
