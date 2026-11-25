-- Regularización de la salida de Monitoreo de plantas, hora de Montevideo.
begin;

-- El bloqueo de ALTER TABLE se conserva hasta el commit. Se preserva la auditoría previa.
alter table public.cajas_recambios disable trigger cajas_validar_llena;
alter table public.cajas_recambios disable trigger cajas_recambios_antes;

with actualizados as (
  update public.cajas_recambios
  set llena = timestamp '2026-11-24 21:00:00', llena_regularizada = true
  where estado = 'pendiente' and llena is null
  returning id
)
select count(*) as solicitudes_regularizadas from actualizados;

alter table public.cajas_recambios enable trigger cajas_recambios_antes;
alter table public.cajas_recambios enable trigger cajas_validar_llena;

commit;
