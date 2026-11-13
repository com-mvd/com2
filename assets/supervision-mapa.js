// Fondo CARTO Light de los mapas de supervision. La clave ya se entrega al navegador.
//
// Modo oscuro (13/11, pedido del usuario): sobre el mapa y las tarjetas oscuras, los colores de siempre se veían
// apagados y parecidos entre sí. En oscuro cada color se cambia por uno más fuerte y saturado, de la misma familia
// (el municipio B sigue amarillo, el C verde claro, etc.), para que resalten y se distingan.
//   color(c): el color a usar (en claro, el mismo).
//   borde(c): el contorno de un punto. En oscuro el contorno blanco pasa a ser oscuro: así el color del punto
//             se ve entero y no se mezcla con el blanco.
//   tema(obj): envuelve un objeto o lista de colores (COLOR_MUNI, coloresTransp, ...) para que, al leerlo,
//              devuelva color(...) según el tema del momento. Así las etiquetas de municipio, los botones de
//              las referencias y los puntos cambian juntos, sin tocar cada lugar donde se usan.
(function () {
  const OSCURO = {
    // transportistas (mismo orden que coloresTransp / COLOR_TRANSP)
    '#6250d6': '#9d7dff', '#0e7490': '#1fd1f0', '#be185d': '#ff4fa3', '#4d7c0f': '#9be22d', '#a16207': '#ffcc33',
    '#1e293b': '#d9a066', '#b91c1c': '#ff5252', '#0284c7': '#3d9bff', '#a21caf': '#e44dff', '#65a30d': '#2ee88f',
    // estados
    '#eb6834': '#ff8a3d', '#d03b3b': '#ff5252', '#2a78d6': '#3d9bff', '#1baf7a': '#2ee88f', '#827b71': '#b8b1a7',
    // municipios (colores de la hoja Indicadores, más fuertes) y el gris de "sin municipio"
    '#c2a289': '#dca56a', '#ffe599': '#ffd43b', '#b6d7a8': '#b5f05a', '#6d9eeb': '#5aa0ff', '#f9cb9c': '#ff8c42',
    '#93c47d': '#2fbf5a', '#b4a7d6': '#a98bff', '#a64d79': '#ff5fae', '#b5afa6': '#cfc9c0'
  };
  const oscuro = () => document.documentElement.dataset.theme === 'dark';
  const color = c => (oscuro() && typeof c === 'string' && OSCURO[c.toLowerCase()]) || c;
  const borde = c => oscuro() && /^#fff(fff)?$/i.test(String(c)) ? '#15181c' : color(c);
  const tema = obj => new Proxy(obj, { get: (o, k) => typeof o[k] === 'string' ? color(o[k]) : o[k] });
  window.SupervisionMapa = {
    teselas: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_4dpf_1_b2ca9299be611862d5d23c88',
    color, borde, tema
  };
})();
