-- 05 (10/11/2026): bucket "bases" de Storage, donde n8n sube las bases del Grafana (antes iban al repo com-mvd/bases).
-- Público para leer (las páginas bajan los archivos por /storage/v1/object/public/bases/...).
-- Escribir: solo con la clave secret (n8n). No hay políticas en storage.objects, así que anon y
-- authenticated no pueden subir, cambiar ni borrar nada.
-- Lo público ya viene limpio y lo privado, cifrado con la contraseña del sitio (igual que en GitHub).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bases', 'bases', true, 52428800, array['application/json', 'application/gzip'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'bases';
