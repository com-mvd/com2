// COM 2 — acceso a las páginas que vinieron del repo com (10/11/2026).
// Necesita supabase-js y assets/comun.js cargados antes.
//
// Uso:  COM2.acceso({ volver: '.header' });                 // pone "‹ COM 2" al principio de ese elemento
//       COM2.acceso({ volver: '.barra-in', absoluto: true }); // en una barra centrada: a la izquierda, sin correr el título
//       COM2.acceso({ roles: ['admin'], panel: 'admin', ... }); // solo admin; "‹ COM 2" vuelve al panel Admin
//
// Si no hay sesión, o el rol no está en roles (por defecto supervisor y admin), o todavía tiene la contraseña
// inicial, manda al login / menú de COM 2. Devuelve el perfil (o null si redirige).
(function () {
  const css = document.createElement('style');
  css.textContent = `
    .com2-volver{display:inline-flex;align-items:center;gap:4px;flex:none;align-self:center;color:inherit;text-decoration:none;
      font:700 13px 'DM Sans',system-ui,sans-serif;padding:5px 10px;border-radius:8px;
      border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);transition:background-color .15s}
    .com2-volver:hover{background:rgba(127,127,127,.18)}
    .com2-volver.abs{position:absolute;left:16px;top:50%;transform:translateY(-50%)}
    @media (max-width:760px){.com2-volver{font-size:12px;padding:4px 8px}.com2-volver span{display:none}
      .com2-con-volver{padding-left:44px!important;padding-right:44px!important}.com2-volver.abs{left:10px}}`;
  document.head.appendChild(css);

  window.COM2.acceso = async function (o = {}) {
    const roles = o.roles || ['admin', 'supervisor'];
    const yo = await window.COM2.perfil().catch(() => null);
    if (!yo || yo.debe_cambiar_clave || !roles.includes(yo.rol)) { location.replace('./'); return null; }
    if (o.volver) {
      const poner = () => {
        const en = document.querySelector(o.volver);
        if (!en || en.querySelector('.com2-volver')) return;
        const a = document.createElement('a');
        a.className = 'com2-volver' + (o.absoluto ? ' abs' : '');
        a.href = './?panel=' + (o.panel || 'supervisor');
        a.title = 'Volver a COM 2';
        a.innerHTML = '‹<span> COM 2</span>';
        if (o.absoluto && getComputedStyle(en).position === 'static') en.style.position = 'relative';
        // En el celular, lugar a los dos lados para que el título siga centrado y no quede debajo del botón
        if (o.absoluto) en.classList.add('com2-con-volver');
        en.prepend(a);
      };
      document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', poner) : poner();
    }
    return yo;
  };
})();
