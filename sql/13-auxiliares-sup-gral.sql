-- 13 (13/11/2026): roles y paneles nuevos "Auxiliares" y "Sup Gral" (pedido del usuario).
-- Orden de los paneles en la barra: Operador · Supervisor · Auxiliares · Sup Gral · Admin.
-- Cada rol sigue viendo su panel y los de abajo (escalera, elegido por el usuario):
--   operador  → Operador
--   supervisor → Operador, Supervisor
--   auxiliar  → Operador, Supervisor, Auxiliares
--   sup_gral  → Operador, Supervisor, Auxiliares, Sup Gral
--   admin     → todos
-- El tipo rol se compara por su orden de declaración ("mi_rol() <= panel" = "estoy a la altura o más arriba"),
-- así que los valores nuevos se agregan en su lugar: admin, sup_gral, auxiliar, supervisor, operador.
-- No crea usuarios: el admin les cambia el rol desde Usuarios.

alter type public.rol add value if not exists 'auxiliar' before 'supervisor';
alter type public.rol add value if not exists 'sup_gral' before 'auxiliar';

-- Lo que antes era "admin o supervisor" pasa a ser "supervisor o más arriba", así Auxiliares y Sup Gral
-- también ven la lista de perfiles y los datos privados de las bases (teléfonos, notas), como el supervisor.
drop policy if exists "ver perfiles" on public.perfiles;
create policy "ver perfiles" on public.perfiles for select to authenticated
  using (id = auth.uid() or public.mi_rol() <= 'supervisor');

drop policy if exists "supervisores leen privado" on storage.objects;
create policy "supervisores leen privado" on storage.objects for select to authenticated
  using (bucket_id = 'privado' and public.mi_rol() <= 'supervisor');

-- Comprobación, en una consulta aparte DESPUÉS de correr lo de arriba (los valores nuevos de un enum no se
-- pueden usar en la misma tanda en que se agregan). Tiene que listar admin, sup_gral, auxiliar, supervisor, operador:
--   select unnest(enum_range(null::public.rol)) as rol;
