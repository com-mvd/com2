// COM 2 — acceso a las páginas que vinieron del repo com (10/11/2026).
// Necesita supabase-js y assets/comun.js cargados antes.
//
// Uso:  COM2.acceso();                        // supervisores y admin
//       COM2.acceso({ roles: ['admin'] });    // solo admin
//
// Si no hay sesión, o el rol no está en roles (por defecto supervisor y admin), o todavía tiene la contraseña
// inicial, manda al login / menú de COM 2. Devuelve el perfil (o null si redirige).
// Para volver al menú se usa el "atrás" del navegador (pedido del usuario, 10/11): no hay botón propio.
(function () {
  window.COM2.acceso = async function (o = {}) {
    const roles = o.roles || ['admin', 'supervisor'];
    const yo = await window.COM2.perfil().catch(() => null);
    if (!yo || yo.debe_cambiar_clave || !roles.includes(yo.rol)) { location.replace('./'); return null; }
    return yo;
  };
})();
