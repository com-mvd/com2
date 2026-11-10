-- 06 (10/11/2026): bucket "privado" de Storage, con los datos privados de las bases (teléfonos, notas,
-- descripciones completas), SIN cifrar. Reemplaza a los <servicio>-privado.json cifrados con la
-- contraseña del sitio, que estaban en el bucket público "bases".
-- Leer: solo con sesión de COM 2, siendo admin o supervisor y estando activo (mi_rol() da null si
-- el perfil está de baja). Escribir: solo n8n, con la clave secret (que no pasa por las políticas).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('privado', 'privado', false, 52428800, array['application/json', 'application/gzip'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "supervisores leen privado" on storage.objects;
create policy "supervisores leen privado" on storage.objects for select to authenticated
  using (bucket_id = 'privado' and public.mi_rol() in ('admin', 'supervisor'));

select id, public, file_size_limit from storage.buckets where id = 'privado';
