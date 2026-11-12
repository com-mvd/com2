(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const normalizar = valor => String(valor ?? '').trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const fechaISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const hoy = fechaISO.format(new Date());
  const ayer = new Date(Date.parse(hoy + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  const fechaCorta = fecha => fecha ? fecha.slice(8, 10) + '/' + fecha.slice(5, 7) + '/' + fecha.slice(0, 4) : '—';
  const fechaHora = valor => valor ? fechaCorta(valor) + (valor.length > 10 ? ' ' + valor.slice(11, 16) : '') : '—';
  const numero = new Intl.NumberFormat('es-UY');
  const botones = [...document.querySelectorAll('[data-vista]')];
  const porPagina = 50;
  const cuposURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSxetTmM9tQiSTmmkluA5iiVpQh76jn8wrActYozj3hJEDjvAK_1_4XRuipxUrsjoAv2nnb_2wU6MFx/pub?gid=26135142&single=true&output=csv';
  const horarios = [
    ['Lunes', ['CH']], ['Martes', ['A', 'D']], ['Miércoles', ['E']], ['Jueves', ['G', 'F']],
    ['Viernes', ['B']], ['Sábado', ['C']]
  ];
  const coloresMuni = { A: '#C2A289', B: '#FFE599', C: '#B6D7A8', CH: '#6D9EEB', D: '#F9CB9C', E: '#93C47D', F: '#B4A7D6', G: '#A64D79' };
  const estados = {
    pendiente: ['Pendiente', '#eb6834', '#FCE9DF', '#9e3d16'],
    asignado: ['Asignada', '#2a78d6', '#E1ECFA', '#215ba0'],
    realizado: ['Realizada', '#1baf7a', '#DDF3EA', '#0f7a55'],
    cancelado: ['Cancelada', '#d03b3b', '#F9E1E0', '#a22828'],
    cerrado: ['Cerrada sin realizar', '#827b71', '#F0EDE7', '#5F5A54']
  };
  // Mismos colores de transportista que Supervisión de Bolsones (ninguno parecido al naranja de los pendientes)
  const coloresTransp = ['#6250d6', '#0e7490', '#be185d', '#4d7c0f', '#a16207', '#1e293b', '#b91c1c', '#0284c7', '#a21caf', '#65a30d'];
  const plurales = { pendiente: 'Pendientes', asignado: 'Asignadas', realizado: 'Realizadas', cancelado: 'Canceladas', cerrado: 'Cerradas sin realizar' };
  // El transportista sin el número del final, como en Bolsones ("Zulma Soca-22" → "Zulma Soca")
  const nomTransp = t => String(t || '').replace(/-\d+$/, '').trim();
  const AZUL = '#1b3f74'; // el azul de la barra del título
  // Modo oscuro (12/11): las gráficas y el punto elegido toman los colores del tema al dibujarse
  const oscuro = () => document.documentElement.dataset.theme === 'dark';
  const azulBarras = () => oscuro() ? '#5b84c4' : AZUL;
  const tinta = () => oscuro() ? '#ECEAE6' : '#1A1714';
  const tinta2 = () => oscuro() ? '#B3ADA5' : '#5F5A54';
  const ordenEstados = ['realizado', 'asignado', 'pendiente', 'cancelado', 'cerrado'];
  // Operación del día, modo Transportistas: referencia de círculos que también filtra, como en Bolsones (12/11)
  const verTipo = { realizado: true, asignado: true };
  // Operación del día: franjas horarias del servicio, de 2:30 h y encimadas media hora (12/11).
  // Cada agenda va en la franja que empieza a su hora agendada (o la última que empezó antes:
  // 09:55 va en la de las 09:00; antes de las 07:00, en la primera)
  const FRANJAS = [['07:00', '09:30'], ['09:00', '11:30'], ['11:00', '13:30'], ['13:00', '15:30'], ['15:00', '17:30'], ['17:00', '19:30']];
  const verFranja = FRANJAS.map(() => true);
  let porFranja = FRANJAS.map(() => 0);
  function franjaDe(fila) {
    const hora = fila.fecha_de_agenda.slice(11, 16);
    if (!hora) return -1;
    let i = 0;
    FRANJAS.forEach(([desde], j) => { if (hora >= desde) i = j; });
    return i;
  }
  const SIN_T = 'Pendientes'; // modo Transportistas: los que no tienen transportista (ningún transportista se llama así)
  const vistasMapa = ['operacion', 'pendientes', 'realizados'];
  const sinSalida = /^(agenda - (cancelado|no confirmo fecha)|repetido|en proceso|derivado)(-|$)|salir adelante|^limpio(?:-|$)/;
  const fechas = { operacion: hoy, realizados: ayer };
  const etiquetasFecha = { operacion: 'Fecha de operación', realizados: 'Fecha de resolución' };
  const nombres = {
    operacion: 'Gestiones del día',
    realizados: 'Agendas realizadas', buscador: 'Resultados de búsqueda'
  };
  let registros = [];
  let resultados = [];
  let vista = 'operacion';
  let modo = 'estado';
  let grupoMapa = '';
  // Pendientes: recuadro elegido en la tabla de cupos ({ municipio, fecha }) o solo el municipio ({ municipio }).
  let celda = null;
  // Días de cada municipio que muestra la tabla de cupos ("AAAA-MM-DD|municipio"); null si no se pudieron leer los cupos.
  let enTabla = null;
  let pagina = 0;
  let mapa, puntos, teselas;
  let marcadores = [];
  // Buscador: la dirección elegida en la lista (como en Bolsones, hasta elegir una no hay tabla)
  let busDir = null;
  let busOpc = [];
  const BUS_MAX = 12;
  const graficas = new Map();

  function estadoAgenda(fila) {
    const transportista = normalizar(fila.transportista);
    if (normalizar(fila.tipo_de_reclamo) === 'cancelado' || transportista.startsWith('agenda - cancelado')) return 'cancelado';
    const estado = normalizar(fila.estado);
    if (!fila.fecha_resuelto && estado === 'asignado') return 'asignado';
    if (!fila.fecha_resuelto && estado === 'nuevo') return 'pendiente';
    if (fila.fecha_resuelto && normalizar(fila.hecho) === 'true' && transportista && transportista !== '-' && !sinSalida.test(transportista)) return 'realizado';
    return 'cerrado';
  }

  function coordenadas(latitud, longitud) {
    if (latitud === '' || longitud === '') return null;
    const lat = Number(latitud.replace(',', '.'));
    const lng = Number(longitud.replace(',', '.'));
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && lat !== 0 && lng !== 0
      ? [lat, lng] : null;
  }

  async function leerJSON(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes[0] === 31 && bytes[1] === 139) {
      return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function bajarBase() {
    const respuesta = await fetch(COM2.URL + '/storage/v1/object/public/bases/agenda.json.gz', { cache: 'no-store' });
    if (!respuesta.ok) throw new Error('No se pudo descargar la base de Agenda (HTTP ' + respuesta.status + ').');
    return leerJSON(respuesta);
  }

  async function bajarPrivado() {
    try {
      const { data, error } = await COM2.sb.storage.from('privado').download('agenda.json.gz');
      if (error) return null;
      return await leerJSON(data);
    } catch {
      return null;
    }
  }

  function preparar(base, privado) {
    const columnas = base.columnas.map(normalizar);
    const diccionario = Object.fromEntries(Object.entries(base.dicc || {}).map(([campo, valores]) => [normalizar(campo), valores]));
    const columnasFecha = new Set((base.fechas || []).map(normalizar));
    const columnasPrivadas = (base.privadas || []).map(normalizar);
    const requeridas = ['id_agenda', 'direccion', 'municipio', 'fecha_de_reclamo', 'fecha_de_agenda', 'fecha_resuelto', 'estado', 'hecho', 'latitud', 'longitud'];
    const faltantes = requeridas.filter(campo => !columnas.includes(campo));
    if (faltantes.length) throw new Error('Faltan columnas en la base de Agenda: ' + faltantes.join(', ') + '.');

    const lectores = columnas.map(campo => {
      if (diccionario[campo]) return valor => String(diccionario[campo][valor] ?? '');
      // El formato 2 guarda las fechas como segundos del reloj de Montevideo, sin zona.
      if (columnasFecha.has(campo)) return valor => {
        const fecha = new Date(Number(valor) * 1000);
        return Number.isFinite(fecha.getTime()) ? fecha.toISOString().slice(0, 19) : '';
      };
      return valor => String(valor);
    });
    return base.registros.map(datos => {
      const fila = Object.fromEntries(columnas.map((campo, indice) => [campo, datos[indice] == null ? '' : lectores[indice](datos[indice]).trim()]));
      const textos = privado?.[fila.id_agenda];
      if (Array.isArray(textos)) {
        columnasPrivadas.forEach((campo, indice) => { fila[campo] = String(textos[indice] ?? fila[campo] ?? ''); });
      }
      fila.situacion = estadoAgenda(fila);
      fila.abierta = fila.situacion === 'pendiente' || fila.situacion === 'asignado';
      fila.coordenadas = coordenadas(fila.latitud, fila.longitud);
      fila.direccionNormal = normalizar(fila.direccion).replace(/[^a-z0-9]+/g, ' ').trim();
      return fila;
    });

  }

  function parseCSVFilas(text){
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let campo = "", fila = [], enComillas = false;
    for (let i = 0; i < text.length; i++){
      const c = text[i];
      if (enComillas){
        if (c === '"'){
          if (text[i+1] === '"'){ campo += '"'; i++; }
          else enComillas = false;
        } else campo += c;
        continue;
      }
      if (c === '"'){ enComillas = true; continue; }
      if (c === ','){ fila.push(campo); campo = ""; continue; }
      if (c === '\r'){ continue; }
      if (c === '\n'){ fila.push(campo); rows.push(fila); fila = []; campo = ""; continue; }
      campo += c;
    }
    if (campo !== "" || fila.length){ fila.push(campo); rows.push(fila); }
    return rows;
  }

  function fechaCupo(s){
    s = (s || "").trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return m[1]+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0");
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) return m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
    return null;
  }

  function leerCupos(csv) {
    const filas = parseCSVFilas(csv);
    const encabezado = filas.slice(0, 30).findIndex(fila => {
      const campos = fila.map(normalizar);
      return campos.some(c => ['fecha', 'dia'].includes(c))
        && campos.some(c => ['municipio', 'municipios'].includes(c)) && campos.includes('cupomaximo');
    });
    if (encabezado < 0) throw new Error('La planilla no tiene las columnas de cupos.');
    const columnas = filas[encabezado].map(normalizar);
    const colFecha = columnas.findIndex(c => ['fecha', 'dia'].includes(c));
    const colMuni = columnas.findIndex(c => ['municipio', 'municipios'].includes(c));
    const colCupo = columnas.indexOf('cupomaximo');
    const porMunicipio = new Map();
    for (const fila of filas.slice(encabezado + 1)) {
      const fecha = fechaCupo(fila[colFecha]);
      const municipio = (fila[colMuni] || '').trim();
      if (!fecha || fecha < hoy || !Object.hasOwn(coloresMuni, municipio)) continue;
      if (!porMunicipio.has(municipio)) porMunicipio.set(municipio, new Map());
      const jornadas = porMunicipio.get(municipio);
      jornadas.set(fecha, (jornadas.get(fecha) || 0) + (parseInt(fila[colCupo], 10) || 0));
    }
    return porMunicipio;
  }

  // Ocupa un cupo: agendada para hoy o después, ni cancelada ni cerrada sin realizar (estas incluyen
  // "Agenda - No confirmó fecha-094" y "Repetido"; pedido del usuario, 12/11).
  // Lo usan la tabla de cupos y el filtro del mapa de Pendientes, así el mapa muestra lo mismo que cuenta la celda.
  function ocupaCupo(fila) {
    const fecha = fila.fecha_de_agenda.slice(0, 10);
    return Boolean(fecha) && fecha >= hoy && fila.transportista !== 'Agenda - Cancelado-9999' && fila.tipo_de_reclamo !== 'CANCELADO'
      && fila.situacion !== 'cancelado' && fila.situacion !== 'cerrado';
  }

  function mostrarSituacion(porMunicipio) {
    const ocupacion = new Map();
    for (const fila of registros) {
      if (!ocupaCupo(fila)) continue;
      const clave = fila.fecha_de_agenda.slice(0, 10) + '|' + fila.municipio;
      ocupacion.set(clave, (ocupacion.get(clave) || 0) + 1);
    }
    enTabla = new Set();
    $('situacion-filas').innerHTML = horarios.flatMap(([dia, municipios]) => municipios.map(municipio => {
      const jornadas = [...(porMunicipio.get(municipio) || [])].sort(([a], [b]) => a.localeCompare(b));
      const celdas = Array.from({ length: 5 }, (_, i) => {
        if (!jornadas[i]) return '<td><div class="situacion-celda vacia">—</div></td>';
        const [fecha, cupo] = jornadas[i];
        enTabla.add(fecha + '|' + municipio);
        const ocupados = ocupacion.get(fecha + '|' + municipio) || 0;
        const porcentaje = cupo ? Math.round(ocupados / cupo * 100) : 0;
        const nivel = [25, 45, 70].filter(umbral => porcentaje > umbral).length;
        return `<td><button type="button" class="situacion-celda lv${nivel}" data-municipio="${municipio}" data-fecha="${fecha}"
          aria-pressed="false" aria-label="Ver en el mapa las agendas del Municipio ${municipio} del ${fechaCorta(fecha)}">
          <time class="situacion-fecha" datetime="${fecha}">${fechaCorta(fecha)}</time>
          <span class="situacion-datos"><b>${porcentaje}%</b>${numero.format(ocupados)} / ${numero.format(cupo)} cupos</span>
          <span class="situacion-barra" aria-hidden="true"><i style="width:${Math.min(100, porcentaje)}%"></i></span>
        </button></td>`;
      }).join('');
      // El municipio también es un botón: muestra todas sus agendas. La raya es el color de sus puntos en el mapa.
      return `<tr><th scope="row"><button type="button" class="situacion-muni" data-municipio="${municipio}" aria-pressed="false"
        style="--c:${coloresMuni[municipio]}" aria-label="Ver en el mapa las agendas del Municipio ${municipio}">
        <b>${municipio}</b><span>${dia}</span></button></th>${celdas}</tr>`;
    })).join('');
    $('situacion-scroll').hidden = false;
    $('situacion-estado').hidden = porMunicipio.size > 0;
    $('situacion-estado').textContent = 'No hay cupos publicados para hoy en adelante.';
  }

  async function bajarCupos() {
    try {
      const respuesta = await fetch(cuposURL + '&_=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!respuesta.ok) throw new Error('No se pudo leer la planilla de cupos.');
      return leerCupos(await respuesta.text());
    } catch {
      return null;
    }
  }

  function mostrarOrganizacion() {
    const dia = (new Date(hoy + 'T12:00:00Z').getUTCDay() + 6) % 7;
    $('organizacion').innerHTML = horarios.map(([nombre, municipios], indice) =>
      `<article class="dia${dia === indice ? ' hoy' : ''}">
        <h2 class="dia-n">${nombre}${dia === indice ? '<span class="dia-hoy">Hoy</span>' : ''}</h2>
        <div class="dia-sec">Municipios</div>
        <div class="agenda-municipios">${municipios.map(m => chipMuni(m)).join('')}</div>
      </article>`).join('');
  }

  // corto: solo la letra, como en la tabla de Bolsones
  function chipMuni(municipio, corto) {
    return municipio ? `<span class="mb" style="border-left-color:${coloresMuni[municipio] || 'var(--gris)'}">${corto ? '' : 'Municipio '}${COM2.esc(municipio)}</span>` : '';
  }

  function filtrar() {
    // En Pendientes el municipio sale de la tabla de cupos, no del selector (que queda escondido)
    // (Informe realizados tampoco tiene selector de municipio, igual que en Bolsones)
    // (Operación del día tampoco, desde el 12/11: lleva lo mismo que el Informe)
    const municipio = vista === 'pendientes' || vista === 'realizados' || vista === 'operacion' ? '' : $('municipio').value;
    const fecha = fechas[vista];
    if (vista === 'buscador' && !busDir) return [];
    const filas = registros.filter(fila => {
      if (municipio && fila.municipio !== municipio) return false;
      switch (vista) {
        // Sin canceladas ni cerradas sin realizar (las "No confirmó fecha"), igual que en Pendientes
        case 'operacion':
          if (fila.situacion === 'cancelado' || fila.situacion === 'cerrado') return false;
          return fila.fecha_de_agenda.slice(0, 10) === fecha || fila.fecha_resuelto.slice(0, 10) === fecha;
        // Solo lo agendado, con el mismo criterio que la tabla de cupos: sin canceladas ni las que no tienen fecha de agenda
        case 'pendientes':
          if (!ocupaCupo(fila)) return false;
          // y de los días que están en la tabla, así el mapa suma lo mismo que los recuadros
          if (enTabla && !enTabla.has(fila.fecha_de_agenda.slice(0, 10) + '|' + fila.municipio)) return false;
          if (!celda) return true;
          if (fila.municipio !== celda.municipio) return false;
          return !celda.fecha || fila.fecha_de_agenda.slice(0, 10) === celda.fecha;
        case 'realizados': return fila.situacion === 'realizado' && fila.fecha_resuelto.slice(0, 10) === fecha;
        case 'buscador': return fila.direccion === busDir;
        default: return false;
      }
    });
    if (vista === 'operacion') return ordenar(filtrarFranjas(filas));
    return ordenar(filas);
  }

  // Cuántas agendas del día hay en cada franja (para los botones) y, si no están todas prendidas,
  // solo las de las franjas elegidas (las que no tienen hora agendada salen solo con todas)
  function filtrarFranjas(filas) {
    porFranja = FRANJAS.map(() => 0);
    for (const fila of filas) if (franjaDe(fila) >= 0) porFranja[franjaDe(fila)]++;
    return verFranja.every(Boolean) ? filas : filas.filter(fila => verFranja[franjaDe(fila)]);
  }

  function ordenar(filas) {
    // Informe realizados: por transportista y después por hora de resolución (los sin transportista al final), como Bolsones
    // Operación del día igual; dentro de cada transportista, lo que falta resolver va al final por hora agendada
    if (vista === 'realizados' || vista === 'operacion') {
      const t = fila => nomTransp(fila.transportista === '-' ? '' : fila.transportista);
      const hora = fila => fila.fecha_resuelto || fila.fecha_de_agenda;
      return filas.sort((a, b) => (!t(a) - !t(b)) || t(a).localeCompare(t(b))
        || (!a.fecha_resuelto - !b.fecha_resuelto) || hora(a).localeCompare(hora(b)));
    }
    // Buscador: de la solicitud más vieja a la más nueva, como en Bolsones
    if (vista === 'buscador') return filas.sort((a, b) => a.fecha_de_reclamo.localeCompare(b.fecha_de_reclamo));
    return filas.sort((a, b) => b.fecha_de_reclamo.localeCompare(a.fecha_de_reclamo));
  }

  function totales() {
    const contar = condicion => resultados.filter(condicion).length;
    const fecha = fechas[vista];
    let items;
    switch (vista) {
      case 'operacion':
        items = [['Agendadas', contar(f => f.situacion !== 'cancelado' && f.fecha_de_agenda.slice(0, 10) === fecha)],
          ['Pendientes del día', contar(f => f.abierta)], ['Realizadas', contar(f => f.situacion === 'realizado' && f.fecha_resuelto.slice(0, 10) === fecha)],
          ['Canceladas', contar(f => f.situacion === 'cancelado')]];
        break;
      case 'pendientes':
        items = [['Pendientes', resultados.length], ['Sin fecha agendada', contar(f => !f.fecha_de_agenda)],
          ['Asignadas', contar(f => f.situacion === 'asignado')]];
        break;
      case 'realizados':
        items = [['Realizadas', resultados.length], ['Transportistas', new Set(resultados.map(f => f.transportista).filter(Boolean)).size]];
        break;
      default: items = [];
    }
    $('totales-mapa').textContent = items.map(([etiqueta, cantidad]) => etiqueta + ' ' + numero.format(cantidad)).join(' · ');
  }

  function badge(fila) {
    const [nombre, , fondo, texto] = estados[fila.situacion];
    return `<span class="est" style="--c:${texto};--bg-c:${fondo}">${nombre}</span>`;
  }

  // corta: la ficha del mapa de Informe realizados, como la de Bolsones (arriba dirección y municipio;
  // abajo el estado, el número de agenda, la fecha de resolución y el transportista)
  // pendiente: la ficha del mapa de Pendientes, sin número de agenda, circuito, estado ni transportista (pedido del 12/11)
  // realizado: la ficha del mapa de Informe realizados y de Operación del día, igual a la de Pendientes y abajo
  // Transportista y Resuelta, en ese orden (12/11; si todavía no se resolvió o no tiene transportista, esos renglones no salen)
  function contenidoFicha(fila, titulo, corta = false, pendiente = false, realizado = false) {
    const esc = COM2.esc;
    if (realizado) pendiente = true;
    const quitar = pendiente ? new Set(['Agenda', 'Circuito', 'Estado en el sistema', 'Transportista', 'Resolución', 'Matrícula']) : new Set();
    const campos = corta ? [['Agenda', fila.id_agenda], ['Fecha de resolución', fechaHora(fila.fecha_resuelto)],
      ['Transportista', nomTransp(fila.transportista)]] : [
      ['Agenda', fila.id_agenda], ['Circuito', fila.circuito], ['Estado en el sistema', fila.estado],
      ['Ingreso', fechaHora(fila.fecha_de_reclamo)], ['Agendada', fechaHora(fila.fecha_de_agenda)],
      ['Resolución', fechaHora(fila.fecha_resuelto)], ['Transportista', fila.transportista], ['Matrícula', fila.matricula],
      ['Contacto', fila.informacion], ['Descripción', fila.descripcion],
      ...(realizado ? [['Transportista ', nomTransp(fila.transportista === '-' ? '' : fila.transportista)], ['Resuelta', fechaHora(fila.fecha_resuelto)]] : [])
    ];
    return `<h3${titulo}>${esc(fila.direccion || 'Sin dirección')}</h3>
      <div class="sub">${chipMuni(fila.municipio)}</div><hr>
      ${pendiente ? '' : `<div class="agenda-ficha-estado">${badge(fila)}</div>`}<dl>
      ${campos.filter(([nombre, valor]) => valor && valor !== '—' && !quitar.has(nombre)).map(([nombre, valor]) => `<dt>${nombre}</dt><dd>${esc(valor)}</dd>`).join('')}
      </dl>`;
  }

  function abrirFicha(fila) {
    $('detalle').innerHTML = contenidoFicha(fila, ' id="ficha-titulo"');
    $('ficha').showModal();
  }

  function cerrarFichaMapa() {
    marcarPunto(null);
    $('ficha-mapa').classList.remove('on');
    $('ficha-mapa').replaceChildren();
  }

  function abrirFichaMapa(fila) {
    $('ficha-mapa').innerHTML = '<button type="button" class="ficha-x" aria-label="Cerrar ficha">×</button>' + contenidoFicha(fila, '', false, vista === 'pendientes', vista === 'realizados' || vista === 'operacion');
    $('ficha-mapa').classList.add('on');
  }

  const cabGeneral = ['Dirección', 'Municipio', 'Ingreso', 'Agenda', 'Resolución', 'Transportista', 'Estado'];
  // Informe realizados: el detalle como la tabla de Bolsones, sin título, sin cantidad y sin páginas
  const cabInforme = ['Municipio', 'Dirección', 'Descripción', 'Fecha agendada', 'Fecha de resolución',
    'Transportista', 'Lugar de descarga', 'Hora de descarga'];

  // Operación del día usa la misma tabla, con el estado al final (ahí hay pendientes y asignadas)
  function tablaInforme() {
    const esc = COM2.esc;
    // El Buscador también, con la fecha de solicitud después de la dirección (con el año) y el estado
    const conEstado = vista === 'operacion' || vista === 'buscador'; // sin columna Estado desde el 12/11 (redundante); solo cambia el texto de tabla vacia
    const conSolicitud = vista === 'buscador';
    const cab = [...cabInforme.slice(0, 2), ...(conSolicitud ? ['Fecha de solicitud', 'Teléfono'] : []), ...cabInforme.slice(2)];
    if (conSolicitud) {
      $('titulo-tabla').hidden = true;
      $('cantidad').innerHTML = busDir ? `<b class="num">${numero.format(resultados.length)}</b> ${resultados.length === 1 ? 'solicitud' : 'solicitudes'}` : '';
      $('tabla-wrap').hidden = !busDir;
      $('paginacion').hidden = true;
      $('sin-resultados').hidden = true;
      if (!busDir) return;
    }
    $('cabecera').innerHTML = '<tr>' + cab.map(c => `<th scope="col">${c}</th>`).join('') + '</tr>';
    $('sin-resultados').hidden = true;
    $('tabla-wrap').hidden = false;
    $('paginacion').hidden = true;
    $('filas').innerHTML = resultados.length ? resultados.map(fila => `<tr>
        <td>${chipMuni(fila.municipio, true)}</td>
        <td class="dir">${esc(fila.direccion)}</td>
        ${conSolicitud ? `<td class="hora">${fechaHora(fila.fecha_de_reclamo)}</td><td class="hora">${esc(fila.informacion)}</td>` : ''}
        <td class="desc">${esc(fila.descripcion)}</td>
        <td class="hora">${fechaHora(fila.fecha_de_agenda)}</td>
        <td class="hora">${fechaHora(fila.fecha_resuelto)}</td>
        <td class="obs">${esc(nomTransp(fila.transportista))}</td>
        <td>${esc(fila.lugar_de_descargas)}</td>
        <td class="hora">${esc(String(fila.hora_de_descargas || '').slice(0, 5))}</td></tr>`).join('')
      : `<tr><td colspan="${cab.length}" class="at-vacio">${conSolicitud ? 'No hay solicitudes en esa dirección' : conEstado ? 'No hay agendas ese día' : 'No hay agendas realizadas ese día'}</td></tr>`;
  }

  function mostrarTabla() {
    const esc = COM2.esc;
    const comoInforme = vista === 'realizados' || vista === 'operacion';
    $('listado-solicitudes').classList.toggle('informe', comoInforme);
    $('titulo-tabla').hidden = false;
    if (comoInforme || vista === 'buscador') return tablaInforme();
    $('cabecera').innerHTML = '<tr>' + cabGeneral.map(c => `<th scope="col">${c}</th>`).join('') + '</tr>';
    const inicio = pagina * porPagina;
    const paginas = Math.ceil(resultados.length / porPagina);
    $('titulo-tabla').textContent = nombres[vista];
    $('cantidad').innerHTML = resultados.length ? `<b class="num">${numero.format(resultados.length)}</b> solicitudes` : '';
    $('sin-resultados').hidden = Boolean(resultados.length);
    $('sin-resultados').textContent = vista === 'buscador' && !$('busqueda').value.trim()
      ? 'Ingresá una dirección o un número de agenda.' : 'No hay solicitudes para los filtros elegidos.';
    $('tabla-wrap').hidden = !resultados.length;
    $('filas').innerHTML = resultados.slice(inicio, inicio + porPagina).map((fila, indice) =>
      `<tr><td class="dir"><button type="button" class="agenda-direccion" data-fila="${inicio + indice}">${esc(fila.direccion || 'Sin dirección')}</button></td>
        <td>${chipMuni(fila.municipio) || '—'}</td><td>${fechaCorta(fila.fecha_de_reclamo)}</td><td>${fechaHora(fila.fecha_de_agenda)}</td>
        <td>${fechaCorta(fila.fecha_resuelto)}</td><td>${esc(fila.transportista || '—')}</td><td>${badge(fila)}</td></tr>`).join('');
    $('paginacion').hidden = paginas <= 1;
    $('anterior').disabled = pagina === 0;
    $('siguiente').disabled = pagina >= paginas - 1;
    $('pagina').textContent = 'Página ' + (pagina + 1) + ' de ' + paginas;
  }

  function mostrarMapa() {
    // El Buscador va sin mapa, como en Bolsones
    const visible = vistasMapa.includes(vista);
    $('mapa-card').hidden = !visible;
    cerrarFichaMapa();
    if (!visible) {
      puntos?.clearLayers();
      return;
    }
    // Pendientes se filtra desde la tabla de cupos: el mapa va sin el panel de la izquierda.
    // Los puntos van siempre con el color de su municipio, también con un recuadro elegido (pedido del usuario, 12/11).
    $('mapa-card').classList.toggle('sin-lado', vista === 'pendientes');
    const porMuni = vista === 'pendientes';
    const elegirModo = vista === 'operacion' || vista === 'realizados';
    const porTransportista = elegirModo && modo === 'transportista';
    $('modo').hidden = !elegirModo;
    // Operación del día en Transportistas: abajo de los filtros, qué es cada círculo (realizada rellena,
    // asignada con borde). Filtra como en Bolsones: el primer toque deja solo ese; con uno solo, los
    // pendientes y los transportistas que no tienen de eso desaparecen y los números cuentan solo eso
    const conTipo = vista === 'operacion' && porTransportista;
    $('ley-tipo').innerHTML = conTipo ? [['realizado', '', 'Realizado'], ['asignado', 'asig', 'Asignado']]
      .map(([k, c, l]) => `<button type="button" class="tg${verTipo[k] ? '' : ' off'}" data-tipo="${k}" aria-pressed="${verTipo[k]}"><i class="${c}"></i>${l}</button>`).join('') : '';
    const ambosTipos = verTipo.realizado && verTipo.asignado;
    const delMapa = conTipo && !ambosTipos ? resultados.filter(fila => verTipo[fila.situacion]) : resultados;
    const clave = fila => porMuni ? fila.municipio || 'Sin municipio'
      : porTransportista ? fila.transportista && fila.transportista !== '-' ? nomTransp(fila.transportista) : SIN_T : fila.situacion;
    const cuentas = new Map();
    for (const fila of delMapa) {
      const grupo = clave(fila);
      cuentas.set(grupo, (cuentas.get(grupo) || 0) + 1);
    }
    // Como en Bolsones: en Estado, Realizadas, Asignadas, Pendientes; en Transportistas, los sin transportista
    // al final como "Pendientes", en naranja
    const orden = porMuni ? horarios.flatMap(([, municipios]) => municipios).filter(m => cuentas.has(m))
      : porTransportista ? [...cuentas.keys()].filter(k => k !== SIN_T).sort((a, b) => cuentas.get(b) - cuentas.get(a) || a.localeCompare(b))
        .concat(cuentas.has(SIN_T) ? [SIN_T] : [])
      : ordenEstados.filter(e => cuentas.has(e));
    if (porMuni && cuentas.has('Sin municipio')) orden.push('Sin municipio');
    // Cada transportista conserva su color aunque la referencia de círculos cambie el orden de la lista
    const todosT = new Map();
    if (porTransportista) for (const fila of resultados) todosT.set(clave(fila), (todosT.get(clave(fila)) || 0) + 1);
    const ordenColor = [...todosT.keys()].filter(k => k !== SIN_T).sort((a, b) => todosT.get(b) - todosT.get(a) || a.localeCompare(b));
    const colores = new Map(orden.map(grupo => [grupo,
      porMuni ? coloresMuni[grupo] || '#B5AFA6' : porTransportista ? grupo === SIN_T ? estados.pendiente[1] : coloresTransp[ordenColor.indexOf(grupo) % coloresTransp.length] : estados[grupo][1]
    ]));
    const nombre = grupo => porMuni ? coloresMuni[grupo] ? 'Municipio ' + grupo : grupo
      : porTransportista ? grupo : plurales[grupo];
    if (!cuentas.has(grupoMapa)) grupoMapa = '';
    $('leyenda').innerHTML = orden.map(grupo => {
      const activo = !grupoMapa || grupoMapa === grupo;
      return `<button type="button" class="${porMuni ? 'pen-fila' : 'tg'}${activo ? '' : ' off'}" data-grupo="${COM2.esc(grupo)}"
        style="--c:${colores.get(grupo)}" aria-pressed="${activo}">${porMuni ? '' : '<i></i>'}
        <span>${COM2.esc(nombre(grupo))}</span><b class="num">${numero.format(cuentas.get(grupo))}</b></button>`;
    }).join('');
    const visibles = grupoMapa ? delMapa.filter(fila => clave(fila) === grupoMapa) : delMapa;
    const conUbicacion = visibles.filter(fila => fila.coordenadas);
    const faltantes = visibles.length - conUbicacion.length;
    $('sin-coordenadas').textContent = !window.L ? 'El mapa no está disponible.' : !visibles.length
      ? 'No hay solicitudes para los filtros elegidos.' : faltantes
        ? numero.format(faltantes) + (faltantes === 1 ? ' solicitud sin coordenadas.' : ' solicitudes sin coordenadas.') : '';
    if (!window.L) return;
    if (!mapa) {
      // Sin la marca de OpenStreetMap / CARTO abajo a la derecha (pedido del usuario, 12/11)
      mapa = L.map('mapa', { zoomControl: false, attributionControl: false, preferCanvas: true, zoomSnap: .25 }).setView([-34.86, -56.16], 12);
      teselas = L.tileLayer(SupervisionMapa.teselas, {
        maxNativeZoom: 18, maxZoom: 20, subdomains: 'abcd', attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(mapa);
      puntos = L.layerGroup().addTo(mapa);
      mapa.on('click', cerrarFichaMapa);
    }
    puntos.clearLayers();
    marcadores = [];
    // Modo Transportistas: cada realizada lleva el orden en que la hizo su transportista, como en Bolsones
    const numeros = new Map();
    if (porTransportista) {
      const porT = new Map();
      for (const fila of conUbicacion.filter(f => f.situacion === 'realizado')) {
        if (!porT.has(clave(fila))) porT.set(clave(fila), []);
        porT.get(clave(fila)).push(fila);
      }
      porT.forEach(filas => filas.sort((a, b) => a.fecha_resuelto.localeCompare(b.fecha_resuelto)).forEach((f, i) => numeros.set(f, i + 1)));
    }
    for (const fila of conUbicacion) {
      const color = colores.get(clave(fila));
      const contorno = porTransportista && fila.situacion === 'asignado';
      const n = numeros.get(fila);
      const borde = { color: contorno ? color : '#fff', weight: contorno ? 2.5 : 1.5 };
      const marcador = L.circleMarker(fila.coordenadas, {
        radius: n ? 9 : 6, ...borde, fillColor: contorno ? '#fff' : color, fillOpacity: .95
      }).bindTooltip(COM2.esc(fila.direccion || 'Sin dirección'), { direction: 'top', offset: [0, -6] })
        .on('click', evento => {
          L.DomEvent.stopPropagation(evento);
          abrirFichaMapa(fila);
          marcarPunto(marcador);
        }).addTo(puntos);
      marcador.borde = borde;
      marcadores.push(marcador);
      // El número va encima y deja pasar el mouse al punto
      if (n) L.marker(fila.coordenadas, { interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'pt-num', html: String(n), iconSize: [18, 18] }) }).addTo(puntos);
    }
    mapa.invalidateSize();
    if (conUbicacion.length) mapa.fitBounds(conUbicacion.map(f => f.coordenadas), { padding: [30, 30], maxZoom: 15, animate: false });
  }

  // El punto elegido lleva el borde oscuro, como en Bolsones
  function marcarPunto(elegido) {
    for (const m of marcadores) m.setStyle(m === elegido ? { color: tinta(), weight: 3 } : m.borde);
    elegido?.bringToFront();
  }

  // Descargas: la misma hoja que usa el punto 3.4 del Dashboard de Agenda
  // (REGISTRO DESCARGA de PLANIFICACION AGENDA 2026, publicada en CSV). Se lee una vez.
  const DESCARGAS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRBHNqLd2HQlN4CJC3ChcCLf3S7dOOgwItrH3UWkSxwlTf6soWNYmfhUYqEzw8MLvphHa5B7iNAi-4W/pub?gid=1863071158&single=true&output=csv';
  let descargas = null;
  let pidiendoDescargas = false;

  // Igual que descargasDesdeCSV del Dashboard: ubica las columnas por nombre
  function leerDescargas(texto) {
    const filas = parseCSVFilas(texto);
    let col = null;
    for (let i = 0; i < Math.min(filas.length, 30) && !col; i++) {
      const f = filas[i].map(normalizar);
      const fecha = f.indexOf('fecha'), hora = f.indexOf('hora'), trans = f.indexOf('transportista');
      const lugar = f.findIndex(x => x.startsWith('lugar'));
      if (fecha >= 0 && hora >= 0 && trans >= 0 && lugar >= 0) col = { desde: i + 1, fecha, lugar };
    }
    if (!col) throw new Error('sin columnas de descargas');
    const salida = [];
    for (const f of filas.slice(col.desde)) {
      const fecha = fechaCupo(f[col.fecha]);
      const lugar = String(f[col.lugar] || '').trim();
      if (fecha && lugar) salida.push({ fecha, lugar });
    }
    return salida;
  }

  function pedirDescargas() {
    if (descargas || pidiendoDescargas) return;
    pidiendoDescargas = true;
    fetch(DESCARGAS_URL + '&_=' + Date.now(), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(texto => { descargas = leerDescargas(texto); })
      .catch(() => { descargas = []; })
      .finally(() => { pidiendoDescargas = false; if (vista === 'realizados') mostrarGraficas(); });
  }

  function mostrarGraficas() {
    graficas.forEach(grafica => grafica.destroy());
    graficas.clear();
    // Como en Bolsones: las dos van siempre en Informe realizados; vacías dicen "Sin datos"
    $('graficas').hidden = vista !== 'realizados' || !window.Chart;
    if ($('graficas').hidden) return;
    pedirDescargas();
    const dia = fechas.realizados || '';
    const agrupar = clave => {
      const t = new Map();
      for (const fila of resultados) { const k = clave(fila); if (k) t.set(k, (t.get(k) || 0) + 1); }
      return [...t];
    };
    const mayorPrimero = filas => filas.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
    const series = [
      ['grafica-transportista', mayorPrimero(agrupar(f => nomTransp(f.transportista === '-' ? '' : f.transportista)))],
      ['grafica-descargas', mayorPrimero([...(descargas || []).filter(d => d.fecha === dia)
        .reduce((t, d) => t.set(d.lugar, (t.get(d.lugar) || 0) + 1), new Map())])]
    ];
    for (const [id, filas] of series) {
      barrasH(id, filas.map(x => x[0]), filas.map(x => x[1]));
      const total = filas.reduce((suma, x) => suma + x[1], 0);
      $(id + 'Tot').innerHTML = filas.length ? `<span>Total</span><b class="num">${numero.format(total)}</b>` : '';
    }
  }

  // ── barras como las de Bolsones ──
  // Nombres largos en dos renglones, cortando en el espacio más cercano a la mitad
  const partirNombre = texto => {
    if (texto.length <= 16) return texto;
    const esp = [...texto.matchAll(/ /g)].map(m => m.index);
    if (!esp.length) return texto;
    const corte = esp.reduce((m, i) => Math.abs(i - texto.length / 2) < Math.abs(m - texto.length / 2) ? i : m);
    return [texto.slice(0, corte), texto.slice(corte + 1)];
  };
  // Escribe el valor al final de cada barra
  const totalAlFinal = {
    id: 'totalAlFinal',
    afterDatasetsDraw(chart) {
      const { ctx } = chart, meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = "600 12px 'DM Sans', system-ui, sans-serif";
      ctx.fillStyle = tinta();
      ctx.textBaseline = 'middle';
      chart.data.datasets[0].data.forEach((valor, i) => ctx.fillText(numero.format(valor), meta.data[i].x + 6, meta.data[i].y));
      ctx.restore();
    }
  };
  // "Total" termina donde terminan los nombres y el número arranca donde arrancan las barras
  const alinearTotal = {
    id: 'alinearTotal',
    afterLayout(chart) {
      const el = document.getElementById(chart.canvas.id + 'Tot');
      if (el) el.style.gridTemplateColumns = `${chart.chartArea.left}px 1fr`;
    }
  };
  function barrasH(id, etiquetas, valores) {
    const cont = $(id).parentElement;
    cont.querySelector('.g-vacio')?.remove();
    const dos = etiquetas.some(e => partirNombre(e) !== e);
    // Alto justo para las barras; vacía, un renglón para el "Sin datos"
    cont.style.height = (etiquetas.length ? etiquetas.length * (dos ? 36 : 30) : 40) + 'px';
    if (!etiquetas.length) { cont.insertAdjacentHTML('beforeend', '<div class="g-vacio">Sin datos</div>'); return; }
    graficas.set(id, new Chart($(id), {
      type: 'bar',
      data: { labels: etiquetas.map(partirNombre), datasets: [{ data: valores, backgroundColor: azulBarras, borderRadius: 4, borderSkipped: false,
        maxBarThickness: 18, categoryPercentage: .8, barPercentage: .9 }] },
      options: {
        indexAxis: 'y', maintainAspectRatio: false, animation: { duration: 250 },
        layout: { padding: { right: 36 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false, beginAtZero: true },
          y: { grid: { display: false }, border: { display: false },
            ticks: { padding: 6, color: tinta2, font: { family: "'DM Sans', system-ui, sans-serif", size: 12 } },
            afterFit: escala => { escala.paddingTop = 0; escala.paddingBottom = 0; } }
        }
      },
      plugins: [totalAlFinal, alinearTotal]
    }));
  }

  // Marca en la tabla de cupos el recuadro o municipio elegido. Sin renglón de texto abajo (pedido del usuario, 12/11).
  function marcarCupos() {
    $('situacion-filas').querySelectorAll('[data-municipio]').forEach(boton => {
      const elegido = Boolean(celda) && boton.dataset.municipio === celda.municipio && (boton.dataset.fecha || '') === (celda.fecha || '');
      boton.classList.toggle('sel', elegido);
      boton.setAttribute('aria-pressed', elegido);
    });
  }

  // Botones de franjas, arriba en el panel del mapa de Operación del día. Filtran el mapa y la tabla y
  // funcionan como los filtros de Bolsones: el primer toque deja solo esa franja, después cada toque suma
  // o saca (por ejemplo, toda la mañana) y si se apagan todas vuelven todas
  function mostrarFranjas() {
    $('franjas').innerHTML = vista !== 'operacion' ? '' : '<p class="ft">Franja agendada</p><div class="fr">'
      + FRANJAS.map(([desde, hasta], i) => `<button type="button" class="tg${verFranja[i] ? '' : ' off'}" data-franja="${i}" aria-pressed="${verFranja[i]}">${desde}–${hasta}<b class="num">${numero.format(porFranja[i])}</b></button>`).join('')
      + '</div>';
  }

  function actualizar() {
    pagina = 0;
    resultados = filtrar();
    mostrarFranjas();
    totales();
    if (vista === 'pendientes') marcarCupos();
    if (vista !== 'pendientes') mostrarTabla();
    mostrarMapa();
    mostrarGraficas();
  }

  function elegirVista(nuevaVista) {
    vista = nuevaVista;
    grupoMapa = '';
    celda = null;
    botones.forEach(boton => {
      boton.classList.toggle('on', boton.dataset.vista === vista);
      boton.setAttribute('aria-pressed', boton.dataset.vista === vista);
    });
    const activo = botones.find(boton => boton.dataset.vista === vista);
    const barra = activo.parentElement;
    const item = activo.getBoundingClientRect();
    const area = barra.getBoundingClientRect();
    if (item.right > area.right) barra.scrollLeft += item.right - area.right + 6;
    else if (item.left < area.left) barra.scrollLeft += item.left - area.left - 6;
    $('organizacion').hidden = vista !== 'organizacion';
    $('resultados').hidden = vista === 'organizacion';
    $('listado-solicitudes').hidden = vista === 'pendientes';
    $('situacion').hidden = vista !== 'pendientes';
    if (vista === 'organizacion') return;
    $('filtro-fecha').hidden = !etiquetasFecha[vista];
    $('etiqueta-fecha').textContent = vistasMapa.includes(vista) ? 'Fecha' : etiquetasFecha[vista] || '';
    $('fecha').setAttribute('aria-label', etiquetasFecha[vista] || 'Fecha');
    $('fecha').value = fechas[vista] || '';
    $('fecha').max = vista === 'realizados' ? ayer : '';
    $('filtro-busqueda').hidden = vista !== 'buscador';
    // Informe realizados: en el panel del mapa solo la fecha y Estado / Transportistas, como en Bolsones
    // (Operación del día igual, desde el 12/11)
    $('filtro-municipio').hidden = vista === 'realizados' || vista === 'operacion' || vista === 'buscador';
    $('totales-mapa').hidden = vista === 'realizados' || vista === 'operacion';
    $(vistasMapa.includes(vista) ? 'filtros-mapa' : 'filtros-tabla').append($('filtros'));
    $('filtros-mapa').hidden = !vistasMapa.includes(vista);
    actualizar();
  }

  async function cargar() {
    $('reintentar').hidden = true;
    $('rueda').hidden = false;
    $('mensaje').textContent = 'Cargando información…';
    try {
      if (!window.COM2?.acceso) throw new Error('No se pudo cargar la conexión de COM 2.');
      if (!await COM2.acceso()) return;
      const [base, privado, cupos] = await Promise.all([bajarBase(), bajarPrivado(), bajarCupos()]);
      registros = preparar(base, privado);
      if (cupos) mostrarSituacion(cupos);
      else $('situacion-estado').textContent = 'No se pudieron cargar los cupos. Recargá la página para reintentar.';
      const municipios = [...new Set(registros.map(f => f.municipio).filter(Boolean))].sort();
      $('municipio').replaceChildren(new Option('Todos', ''), ...municipios.map(m => new Option(m, m)));
      $('aviso-privados').hidden = privado !== null;
      mostrarOrganizacion();
      $('supervision').hidden = false;
      elegirVista(vista);
      await esperarMapa();
      $('supervision').inert = false;
      $('carga').hidden = true;
    } catch (error) {
      $('supervision').hidden = true;
      $('rueda').hidden = true;
      $('mensaje').textContent = error.message || 'No se pudo cargar Agenda.';
      $('reintentar').hidden = false;
    }
  }

  function esperarMapa() {
    if (!teselas?.isLoading()) return Promise.resolve();
    return new Promise(resolve => {
      const terminar = () => {
        clearTimeout(plazo);
        teselas.off('load', terminar);
        resolve();
      };
      const plazo = setTimeout(terminar, 4000);
      teselas.on('load', terminar);
    });
  }

  botones.forEach(boton => boton.addEventListener('click', () => elegirVista(boton.dataset.vista)));
  new ResizeObserver(([entrada]) => document.documentElement.style.setProperty('--alto-barra', entrada.target.offsetHeight + 'px'))
    .observe(document.querySelector('.barra'));
  $('modo').addEventListener('click', evento => {
    const boton = evento.target.closest('[data-modo]');
    if (!boton) return;
    modo = boton.dataset.modo;
    grupoMapa = '';
    $('modo').querySelectorAll('button').forEach(opcion => {
      opcion.classList.toggle('on', opcion === boton);
      opcion.setAttribute('aria-pressed', opcion === boton);
    });
    mostrarMapa();
  });
  $('leyenda').addEventListener('click', evento => {
    const boton = evento.target.closest('[data-grupo]');
    if (!boton) return;
    grupoMapa = grupoMapa === boton.dataset.grupo ? '' : boton.dataset.grupo;
    mostrarMapa();
    [...$('leyenda').querySelectorAll('button')].find(b => b.dataset.grupo === boton.dataset.grupo)?.focus();
  });
  $('franjas').addEventListener('click', evento => {
    const boton = evento.target.closest('[data-franja]');
    if (!boton) return;
    const k = Number(boton.dataset.franja);
    if (verFranja.every(Boolean)) verFranja.forEach((_, i) => verFranja[i] = i === k);
    else {
      verFranja[k] = !verFranja[k];
      if (!verFranja.some(Boolean)) verFranja.fill(true);
    }
    actualizar();
    $('franjas').querySelector(`[data-franja="${k}"]`)?.focus();
  });
  // Al cambiar el tema se vuelven a pintar las gráficas con los colores nuevos
  window.addEventListener('com2:tema', () => graficas.forEach(g => g.update('none')));
  $('ley-tipo').addEventListener('click', evento => {
    const boton = evento.target.closest('[data-tipo]');
    if (!boton) return;
    const k = boton.dataset.tipo, claves = Object.keys(verTipo);
    if (claves.every(c => verTipo[c])) claves.forEach(c => verTipo[c] = c === k);
    else {
      verTipo[k] = !verTipo[k];
      if (!claves.some(c => verTipo[c])) claves.forEach(c => verTipo[c] = true);
    }
    mostrarMapa();
  });
  $('ficha-mapa').addEventListener('click', evento => {
    if (evento.target.closest('.ficha-x')) cerrarFichaMapa();
  });
  $('situacion-filas').addEventListener('click', evento => {
    const boton = evento.target.closest('[data-municipio]');
    if (!boton) return;
    const elegida = { municipio: boton.dataset.municipio, fecha: boton.dataset.fecha };
    celda = celda && celda.municipio === elegida.municipio && celda.fecha === elegida.fecha ? null : elegida;
    actualizar();
  });
  $('municipio').addEventListener('change', actualizar);
  $('fecha').addEventListener('change', evento => {
    if (!evento.target.value || !evento.target.validity.valid) {
      evento.target.value = fechas[vista];
      return;
    }
    fechas[vista] = evento.target.value;
    actualizar();
  });
  // ── Buscador de dirección, como el de Bolsones ──
  // Mientras se escribe aparecen abajo las direcciones que coinciden (cada palabra tiene que estar, sin
  // importar tildes ni mayúsculas; un número de agenda trae su dirección). Al elegir una, la tabla
  // muestra todas las solicitudes de esa dirección.
  function opcionesBuscador(texto) {
    const consulta = normalizar(texto).replace(/[^a-z0-9]+/g, ' ').trim();
    if (consulta.replace(/ /g, '').length < 3) return [];
    const palabras = consulta.split(' ');
    const porDir = new Map();
    for (const fila of registros) {
      if (!fila.direccion || !(consulta === fila.id_agenda || palabras.every(p => fila.direccionNormal.includes(p)))) continue;
      const o = porDir.get(fila.direccion) || { dir: fila.direccion, mun: fila.municipio, n: 0 };
      o.n++;
      porDir.set(fila.direccion, o);
    }
    // Primero las que empiezan con lo escrito y después las de más solicitudes
    const empieza = o => normalizar(o.dir).startsWith(palabras[0]) ? 0 : 1;
    return [...porDir.values()].sort((a, b) => empieza(a) - empieza(b) || b.n - a.n || a.dir.localeCompare(b.dir));
  }

  function listaBuscador() {
    busOpc = opcionesBuscador($('busqueda').value);
    const lista = $('bus-lista');
    const escrito = normalizar($('busqueda').value).replace(/\s/g, '').length >= 3;
    lista.innerHTML = !busOpc.length ? (escrito ? '<div class="bus-nada">No se encontró esa dirección</div>' : '')
      : busOpc.slice(0, BUS_MAX).map((o, i) => `<button type="button" data-i="${i}">${chipMuni(o.mun, true)}<span class="bus-dir">${COM2.esc(o.dir)}</span><b class="num">${numero.format(o.n)}</b></button>`).join('')
        + (busOpc.length > BUS_MAX ? `<div class="bus-nada">y ${numero.format(busOpc.length - BUS_MAX)} más: seguí escribiendo</div>` : '');
    lista.hidden = !lista.innerHTML;
  }

  function elegirDir(o) {
    busDir = o.dir;
    $('busqueda').value = o.dir;
    $('bus-lista').hidden = true;
    actualizar();
  }

  let busEspera;
  $('busqueda').addEventListener('input', () => {
    // Al cambiar lo escrito se deja de mostrar la dirección elegida hasta elegir otra
    if (busDir) { busDir = null; actualizar(); }
    clearTimeout(busEspera);
    busEspera = setTimeout(listaBuscador, 150);
  });
  $('busqueda').addEventListener('focus', () => { if (!busDir) listaBuscador(); });
  $('busqueda').addEventListener('blur', () => { $('bus-lista').hidden = true; });
  $('bus-lista').addEventListener('mousedown', evento => {
    const boton = evento.target.closest('[data-i]');
    if (!boton) return;
    evento.preventDefault();
    elegirDir(busOpc[Number(boton.dataset.i)]);
  });
  // Flechas para moverse en la lista, Enter para elegir, Escape para cerrarla
  $('busqueda').addEventListener('keydown', evento => {
    const opciones = [...$('bus-lista').querySelectorAll('button')];
    const actual = opciones.findIndex(b => b.classList.contains('sel'));
    if ((evento.key === 'ArrowDown' || evento.key === 'ArrowUp') && opciones.length) {
      evento.preventDefault();
      const siguiente = (actual + (evento.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length;
      opciones.forEach((b, i) => b.classList.toggle('sel', i === siguiente));
      opciones[siguiente].scrollIntoView({ block: 'nearest' });
    } else if (evento.key === 'Enter' && opciones.length) {
      evento.preventDefault();
      elegirDir(busOpc[Number(opciones[Math.max(actual, 0)].dataset.i)]);
    } else if (evento.key === 'Escape') {
      $('bus-lista').hidden = true;
    }
  });
  $('filas').addEventListener('click', evento => {
    const boton = evento.target.closest('[data-fila]');
    if (boton) abrirFicha(resultados[Number(boton.dataset.fila)]);
  });
  $('anterior').addEventListener('click', () => { pagina--; mostrarTabla(); });
  $('siguiente').addEventListener('click', () => { pagina++; mostrarTabla(); });
  $('ficha').addEventListener('close', () => $('detalle').replaceChildren());
  $('reintentar').addEventListener('click', cargar);
  cargar();
})();
