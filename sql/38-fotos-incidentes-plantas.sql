-- La foto se guarda con el incidente y se consulta con los mismos permisos.
begin;

alter table public.incidentes_plantas add column if not exists foto text;
alter table public.incidentes_plantas add column if not exists tiene_foto boolean
  generated always as (foto is not null) stored;

alter table public.incidentes_plantas drop constraint if exists incidente_foto_jpeg;
-- NOT VALID conserva los registros anteriores. Las nuevas filas deben incluir foto.
alter table public.incidentes_plantas add constraint incidente_foto_jpeg check (
  foto is not null and char_length(foto) <= 500000
  and foto ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]+={0,2}$'
) not valid;

grant insert (foto) on public.incidentes_plantas to authenticated;
notify pgrst, 'reload schema';

commit;
