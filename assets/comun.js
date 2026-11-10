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

  // Íconos de las tarjetas del menú (columna icono de la tabla secciones). Mismo trazo que el index de Dashboard.
  const ICONOS = {
    usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    planilla: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    documento: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h3"/><path d="M9 12h6M9 16h4"/>',
    tareas: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h3"/><path d="m9 11 1.2 1.2 2.3-2.3"/><path d="M14 11h2"/><path d="m9 16 1.2 1.2 2.3-2.3"/><path d="M14 16h2"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    camion: '<rect x="1" y="7" width="14" height="10" rx="1"/><path d="M15 10h4l3 3v4h-7z"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
    mapa: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    bolsa: '<path d="m12 17-2 2 2 2"/><path d="M10 19h9a2 2 0 0 0 1.75-2.75l-.55-1"/><path d="m8.54 11-.74-2.73-2.73.73"/><path d="m7.8 8.27-4.8 8.4A2 2 0 0 0 4.7 19.5H10"/><path d="m15.46 11 2.74.73.73-2.73"/><path d="m18.2 11.73-4.8-8.4a2 2 0 0 0-3.5 0L7.2 8.03"/>',
    grafico: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'
  };
  const icono = nombre => `<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${ICONOS[nombre] || ICONOS.planilla}</svg>`;

  const ICONO_PERSONA ='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';

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

  window.COM2 = { URL, KEY, sb, ROL_NOMBRE, PANEL_NOMBRE, PANELES, esc, perfil, panelInicial, barra, guardar, leer, icono };
})();
