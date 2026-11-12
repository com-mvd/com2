// COM 2 — código compartido: conexión a Supabase, sesión, barra superior (paneles y menú del usuario)
// y tema claro / oscuro.
// Necesita supabase-js cargado antes (window.supabase).
(function () {
  const URL = 'https://srgduwdvkgqrrmhxpzlx.supabase.co';
  const KEY = 'sb_publishable_8ZP6-05anDJSBy39IwbSdQ_18iWRnd6';   // clave pública: los datos los protege RLS
  const sb = window.supabase.createClient(URL, KEY);

  const ROL_NOMBRE = { admin: 'Administrador', sup_gral: 'Sup Gral', auxiliar: 'Auxiliar', supervisor: 'Supervisor', operador: 'Operador' };
  const PANEL_NOMBRE = { operador: 'Operador', supervisor: 'Supervisor', auxiliar: 'Auxiliares', sup_gral: 'Sup Gral', admin: 'Admin' };
  // Paneles que ve cada rol (su panel y los de abajo, en escalera). El operador tiene uno solo: no se muestran.
  // Auxiliares y Sup Gral (13/11) van entre Supervisor y Admin (sql/13-auxiliares-sup-gral.sql).
  const ORDEN_PANELES = ['operador', 'supervisor', 'auxiliar', 'sup_gral', 'admin'];
  const PANELES = Object.fromEntries(ORDEN_PANELES.map((r, i) => [r, ORDEN_PANELES.slice(0, i + 1)]));
  // Roles que entran a las páginas de supervisores (supervisor o más arriba)
  const ROLES_SUPERVISION = ['admin', 'sup_gral', 'auxiliar', 'supervisor'];

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

  // ── Tema claro / oscuro (12/11) ──
  // Se elige con el botón de la luna / el sol, a la derecha del usuario, y se recuerda para todas las páginas
  // de COM 2 (localStorage 'com2.tema'). Se pone como data-theme="dark" o "light" en <html>; cada hoja de
  // estilos trae sus colores oscuros bajo :root[data-theme="dark"]. Sin elegir, queda claro como siempre.
  const ICONO_LUNA = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const ICONO_SOL = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4.6"/><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 1.8v1.6M12 20.6v1.6M4.8 4.8l1.1 1.1M18.1 18.1l1.1 1.1M1.8 12h1.6M20.6 12h1.6M4.8 19.2l1.1-1.1M18.1 5.9l1.1-1.1"/></g></svg>';
  const temaGuardado = leer('com2.tema');
  if (temaGuardado === 'dark' || temaGuardado === 'light') document.documentElement.dataset.theme = temaGuardado;
  const tema = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  function ponerTema(t) {
    document.documentElement.dataset.theme = t;
    guardar('com2.tema', t);
    document.querySelectorAll('.tema-btn').forEach(pintarBotonTema);
    // Las páginas con mapas o gráficas pueden escuchar este aviso para redibujarse
    window.dispatchEvent(new CustomEvent('com2:tema', { detail: t }));
  }
  function pintarBotonTema(b) {
    const oscuro = tema() === 'dark';
    b.innerHTML = oscuro ? ICONO_SOL : ICONO_LUNA;
    b.title = oscuro ? 'Pasar a modo claro' : 'Pasar a modo oscuro';
    b.setAttribute('aria-label', b.title);
  }

  // Estilos del usuario y del botón de tema: van acá para que sean iguales en todas las páginas,
  // tengan o no comun.css
  function estilosBarra() {
    if (document.getElementById('com2-barra-estilos')) return;
    const s = document.createElement('style');
    s.id = 'com2-barra-estilos';
    s.textContent = `
.com2-der{display:flex;align-items:center;gap:6px;flex:none}
.barra .com2-der.fija{position:absolute;right:clamp(12px,2vw,24px);top:50%;transform:translateY(-50%);z-index:2}
.barra .tema-btn.fija{position:absolute;left:clamp(12px,2vw,24px);top:50%;transform:translateY(-50%);z-index:2}
.com2-der .usuario{position:relative;margin:0}
.com2-der .usuario-btn{display:flex;align-items:center;gap:7px;height:30px;border:0;background:transparent;color:#fff;cursor:pointer;padding:0 8px 0 3px;border-radius:8px;max-width:240px;font:inherit}
.com2-der .usuario-btn:hover{background:rgba(255,255,255,.08)}
.com2-der .avatar{width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;flex:none}
.com2-der .avatar svg{width:14px;height:14px}
.com2-der .nombre{font-family:'DM Sans',system-ui,sans-serif;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.com2-der .flecha{opacity:.7;font-size:11px}
.com2-der .menu-usuario{position:absolute;right:0;top:calc(100% + 8px);min-width:200px;background:#fff;color:#1A1714;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.25);padding:6px;border:1px solid #E6E2DA;z-index:5000;text-align:left}
.com2-der .menu-usuario button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:10px 12px;border-radius:8px;font-family:'DM Sans',system-ui,sans-serif;font-size:14.5px;font-weight:600;color:inherit;cursor:pointer}
.com2-der .menu-usuario button:hover{background:#F2F4F9}
.com2-der .menu-usuario button.salir{color:#c0392b}
.barra .tema-btn{width:30px;height:30px;flex:none;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#fff;border-radius:8px;cursor:pointer;padding:0}
.barra .tema-btn:hover{background:rgba(255,255,255,.16)}
.barra .tema-btn svg{width:16px;height:16px}
[data-theme="dark"] .com2-der .menu-usuario{background:#2b2f36;color:#ECEAE6;border-color:#3e434b}
[data-theme="dark"] .com2-der .menu-usuario button:hover{background:#383d45}
[data-theme="dark"] .com2-der .menu-usuario button.salir{color:#ff8b7e}
@media (max-width:720px){.com2-der .nombre,.com2-der .flecha{display:none}.com2-der .usuario-btn{padding:0 3px}}
/* En pantallas angostas el título deja lugar a los dos lados, así sigue centrado y no se pisa con el usuario */
@media (max-width:720px){.barra:has(> .com2-der.fija) > .barra-in{padding-left:84px;padding-right:84px}}`;
    document.head.appendChild(s);
  }

  const htmlDerecha = p => `<div class="com2-der">
      <div class="usuario">
        <button type="button" class="usuario-btn" aria-haspopup="menu" aria-expanded="false">
          <span class="avatar">${ICONO_PERSONA}</span><span class="nombre">${esc(p.nombre)}</span><span class="flecha">▾</span>
        </button>
        <div class="menu-usuario" role="menu" hidden>
          <button type="button" role="menuitem" class="m-clave">Cambiar contraseña</button>
          <button type="button" role="menuitem" class="salir">Cerrar sesión</button>
        </div>
      </div>
    </div>`;
  // El botón de tema va a la izquierda de la barra (pedido del usuario, 13/11)
  const HTML_TEMA = '<button type="button" class="tema-btn"></button>';
  function conectarTema(tb) {
    pintarBotonTema(tb);
    tb.onclick = () => ponerTema(tema() === 'dark' ? 'light' : 'dark');
  }

  function conectarDerecha(caja, o = {}) {
    const btn = caja.querySelector('.usuario-btn'), menu = caja.querySelector('.menu-usuario');
    const abrir = si => { menu.hidden = !si; btn.setAttribute('aria-expanded', si); };
    btn.onclick = ev => { ev.stopPropagation(); abrir(menu.hidden); };
    document.addEventListener('click', ev => { if (!menu.hidden && !menu.contains(ev.target)) abrir(false); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') abrir(false); });
    caja.querySelector('.m-clave').onclick = () => { abrir(false); o.alCambiarClave ? o.alCambiarClave() : (location.href = './?clave=1'); };
    caja.querySelector('.salir').onclick = async () => { await sb.auth.signOut(); location.href = './'; };
  }

  // Usuario arriba a la derecha y botón de tema a la izquierda de la barra azul de cualquier página de COM 2
  // (la llama COM2.acceso; las páginas que no la usan la llaman con su perfil)
  function usuarioEnBarra(p) {
    if (!p) return;
    const poner = () => {
      const barraAzul = document.querySelector('header.barra, #barra');
      if (!barraAzul || barraAzul.querySelector('.com2-der')) return;
      estilosBarra();
      barraAzul.insertAdjacentHTML('beforeend', htmlDerecha(p));
      const caja = barraAzul.lastElementChild;
      caja.classList.add('fija');
      conectarDerecha(caja);
      barraAzul.insertAdjacentHTML('beforeend', HTML_TEMA);
      const tb = barraAzul.lastElementChild;
      tb.classList.add('fija');
      conectarTema(tb);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner, { once: true });
    else poner();
  }

  const ICONO_PERSONA ='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';

  // Dibuja la barra en <header id="barra">.
  // opciones: perfil, panel (el activo), paneles (false para ocultarlos), alCambiarPanel(p), alCambiarClave()
  function barra(o) {
    const el = document.getElementById('barra');
    const lista = o.paneles === false ? [] : PANELES[o.perfil.rol];
    el.className = 'barra';
    el.innerHTML = `<div class="barra-in">
      ${HTML_TEMA}
      <a class="marca" href="./">COM 2</a>
      ${lista.length > 1 ? `<nav class="paneles" aria-label="Paneles">${lista.map(p =>
        `<button type="button" class="panel-btn${p === o.panel ? ' on' : ''}" data-panel="${p}">${PANEL_NOMBRE[p]}</button>`).join('')}</nav>` : ''}
      ${htmlDerecha(o.perfil)}
    </div>`;
    el.hidden = false;
    estilosBarra();

    el.querySelectorAll('.panel-btn').forEach(b => b.onclick = () => {
      const p = b.dataset.panel;
      guardar('com2.panel', p);
      if (o.alCambiarPanel) {
        el.querySelectorAll('.panel-btn').forEach(x => x.classList.toggle('on', x === b));
        o.alCambiarPanel(p);
      } else location.href = './?panel=' + p;
    });

    // En el menú (index) y Usuarios va dentro de la barra, a la derecha de los paneles
    const caja = el.querySelector('.com2-der');
    caja.style.marginLeft = 'auto';
    conectarDerecha(caja, o);
    conectarTema(el.querySelector('.tema-btn'));
  }

  window.COM2 = { URL, KEY, sb, ROL_NOMBRE, PANEL_NOMBRE, PANELES, ROLES_SUPERVISION, esc, perfil, panelInicial, barra, guardar, leer, icono,
    usuarioEnBarra, tema, ponerTema };
})();
