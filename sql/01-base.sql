-- Portal COM — base: perfiles, roles y menú.
-- Pegar entero en Supabase → SQL Editor → Run. Se puede correr más de una vez.
-- No tiene datos personales: los usuarios se cargan aparte.

-- 1. Roles ------------------------------------------------------------------
do $$ begin
  create type public.rol as enum ('admin', 'supervisor', 'operador');
exception when duplicate_object then null; end $$;

-- 2. Perfiles: uno por usuario de Supabase Auth -------------------------------
create table if not exists public.perfiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  usuario             text not null unique check (usuario ~ '^[0-9]{7,8}$'),  -- cédula, sin puntos ni guion
  nombre              text not null,
  rol                 public.rol not null default 'operador',
  activo              boolean not null default true,
  debe_cambiar_clave  boolean not null default true,
  creado              timestamptz not null default now()
);
alter table public.perfiles enable row level security;

-- Rol del usuario que hace el pedido (null si no tiene perfil o está inactivo).
create or replace function public.mi_rol()
returns public.rol
language sql stable security definer set search_path = public
as $$ select rol from public.perfiles where id = auth.uid() and activo $$;

-- Lo llama la página después de que el usuario cambia su contraseña.
create or replace function public.clave_cambiada()
returns void
language sql security definer set search_path = public
as $$ update public.perfiles set debe_cambiar_clave = false where id = auth.uid() $$;

drop policy if exists "ver perfiles" on public.perfiles;
create policy "ver perfiles" on public.perfiles for select to authenticated
  using (id = auth.uid() or public.mi_rol() in ('admin', 'supervisor'));

drop policy if exists "admin modifica perfiles" on public.perfiles;
create policy "admin modifica perfiles" on public.perfiles for all to authenticated
  using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

-- 3. Secciones del menú: qué ve cada rol en el index ---------------------------
create table if not exists public.secciones (
  id      text primary key,               -- ej. 'barrios-cerro'
  nombre  text not null,                  -- lo que se ve en el botón
  archivo text not null,                  -- página, ej. 'barrios-cerro.html'
  grupo   text not null default 'General',
  orden   int  not null default 100,
  roles   public.rol[] not null default '{supervisor}',
  activa  boolean not null default true
);
alter table public.secciones enable row level security;

drop policy if exists "ver secciones de mi rol" on public.secciones;
create policy "ver secciones de mi rol" on public.secciones for select to authenticated
  using (activa and (public.mi_rol() = 'admin' or public.mi_rol() = any (roles)));

drop policy if exists "admin modifica secciones" on public.secciones;
create policy "admin modifica secciones" on public.secciones for all to authenticated
  using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

-- 4. Permisos de la API (las tablas nuevas no se exponen solas) ---------------
revoke all on public.perfiles, public.secciones from anon;
grant select, insert, update, delete on public.perfiles, public.secciones to authenticated;
revoke execute on function public.mi_rol(), public.clave_cambiada() from public, anon;
grant  execute on function public.mi_rol(), public.clave_cambiada() to authenticated;
