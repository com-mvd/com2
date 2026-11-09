# COM 2

Sistema nuevo del COM, **todavía a prueba**. Es un portal con login (cédula y contraseña) y menú según el rol.
La idea es ir pasando acá las planillas operativas de Google Sheets y, más adelante, lo del repo `com`, para que todo quede unificado.

- Repo: `com-mvd/com2` (carpeta local `Documents/GitHub/com-2`: Windows no acepta una carpeta llamada `com2`).
- Página: https://com-mvd.github.io/com2/
- Datos y usuarios: Supabase, proyecto `com` (`https://srgduwdvkgqrrmhxpzlx.supabase.co`).

## Cómo funciona

- **Login:** Supabase Auth. El usuario es la cédula; por dentro se guarda como `cédula@com.local`. Nadie puede registrarse solo: los usuarios los crea el administrador.
- **Primer ingreso:** la página obliga a cambiar la contraseña inicial (mínimo 8 caracteres, con letras y números).
- **Roles:** `admin`, `supervisor` y `operador` (tabla `perfiles`).
- **Menú:** la tabla `secciones` dice qué páginas ve cada rol. Para sumar una página al menú se agrega una fila; no hace falta tocar `index.html`.
- **Seguridad:** la clave que está en el código es la *publishable*, que es pública. Los datos los protegen las reglas RLS de la base:
  - sin login no se lee nada;
  - cada rol ve y modifica solo lo que le corresponde.

## Archivos

```
index.html          Login, cambio de contraseña y menú
assets/             Logo
sql/01-base.sql     Roles, perfiles, secciones y reglas (ya corrido en Supabase)
```

## Reglas

- **Nunca subir** listas de usuarios, cédulas, nombres ni contraseñas. Las claves iniciales viven fuera del repo, en `Desktop/IA/portal-com/privado/`.
- **Nunca poner en el código** la clave *secret* de Supabase ni la contraseña de la base.
- Cada tabla nueva se crea con RLS y con `grant` explícitos: el proyecto no expone las tablas solo.
