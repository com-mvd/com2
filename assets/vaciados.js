// COM 2 — cargas de vaciados de bolsones (Barrios Sustentables Cerro y Edificio IM), desde el 10/11/2026 en la tabla
// vaciados de Supabase (sql/10-vaciados.sql). Antes iban a la planilla "Validación Barrios Sustentables" por un
// Apps Script, con clave de carga. Solo el admin puede leer y cargar (lo controla RLS).
// Necesita supabase-js y assets/comun.js cargados antes.
//
// Uso:  const r = await Vaciados.pedir('cerro', { accion: 'listar' });
//   acciones (las mismas que tenía el Apps Script, para que las páginas no cambien):
//     listar
//     agregar  { fila: { edif, dir, fGes: 'AAAA-MM-DDTHH:MM', cant } }
//     editar   { n, antes: { edif, fGes, cant }, fila }
//     borrar   { n, antes: { edif, fGes, cant } }
//     marca    { valor: 'AAAA-MM-DD' o '' }   ("Pasado hasta")
//   Siempre devuelve { ok: true, filas: [{ n, edif, dir, fGes, cant }], marca } (n = id de la carga), o tira un error.
//   "antes" se compara con lo que hay: si otro cambió esa carga mientras tanto, no se toca.
(function () {
  const sb = window.COM2.sb;
  const aFila = v => ({ n: v.id, edif: v.edificio, dir: v.direccion, fGes: String(v.fecha).slice(0, 16), cant: v.bolsones });
  const mensaje = e => e.code === '42501' ? 'Solo el administrador puede cargar' : (e.message || 'Error');

  async function listar(tablero) {
    const [a, b] = await Promise.all([
      sb.from('vaciados').select('id,edificio,direccion,fecha,bolsones').eq('tablero', tablero).order('fecha', { ascending: false }),
      sb.from('vaciados_marca').select('pasado_hasta').eq('tablero', tablero).maybeSingle(),
    ]);
    if (a.error) throw new Error(mensaje(a.error));
    if (b.error) throw new Error(mensaje(b.error));
    return { ok: true, filas: a.data.map(aFila), marca: (b.data && b.data.pasado_hasta) || '' };
  }

  const datos = (tablero, f) => ({ tablero, edificio: f.edif, direccion: f.dir || '', fecha: f.fGes, bolsones: f.cant });
  const igual = (q, antes) => q.eq('edificio', antes.edif).eq('fecha', antes.fGes).eq('bolsones', antes.cant);

  async function pedir(tablero, d) {
    let r = null;
    if (d.accion === 'agregar') r = await sb.from('vaciados').insert(datos(tablero, d.fila));
    else if (d.accion === 'editar') r = await igual(sb.from('vaciados').update(datos(tablero, d.fila)).eq('id', d.n), d.antes).select('id');
    else if (d.accion === 'borrar') r = await igual(sb.from('vaciados').delete().eq('id', d.n), d.antes).select('id');
    else if (d.accion === 'marca') r = await sb.from('vaciados_marca').update({ pasado_hasta: d.valor || null }).eq('tablero', tablero).select('tablero');
    else if (d.accion !== 'listar') throw new Error('Acción desconocida');
    if (r && r.error) throw new Error(mensaje(r.error));
    if (r && d.accion !== 'agregar' && !(r.data && r.data.length)) {
      throw new Error(d.accion === 'marca' ? 'No se pudo guardar la fecha' : 'Esa carga cambió mientras tanto: recargá la página y probá de nuevo');
    }
    return listar(tablero);
  }

  window.Vaciados = { pedir };
})();
