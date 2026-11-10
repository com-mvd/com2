-- COM 2 — administración de usuarios (solo el rol admin).
-- Pegar entero en Supabase → SQL Editor → Run. Se puede correr más de una vez.
-- Crear usuarios, restablecer contraseñas, cambiar la cédula y dar de baja tocan auth.users,
-- que la página no puede tocar: lo hacen estas funciones, que primero verifican que quien llama es admin.

-- Corta si quien llama no es admin.
create or replace function public.solo_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.mi_rol() is distinct from 'admin' then
    raise exception 'Solo el administrador puede hacer esto' using errcode = '42501';
  end if;
end $$;

-- Contraseña temporal: 10 caracteres, letras minúsculas y números (sin 0/o/1/l/i para que no se confundan).
create or replace function public.clave_temporal()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  c text := 'abcdefghjkmnpqrstuvwxyz23456789';
  r text;
  b bytea;
begin
  loop
    b := extensions.gen_random_bytes(10);
    r := '';
    for i in 0..9 loop
      r := r || substr(c, 1 + get_byte(b, i) % length(c), 1);
    end loop;
    exit when r ~ '[0-9]' and r ~ '[a-z]';
  end loop;
  return r;
end $$;

-- Cédula: solo números, 7 u 8 dígitos.
create or replace function public.cedula_limpia(p text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare c text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if c !~ '^[0-9]{7,8}$' then raise exception 'La cédula tiene que tener 7 u 8 números'; end if;
  return c;
end $$;

-- Alta: devuelve la contraseña inicial (se muestra una sola vez en la pantalla).
create or replace function public.admin_crear_usuario(p_cedula text, p_nombre text, p_rol public.rol)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_ced   text := public.cedula_limpia(p_cedula);
  v_email text;
  v_id    uuid := gen_random_uuid();
  v_clave text := public.clave_temporal();
begin
  perform public.solo_admin();
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre'; end if;
  v_email := v_ced || '@com.local';
  if exists (select 1 from public.perfiles where usuario = v_ced) or exists (select 1 from auth.users where email = v_email) then
    raise exception 'Ya existe un usuario con la cédula %', v_ced;
  end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_clave, extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', trim(p_nombre)), now(), now(),
    '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), now(), now(), now());
  insert into public.perfiles (id, usuario, nombre, rol) values (v_id, v_ced, trim(p_nombre), p_rol);
  return v_clave;
end $$;

-- Restablecer contraseña: devuelve una nueva contraseña temporal y obliga a cambiarla al entrar.
create or replace function public.admin_restablecer_clave(p_id uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare v_clave text := public.clave_temporal();
begin
  perform public.solo_admin();
  update auth.users set encrypted_password = extensions.crypt(v_clave, extensions.gen_salt('bf', 10)), updated_at = now()
   where id = p_id;
  if not found then raise exception 'No existe ese usuario'; end if;
  update public.perfiles set debe_cambiar_clave = true where id = p_id;
  return v_clave;
end $$;

-- Corregir la cédula (cambia también el usuario con el que entra).
create or replace function public.admin_cambiar_cedula(p_id uuid, p_cedula text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_ced   text := public.cedula_limpia(p_cedula);
  v_email text := v_ced || '@com.local';
begin
  perform public.solo_admin();
  if exists (select 1 from public.perfiles where usuario = v_ced and id <> p_id) then
    raise exception 'Ya existe otro usuario con la cédula %', v_ced;
  end if;
  perform set_config('com.cambio_cedula', '1', true);
  update public.perfiles set usuario = v_ced where id = p_id;
  if not found then raise exception 'No existe ese usuario'; end if;
  update auth.users set email = v_email, updated_at = now() where id = p_id;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', v_email), updated_at = now()
   where user_id = p_id and provider = 'email';
  perform set_config('com.cambio_cedula', '', true);   -- apagar el permiso apenas termina
end $$;

-- Baja / reactivación: la baja también bloquea el login.
create or replace function public.admin_activar(p_id uuid, p_activo boolean)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform public.solo_admin();
  if p_id = auth.uid() and not p_activo then raise exception 'No podés darte de baja a vos mismo'; end if;
  update public.perfiles set activo = p_activo where id = p_id;
  if not found then raise exception 'No existe ese usuario'; end if;
  update auth.users set banned_until = case when p_activo then null else '2999-12-31'::timestamptz end, updated_at = now()
   where id = p_id;
end $$;

-- Protecciones al editar perfiles directo (nombre y rol se editan con un update normal, con RLS de admin):
--  - la cédula solo cambia con admin_cambiar_cedula (si no, no coincidiría con el usuario de login);
--  - el admin no puede quitarse su propio rol ni darse de baja.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.usuario is distinct from old.usuario and current_setting('com.cambio_cedula', true) is distinct from '1' then
    raise exception 'La cédula se cambia con la opción "Corregir cédula"';
  end if;
  if old.id = auth.uid() and (new.rol is distinct from old.rol or not new.activo) then
    raise exception 'No podés cambiar tu propio rol ni darte de baja';
  end if;
  return new;
end $$;

drop trigger if exists proteger_perfil on public.perfiles;
create trigger proteger_perfil before update on public.perfiles
  for each row execute function public.proteger_perfil();

-- Permisos: las funciones de admin las puede llamar cualquiera con login (adentro verifican el rol);
-- las auxiliares no se exponen.
revoke execute on function public.solo_admin(), public.clave_temporal(), public.cedula_limpia(text), public.proteger_perfil()
  from public, anon, authenticated;
revoke execute on function public.admin_crear_usuario(text, text, public.rol), public.admin_restablecer_clave(uuid),
  public.admin_cambiar_cedula(uuid, text), public.admin_activar(uuid, boolean) from public, anon;
grant execute on function public.admin_crear_usuario(text, text, public.rol), public.admin_restablecer_clave(uuid),
  public.admin_cambiar_cedula(uuid, text), public.admin_activar(uuid, boolean) to authenticated;

-- Menú: la pantalla de usuarios, solo para admin.
insert into public.secciones (id, nombre, archivo, grupo, orden, roles)
values ('usuarios', 'Usuarios', 'usuarios.html', 'Administración', 10, '{admin}')
on conflict (id) do update set nombre = excluded.nombre, archivo = excluded.archivo, grupo = excluded.grupo,
  orden = excluded.orden, roles = excluded.roles;
