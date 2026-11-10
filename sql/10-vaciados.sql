-- 10 (10/11/2026): vaciados de bolsones de Barrios Sustentables Cerro y Edificio IM. Primera planilla que pasa a
-- COM 2: antes se cargaban en la planilla "Validación Barrios Sustentables" con un Apps Script y una clave de carga.
--   vaciados_lugares: los puntos de cada tablero (el edificio de cada carga tiene que ser uno de estos)
--   vaciados:         una fila por vaciado (quién y cuándo lo cargó o lo cambió)
--   vaciados_marca:   el "Pasado hasta" de cada tablero (hasta dónde ya se pasó lo del grupo de WhatsApp)
--   vaciados_publico: vista para los tableros sin login de dashboard (solo edificio, fecha y bolsones > 0)
-- Cargar, editar y borrar: solo el admin (las páginas de carga están en el panel Admin).

create table if not exists public.vaciados_lugares (
  tablero   text not null check (tablero in ('cerro', 'im')),
  nombre    text not null,
  direccion text not null default '',
  orden     int  not null default 100,
  primary key (tablero, nombre)
);

create table if not exists public.vaciados (
  id             bigint generated always as identity primary key,
  tablero        text not null,
  edificio       text not null,
  direccion      text not null default '',
  fecha          timestamp not null,            -- fecha y hora del vaciado, hora de Montevideo (sin zona)
  bolsones       int  not null check (bolsones between 0 and 999),
  creado         timestamptz not null default now(),
  creado_por     uuid default auth.uid() references auth.users (id) on delete set null,
  modificado     timestamptz,
  modificado_por uuid references auth.users (id) on delete set null,
  foreign key (tablero, edificio) references public.vaciados_lugares (tablero, nombre) on update cascade
);
create index if not exists vaciados_tablero_fecha on public.vaciados (tablero, fecha desc);

create table if not exists public.vaciados_marca (
  tablero        text primary key check (tablero in ('cerro', 'im')),
  pasado_hasta   date,
  modificado     timestamptz not null default now(),
  modificado_por uuid default auth.uid() references auth.users (id) on delete set null
);

-- Al editar, se anota quién y cuándo
create or replace function public.vaciados_modificado()
returns trigger language plpgsql set search_path = public as $$
begin
  new.modificado := now();
  new.modificado_por := auth.uid();
  new.creado := old.creado; new.creado_por := old.creado_por;   -- esto no se cambia
  return new;
end $$;
drop trigger if exists vaciados_modificado on public.vaciados;
create trigger vaciados_modificado before update on public.vaciados for each row execute function public.vaciados_modificado();

create or replace function public.vaciados_marca_modificado()
returns trigger language plpgsql set search_path = public as $$
begin new.modificado := now(); new.modificado_por := auth.uid(); return new; end $$;
drop trigger if exists vaciados_marca_modificado on public.vaciados_marca;
create trigger vaciados_marca_modificado before insert or update on public.vaciados_marca for each row execute function public.vaciados_marca_modificado();

-- Permisos (RLS en las tres tablas; "expose new tables" está apagado: se habilita a mano con grant)
alter table public.vaciados_lugares enable row level security;
alter table public.vaciados enable row level security;
alter table public.vaciados_marca enable row level security;

drop policy if exists "todos ven los lugares" on public.vaciados_lugares;
create policy "todos ven los lugares" on public.vaciados_lugares for select to anon, authenticated using (true);

drop policy if exists "admin ve vaciados" on public.vaciados;
create policy "admin ve vaciados" on public.vaciados for select to authenticated using (public.mi_rol() = 'admin');
drop policy if exists "admin carga vaciados" on public.vaciados;
create policy "admin carga vaciados" on public.vaciados for insert to authenticated with check (public.mi_rol() = 'admin');
drop policy if exists "admin cambia vaciados" on public.vaciados;
create policy "admin cambia vaciados" on public.vaciados for update to authenticated
  using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');
drop policy if exists "admin borra vaciados" on public.vaciados;
create policy "admin borra vaciados" on public.vaciados for delete to authenticated using (public.mi_rol() = 'admin');

drop policy if exists "admin ve marca" on public.vaciados_marca;
create policy "admin ve marca" on public.vaciados_marca for select to authenticated using (public.mi_rol() = 'admin');
drop policy if exists "admin cambia marca" on public.vaciados_marca;
create policy "admin cambia marca" on public.vaciados_marca for all to authenticated
  using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

grant select on public.vaciados_lugares to anon, authenticated;
grant select, insert, update, delete on public.vaciados to authenticated;
grant select, insert, update on public.vaciados_marca to authenticated;

-- Para los tableros sin login: solo lo que se muestra (no quién cargó). La vista corre con los permisos de su
-- dueño, así que no necesita que anon pueda leer la tabla.
create or replace view public.vaciados_publico as
  select tablero, edificio, fecha, bolsones from public.vaciados where bolsones > 0;
revoke all on public.vaciados_publico from public, anon, authenticated;
grant select on public.vaciados_publico to anon, authenticated;

-- Los puntos (mismos que LUGARES de las páginas)
insert into public.vaciados_lugares (tablero, nombre, direccion, orden) values
  ('cerro', 'Plaza Débora Céspedes', 'EGIPTO esq. SUECIA', 10),
  ('cerro', 'Federación FOICA', 'HOLANDA 1715', 20),
  ('cerro', 'Plaza de Deportes N11', 'PORTUGAL esq. AUSTRIA', 30),
  ('cerro', 'Seccional N24', 'PRUSIA 1895', 40),
  ('cerro', 'Escuela Luisa Casteran', 'CHINA 1898', 50),
  ('cerro', 'Formativas de Rampla', 'TURQUIA 3335', 60),
  ('cerro', 'Club de Pesca', 'GRECIA 3152', 70),
  ('cerro', 'Escuela N29', 'PORTUGAL 3325', 80),
  ('cerro', 'Club Verdirrojo', 'PRUSIA 1621', 90),
  ('im', 'Edificio IM', '', 10)
on conflict (tablero, nombre) do update set direccion = excluded.direccion, orden = excluded.orden;

insert into public.vaciados_marca (tablero) values ('cerro'), ('im') on conflict (tablero) do nothing;

select (select count(*) from public.vaciados_lugares) as lugares, (select count(*) from public.vaciados) as vaciados,
       (select count(*) from public.vaciados_marca) as marcas;
