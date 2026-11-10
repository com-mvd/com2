// COM 2 — código compartido: conexión a Supabase, sesión y barra superior (paneles y menú del usuario).
// Necesita supabase-js cargado antes (window.supabase).
(function () {
  const URL = 'https://srgduwdvkgqrrmhxpzlx.supabase.co';
  const KEY = 'sb_publishable_8ZP6-05anDJSBy39IwbSdQ_18iWRnd6';   // clave pública: los datos los protege RLS
  const sb = window.supabase.createClient(URL, KEY);

  const ROL_NOMBRE = { admin: 'Administrador', supervisor: 'Supervisor', operador: 'Operador' };
  const PANEL_NOMBRE = { operador: 'Operador', supervisor: 'Supervisor', admin: 'Admin' };
  // Paneles que ve cada rol (su panel y los de abajo). El operador tiene uno solo: no se muestran.
  const PANELES = { admin: ['operador', 'supervisor', 'admin'], supervisor: ['operador', 'supervisor'], operador: ['operador'] };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const leer = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  // Perfil del usuario con sesión, o null si no hay sesión. Si está de baja, cierra la sesión y avisa.
  async function perfil() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.from('perfiles').select('id,usuario,nombre,rol,activo,debe_cambiar_clave').eq('id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!data || !data.activo) {
      await sb.auth.signOut();
      const e = new Error(!data ? 'Tu usuario no tiene perfil. Avisale al administrador.' : 'Tu usuario está dado de baja.');
      e.sinAcceso = true;
      throw e;
    }
    return data;
  }

  // Panel elegido: el de la dirección (?panel=), el último usado o el del propio rol.
  function panelInicial(p) {
    const permitidos = PANELES[p.rol];
    const deUrl = new URLSearchParams(location.search).get('panel');
    if (permitidos.includes(deUrl)) return deUrl;
    const ultimo = leer('com2.panel');
    return permitidos.includes(ultimo) ? ultimo : p.rol;
  }

  const ICONO_PERSONA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';

  // Dibuja la barra en <header id="barra">.
  // opciones: perfil, panel (el activo), paneles (false para ocultarlos), alCambiarPanel(p), alCambiarClave()
  function barra(o) {
    const el = document.getElementById('barra');
    const lista = o.paneles === false ? [] : PANELES[o.perfil.rol];
    el.className = 'barra';
    el.innerHTML = `<div class="barra-in">
      <a class="marca" href="./">COM 2</a>
      ${lista.length > 1 ? `<nav class="paneles" aria-label="Paneles">${lista.map(p =>
        `<button type="button" class="panel-btn${p === o.panel ? ' on' : ''}" data-panel="${p}">${PANEL_NOMBRE[p]}</button>`).join('')}</nav>` : ''}
      <div class="usuario">
        <button type="button" class="usuario-btn" id="usuarioBtn" aria-haspopup="menu" aria-expanded="false">
          <span class="avatar">${ICONO_PERSONA}</span><span class="nombre">${esc(o.perfil.nombre)}</span><span class="flecha">▾</span>
        </button>
        <div class="menu-usuario" id="menuUsuario" role="menu" hidden>
          <button type="button" role="menuitem" id="mCambiarClave">Cambiar contraseña</button>
          <button type="button" role="menuitem" class="salir" id="mSalir">Cerrar sesión</button>
        </div>
      </div>
    </div>`;
    el.hidden = false;

    el.querySelectorAll('.panel-btn').forEach(b => b.onclick = () => {
      const p = b.dataset.panel;
      guardar('com2.panel', p);
      if (o.alCambiarPanel) {
        el.querySelectorAll('.panel-btn').forEach(x => x.classList.toggle('on', x === b));
        o.alCambiarPanel(p);
      } else location.href = './?panel=' + p;
    });

    const btn = document.getElementById('usuarioBtn'), menu = document.getElementById('menuUsuario');
    const abrir = si => { menu.hidden = !si; btn.setAttribute('aria-expanded', si); };
    btn.onclick = ev => { ev.stopPropagation(); abrir(menu.hidden); };
    document.addEventListener('click', ev => { if (!menu.hidden && !menu.contains(ev.target)) abrir(false); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') abrir(false); });
    document.getElementById('mCambiarClave').onclick = () => { abrir(false); o.alCambiarClave ? o.alCambiarClave() : (location.href = './?clave=1'); };
    document.getElementById('mSalir').onclick = async () => { await sb.auth.signOut(); location.href = './'; };
  }

  window.COM2 = { URL, KEY, sb, ROL_NOMBRE, PANEL_NOMBRE, PANELES, esc, perfil, panelInicial, barra, guardar, leer };
})();
