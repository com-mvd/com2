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
index.html                  Login, cambio de contraseña y menú
usuarios.html               Usuarios (solo admin): alta, nombre y rol, corregir cédula, restablecer contraseña, baja
assets/                     Logo
sql/01-base.sql             Roles, perfiles, secciones y reglas (ya corrido en Supabase)
sql/02-usuarios-admin.sql   Funciones de admin para usuarios y la sección del menú (ya corrido en Supabase)
```

## Usuarios (pantalla del admin)

- Lo que toca el login (`auth.users`) lo hacen funciones de la base: `admin_crear_usuario`, `admin_restablecer_clave`, `admin_cambiar_cedula` y `admin_activar`. Cada una verifica primero que quien llama sea admin; si no, responde "Solo el administrador puede hacer esto".
- Nombre y rol se editan con un `update` común, que solo el admin puede hacer por RLS.
- Un trigger impide:
  - cambiar la cédula sin pasar por `admin_cambiar_cedula`;
  - que el admin se quite su propio rol o se dé de baja.
- **Alta y restablecer** devuelven una contraseña temporal de 10 caracteres, que se muestra **una sola vez**. Al entrar, obliga a cambiarla.
- **Baja:** marca el perfil como inactivo y además bloquea el login (`banned_until`). No se borra nada; se puede reactivar.
- La pantalla revisa el dígito verificador de la cédula y marca con "⚠ revisar" las cédulas cargadas que no lo cumplen.

## Reglas

- **Nunca subir** listas de usuarios, cédulas, nombres ni contraseñas. Las claves iniciales viven fuera del repo, en `Desktop/IA/portal-com/privado/`.
- **Nunca poner en el código** la clave *secret* de Supabase ni la contraseña de la base.
- Cada tabla nueva se crea con RLS y con `grant` explícitos: el proyecto no expone las tablas solo.
