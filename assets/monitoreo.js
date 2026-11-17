// GENERADO por Desktop/IA/centro-operativo/armar_monitoreo_com2.py desde el Mapa de monitoreo (centro-operativo/index.html).
// No editar a mano: cambiar el monitoreo y volver a correr el script.
// Es el modelo del monitoreo (planilla de transportistas, tareas especiales, asistencia de ZL y el archivo liviano de n8n
// centro-operativo.json.gz) sin la parte de pantalla. Lo usa reclamos-coordinacion.html (recursos de cada municipio).
// Necesita antes assets/municipios.js (MUNI_GEO).
(function () {
"use strict";
const MUNI_GEO = window.MUNI_GEO;
let avisar = () => {};
function pintar() { try { avisar(); } catch (e) { console.error(e); } }

/* ============================== CONFIGURACIÓN ============================== */
const CFG={
  SB:'https://srgduwdvkgqrrmhxpzlx.supabase.co/storage/v1/object/public/bases/',
  PLAN:'1y1e4h2Tr0dLwxANuKqZWMMZLDCRzDtzkKqfZTRO8xEU',   // seguimiento diario de transportistas (primera pestaña)
  TE:'1MgxpmNHlQTaGs_w49SRTJrIo-CYWP2JPxjvx4AgSlAc',     // TAREAS ESPECIALES, pestaña del día "DD/MM"
  CARTO:'cb1_4dpf_1_b2ca9299be611862d5d23c88',           // clave pública del fondo de mapa (la misma de COM 2)
  ASIS:'1utiAj4kWcpwQijBYjiUX8pAIdTVqGdjSsit50EEhxhU',   // asistencia de empresas (pestaña "Asistencia"): de ahí sale qué unidades de ZL salen y su horario típico
  ASIS_PESTANA:'Asistencia',
  ASIS_DIAS:28,   // se miran las últimas 4 semanas
  GRACIA_ZL:30,   // el horario de las empresas es estimado: min de espera antes de avisar que no arrancó
  POCAS:2,        // con 1 o 2 tareas asignadas: "Pocas tareas"
  PARADO:60,      // min sin cerrar nada teniendo tareas: "Parado"
  CIERRE:45,      // últimos min del turno sin tareas: "Cierre de turno" (no es alerta)
  GRACIA:15,      // min después de la hora de entrada antes de avisar "Sin confirmar salida"
  MARGEN:30,      // "Ahora" muestra los turnos que empiezan o terminaron hace menos de esto (min)
  RITMO:90,       // ventana para medir cierres por hora (min)
  CO:'centro-operativo.json.gz',   // archivo liviano que arma n8n cada 5 min (flujo centroOperativo1): solo asignadas y cierres desde las 18 h de ayer
  CADA_BASES:60, CADA_PLAN:120, CADA_TE:120, CADA_ASIS:1800   // segundos entre lecturas
};
const BASES={
  rec:{arch:'reclamos.json.gz',  clave:'reclamos',   nombre:'Reclamos',    corto:'R'},
  zl: {arch:'zona-limpia.json.gz',clave:'zona-limpia',nombre:'Zona Limpia', corto:'Z'},
  age:{arch:'agenda.json.gz',    clave:'agenda',     nombre:'Agenda',      corto:'A'},
  bol:{arch:'bolsones.json',     clave:'bolsones',   nombre:'Bolsones',    corto:'B'}
};
const KEYS=Object.keys(BASES);
/* Estados de un recurso planificado. o = orden en la lista; al = cuenta como alerta */
const ST={
  sin_tarea: {l:'Sin tarea',            c:'--sin',    o:0, al:1},
  sin_marca: {l:'Sin confirmar salida', c:'--marca',  o:1, al:1},
  parado:    {l:'Parado',               c:'--parado', o:2, al:1},
  pocas:     {l:'Pocas tareas',         c:'--pocas',  o:3, al:1},
  ok:        {l:'Trabajando',           c:'--ok',     o:4},
  especial:  {l:'Tarea especial',       c:'--esp',    o:5},
  te_espera: {l:'Tarea esp. por iniciar',c:'--esp',   o:6},
  cierre:    {l:'Cierre de turno',      c:'--cierre', o:7},
  por_entrar:{l:'Por entrar',           c:'--off',    o:8},
  no_salio:  {l:'No salió',             c:'--off',    o:9},
  retirado:  {l:'Se retiró',            c:'--off',    o:10},
  termino:   {l:'Terminó turno',        c:'--off',    o:11}
};
const TRABAJANDO=['sin_tarea','parado','pocas','ok','especial','te_espera','cierre'];
/* Nombres de las bases que no son un transportista (estados, zonas, derivaciones) */
const PSEUDO=[/^(limpio|repetido|playas|en proceso|derivado|pala|hecho|pendiente|cancelado)\s*-\s*\d+$/i,/^agenda\s*-/i,/^-$/,
  /^(capurro|cerro|la teja|malvin|bella italia|carrasco)\s*-\s*0\d\d$/i,/^regi[oó]n zona limpia/i];
const esPseudo=t=>!t||PSEUDO.some(r=>r.test(String(t).trim()));

/* ============================== UTILIDADES ============================== */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const load=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
/* Reloj de Montevideo: ms cuyos campos UTC son la hora local (igual que las fechas de las bases) */
const MVD=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Montevideo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function wall(ms){const p={};for(const x of MVD.formatToParts(new Date(ms)))p[x.type]=x.value;return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute,+p.second)}
const ahora=()=>wall(Date.now());
const DIA=86400000;
const diaDe=w=>Math.floor(w/DIA)*DIA;
const minDe=w=>Math.floor((w-diaDe(w))/60000);
const hhmm=w=>{const d=new Date(w);return pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())};
const hm=m=>pad(Math.floor(m/60)%24)+':'+pad(Math.round(m)%60);
function dur(min){min=Math.max(0,Math.round(min));if(min<60)return min+' min';const h=Math.floor(min/60),m=min%60;return h+' h'+(m?' '+pad(m):'')}
function parseHM(x){const m=/(\d{1,2})\s*[:.]\s*(\d{2})/.exec(String(x||''));return m&&+m[1]<24?+m[1]*60+ +m[2]:null}
/* primer rango horario de un texto: "TURNO DE 7:00 A 14:00", "8 a 14Hs", "06:30 - 13:20" */
function parseRange(p){
  const m=/(?<![\d:])(\d{1,2})(?::(\d{2}))?\s*(?:hs?|hrs|horas)?\s*(?:a|-|–|hasta)\s*(\d{1,2})(?::(\d{2}))?(?!\d)/i.exec(p||'');
  if(!m)return null;
  const s=+m[1]*60+(+m[2]||0),e=+m[3]*60+(+m[4]||0);
  return (+m[1]<=23&&+m[3]<=24&&e>s)?[s,e]:null;
}
function parseCSV(t){
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;
    else if(c===','){row.push(f);f=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f=''}
    else f+=c;
  }
  if(f||row.length){row.push(f);rows.push(row)}
  return rows;
}

/* ---------- nombres: la planilla dice "Virginia Mora", la base "Virgina Mora -9998" ---------- */
const STOP=new Set(['y','e','de','del','la','las','los']);
const limpio=t=>String(t||'').replace(/\s*-\s*\d+\s*$/,'').replace(/\s*-\s*SA\s*$/i,'').trim();
function toks(s){return new Set(norm(limpio(s)).replace(/&/g,' ').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x&&!STOP.has(x)))}
function osa(a,b){
  const m=a.length,n=b.length,d=[];
  for(let i=0;i<=m;i++){d[i]=[i];for(let j=1;j<=n;j++)d[i][j]=i?0:j}
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }
  return d[m][n];
}
function near(a,b){
  if(a===b)return true;
  const mn=Math.min(a.length,b.length),mx=Math.max(a.length,b.length);
  if(mn<4||mx-mn>2||/^\d+$/.test(a)||/^\d+$/.test(b))return false;
  return osa(a,b)<=(mx>=7?2:1);
}
/* Parecido entre dos nombres (0 = no son el mismo): todas las palabras del nombre más corto tienen que estar en el otro */
function parecido(A,B){
  const [S,L]=A.size<=B.size?[A,B]:[B,A];if(!S.size)return 0;
  let i=0;for(const x of S){for(const y of L)if(near(x,y)){i++;break}}
  if(i<S.size||(S.size===1&&[...S][0].length<4))return 0;
  return i/(A.size+B.size-i);
}

/* ============================== ESTADO ============================== */
const DATA={plan:null,planAt:0,planErr:'',te:null,teAt:0,teErr:'',teTab:'',bases:{},vers:{},basesErr:'',basesAt:0};
const UI={origen:'todos',filtro:null,sel:null,q:'',nombres:load('co_nombres',true),mun:true,fuera:false,cerrados:load('co_cerrados',{})};

/* ============================== LECTURA: PLANILLAS ============================== */
/* Todo pedido tiene un tiempo máximo: si la red se cuelga (wifi de la tele, VPN), se corta y el próximo vuelve a intentar.
   Sin esto, un pedido colgado dejaba la página sin actualizar hasta recargarla a mano. */
async function pedir(u,leer,ms=30000){
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);
  try{const r=await fetch(u,{cache:'no-store',signal:ac.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await leer(r)}
  catch(e){throw e.name==='AbortError'?new Error('sin respuesta en '+ms/1000+' s'):e}
  finally{clearTimeout(t)}
}
async function hoja(id,sheet){
  const u=`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=0${sheet?'&sheet='+encodeURIComponent(sheet):''}&_=${Date.now()}`;
  const t=await pedir(u,r=>r.text());
  if(/^\s*</.test(t))throw new Error('sin acceso (¿dejó de estar compartida?)');
  return parseCSV(t);
}
/* Planilla de seguimiento: Municipio | Transportista | Planificación | Tarea inicial | (enviada) | Sale? | Hora salida | Se retira | Observaciones */
function leerPlan(rows){
  const out=[];let turno='Matutino',grupo='';
  for(const r of rows){
    const c0=String(r[0]||'').trim(),c1=String(r[1]||'').trim(),n0=norm(c0);
    if(/turno\s+vespertino/.test(n0)){turno='Vespertino';grupo='';continue}
    if(/turno\s+matutino/.test(n0)){turno='Matutino';grupo='';continue}
    if(/turno\s+nocturno/.test(n0)){turno='Nocturno';grupo='';continue}
    if(/^seguimiento/.test(n0)||norm(c1)==='transportista')continue;
    if(c0)grupo=c0.replace(/\s+/g,' ');
    if(!c1||/^#n\/a$/i.test(c1))continue;
    const plan=String(r[2]||'').replace(/\s+/g,' ').trim();
    const rg=parseRange(plan)||(turno==='Vespertino'?[780,1200]:[420,840]);
    const sale=norm(r[5]);
    out.push({id:'p'+out.length,nombre:c1,tok:toks(c1),turno,grupo,plan,tarea:String(r[3]||'').trim(),s:rg[0],e:rg[1],
      sale:String(r[5]||'').trim(),noAsis:/no asisti/.test(sale),noCulmina:/no culmina/.test(sale),
      asis:!!sale&&!/no asisti/.test(sale),entra:parseHM(r[6]),retiro:parseHM(r[7]),obs:String(r[8]||'').trim()});
  }
  return out;
}
async function cargarPlan(){
  try{
    const p=leerPlan(await hoja(CFG.PLAN));
    if(!p.length)throw new Error('no se encontraron transportistas');
    DATA.plan=p;DATA.planAt=Date.now();DATA.planErr='';MATCH.clear();
  }catch(e){DATA.planErr='Planilla: '+e.message}
  pintar();
}
/* Tareas especiales: DIAS | TIPO | BLOQUE | MUNICIPIO | TAREA | MENSAJE | DETALLE | TRANSPORTISTA | ESTADO | HORA INICIO | HORA FINAL
   El transportista va combinado: las filas de abajo sin nombre son del mismo bloque. */
function leerTE(rows){
  const hi=rows.findIndex(r=>/^transportista/.test(norm(r[7]))&&/^estado/.test(norm(r[8])));
  if(hi<0)return null;
  const L=[];let cur='',curMun='';
  for(const r of rows.slice(hi+1)){
    if(/^(matutino|vespertino|nocturno)$/.test(norm(r[0]))){cur='';curMun='';continue}
    const t=String(r[7]||'').trim(),bloque=String(r[2]||'').trim(),mun=String(r[3]||'').trim();
    if(t)cur=t;else if(bloque)cur='';
    if(mun)curMun=mun;else if(bloque)curMun='';   // el 2º trabajador de un barrio viene sin municipio: es el del bloque
    r[3]=curMun;
    if(!cur)continue;
    const est=norm(r[8]);
    L.push({nombre:cur,tarea:String(r[4]||'').split('\n')[0].trim()||String(r[1]||'').trim(),mun:String(r[3]||'').trim(),
      est:/en proceso/.test(est)?'proc':/realizada/.test(est)?'real':/aceptada|envia/.test(est)?'acep':est?'otro':'plan',
      ini:parseHM(r[9]),fin:parseHM(r[10])});
  }
  return L;
}
/* Pestaña de acopios (si existe): TRANSPORTISTA en la col. 6, HORA INICIO y HORA FINAL en 7 y 8 */
function leerAcopios(rows){
  const hi=rows.findIndex(r=>/^transportista/.test(norm(r[5]))&&/^hora inicio/.test(norm(r[6])));
  if(hi<0)return [];
  return rows.slice(hi+1).filter(r=>String(r[5]||'').trim()&&/\d/.test(r[6]||'')).map(r=>({nombre:String(r[5]).trim(),tarea:'Acopio '+String(r[2]||'').split('|')[0].trim().slice(0,40),est:String(r[7]||'').trim()?'real':'proc',ini:parseHM(r[6]),fin:parseHM(r[7])}));
}
async function cargarTE(){
  const d=new Date(ahora()),dd=d.getUTCDate(),mm=d.getUTCMonth()+1;
  const tabs=[...new Set([`${pad(dd)}/${pad(mm)}`,`${dd}/${mm}`,`${dd}/${pad(mm)}`,`${pad(dd)}/${mm}`])];
  try{
    let L=null,tab='';
    for(const t of tabs){L=leerTE(await hoja(CFG.TE,t));if(L){tab=t;break}}  // si la pestaña no existe, Google devuelve la primera: se descarta
    if(!L)throw new Error('no hay pestaña «'+tabs[0]+'»');
    try{L=L.concat(leerAcopios(await hoja(CFG.TE,'Acopios '+tab)))}catch(e){}
    DATA.te=L.map(x=>({...x,tok:toks(x.nombre)}));DATA.teTab=tab;DATA.teAt=Date.now();DATA.teErr='';
  }catch(e){DATA.te=null;DATA.teErr='Tareas especiales: '+e.message}
  pintar();
}

/* ---------- Empresas de Zona Limpia: planilla de asistencia (se completa al día siguiente) ----------
   Pestaña "Asistencia": FECHA | TURNO | EMPRESA | ASISTENCIA | MATRÍCULA | HORA INICIO | HORA FIN | MOTIVO …
   Con las últimas 4 semanas se arma la lista de unidades que salen hoy (las que salieron algún día como hoy) y su horario típico. */
/* Nombre de la unidad, igual en la planilla y en las bases: "DG 1 ZONA LIMPIA - MATUTINO" y "DG1-050" -> DG1 */
function unidad(n){
  const x=norm(n).toUpperCase().replace(/\s*-\s*\d+\s*$/,'').trim();let m;
  if((m=/^DG\s*(\d+)/.exec(x)))return 'DG'+m[1];
  if((m=/^DINALI\s*(\d+)/.exec(x)))return 'DINALI'+m[1];
  if((m=/^ROSADO\s*(\d+)/.exec(x)))return 'ROSADO'+m[1];
  if((m=/^(?:SA|SALIR ADELANTE)\s*-?\s*B\s*(\d+)/.exec(x)))return 'SAB'+m[1];
  if((m=/^(?:VCV|VOS CON VOZ)\s*-?\s*B\s*(\d+)/.exec(x)))return 'VCVB'+m[1];
  if(/^(CAP|COM\s*-\s*FIDEICOMISO)\b/.test(x))return 'CAP';
  return '';
}
const EMPRESA={DG:'DG',DINALI:'DINALI',ROSADO:'ROSADO',SAB:'SALIR ADELANTE',VCVB:'VOS CON VOZ',CAP:'FIDEICOMISO'};
const titulo=s=>s.toLowerCase().replace(/(^|\s)(\p{L})/gu,(a,b,c)=>b+c.toUpperCase());
function nombreUnidad(u,n){
  const k=/^[A-Z]+/.exec(u)[0],num=u.slice(k.length);
  if(k==='DINALI'){const m=/^DINALI\s*\d+\s*(.*?)\s*(?:-\s*(?:MATUTINO|VESPERTINO|NOCTURNO))?\s*$/i.exec(String(n).trim());return 'DINALI '+num+(m&&m[1]?' · '+titulo(m[1]):'')}
  return {DG:'DG '+num,ROSADO:'Rosado '+num,SAB:'Salir Adelante B'+num,VCVB:'Vos con Voz B'+num,CAP:'CAP (fideicomiso)'}[k]||u;
}
const TURNO_DEF={Matutino:[360,660],Vespertino:[780,1080],Nocturno:[1260,1590]};
function leerAsis(rows){
  const W=ahora(),hoy=diaDe(W),lim=hoy-CFG.ASIS_DIAS*DIA,dow=new Date(W).getUTCDay();
  const g=new Map();
  for(const r of rows){
    const dm=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(r[0]||'').trim());if(!dm)continue;
    const d=Date.UTC(+dm[3],+dm[2]-1,+dm[1]);if(d<lim||d>=hoy)continue;
    const emp=String(r[2]||'').trim(),u=unidad(emp);if(!u)continue;
    const tn=norm(r[1]||emp),turno=/noct/.test(tn)?'Nocturno':/vesp/.test(tn)?'Vespertino':/mat/.test(tn)?'Matutino':'';if(!turno)continue;
    const id=u+'|'+turno;
    let o=g.get(id);if(!o){o={u,turno,emp,last:0,a:[],b:[],dias:new Set(),dows:new Map()};g.set(id,o)}
    if(d>=o.last){o.last=d;o.emp=emp}
    if(!/^(asisti|sale tarde|no culmina)/.test(norm(r[3])))continue;
    o.dias.add(d);const wd=new Date(d).getUTCDay();o.dows.set(wd,(o.dows.get(wd)||0)+1);
    let a=parseHM(r[5]),b=parseHM(r[6]);
    if(a!=null&&b!=null){if(turno==='Nocturno'&&a<720)a+=1440;if(b<a)b+=1440;o.a.push(a);o.b.push(b)}
  }
  const med=v=>{v=[...v].sort((x,y)=>x-y);return v[Math.floor(v.length/2)]};
  const out=[];
  for(const o of g.values()){
    if(o.u==='CAP')continue;   // CAP (fideicomiso) no se le asigna: solo reportan al terminar, así que no se controla
    if(o.dias.size<3||!o.dows.get(dow))continue;   // sale poco, o nunca un día como hoy (p. ej. fines de semana)
    const [s,e]=o.a.length>=3?[med(o.a),med(o.b)]:TURNO_DEF[o.turno];
    const k=/^[A-Z]+/.exec(o.u)[0],num=o.u.slice(k.length);
    out.push({id:'z:'+o.u+'|'+o.turno,zl:true,u:o.u,nombre:nombreUnidad(o.u,o.emp),corto:({SAB:'SA B',VCVB:'VCV B',DG:'DG ',DINALI:'DINALI ',ROSADO:'Rosado '}[k]||'')+num||'CAP',grupo:EMPRESA[/^[A-Z]+/.exec(o.u)[0]]||'',turno:o.turno,s,e,
      plan:`horario típico de las últimas ${CFG.ASIS_DIAS/7} semanas (${o.a.length} días con horas)`,dias:o.dias.size});
  }
  return out.sort((x,y)=>x.u.localeCompare(y.u,'es',{numeric:true}));
}
async function cargarAsis(){
  try{
    const z=leerAsis(await hoja(CFG.ASIS,CFG.ASIS_PESTANA));
    if(!z.length)throw new Error('no se encontraron unidades (¿cambió la pestaña «'+CFG.ASIS_PESTANA+'»?)');
    DATA.zl=z;DATA.zlAt=Date.now();DATA.zlErr='';MATCH.clear();
  }catch(e){DATA.zlErr='Asistencia empresas: '+e.message}
  pintar();
}

/* ============================== LECTURA: BASES DE SUPABASE ============================== */
async function bajar(arch,ver){
  const b=new Uint8Array(await pedir(CFG.SB+arch+'?v='+encodeURIComponent(ver||Date.now()),r=>r.arrayBuffer()));
  const t=(b[0]===0x1f&&b[1]===0x8b)?await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(b);
  return JSON.parse(t);
}
let revisando=false;
/* Bases: un solo archivo chico (~60 KB) que arma n8n cada 5 min pidiéndole al Grafana solo lo que usa el mapa.
   Antes se bajaban las 4 bases enteras de Supabase (~16,7 MB en cada actualización). */
async function cargarBases(){
  if(revisando)return;revisando=true;
  try{
    const d=await bajar(CFG.CO,Date.now());
    if(!d||!d.bases)throw new Error('formato desconocido en '+CFG.CO);
    const at=wall(Date.parse(d.generado)),hoy=diaDe(ahora()),corte=hoy-6*3600000;   // cierres desde las 18 h de ayer
    for(const k of KEYS){
      const b=d.bases[k];
      if(!b||b.err){DATA['err_'+k]=b?b.err:'no viene en el archivo';continue}   // se queda con lo último que tenía
      const done=b.done.filter(x=>x.f>=corte);let max=0;for(const x of done)if(x.f>max)max=x.f;
      DATA.bases[k]={pend:b.pend,done,max,filas:b.pend.length+b.done.length,at:Math.max(at,max),subida:at,hoy};
      delete DATA['err_'+k];
    }
    DATA.generado=at;DATA.basesErr='';DATA.basesAt=Date.now();
  }catch(e){DATA.basesErr='Supabase: '+e.message}
  finally{revisando=false;pintar()}
}

/* ============================== MODELO ============================== */
const MATCH=new Map(); // nombre en la base -> [ids de la planilla]
function emparejar(t){
  if(MATCH.has(t))return MATCH.get(t);
  // primero las unidades de las empresas de ZL (DG1, DINALI 4, ROSADO 2…): una por turno
  const u=unidad(t);let ids=u?(DATA.zl||[]).filter(z=>z.u===u).map(z=>z.id):[];
  if(!ids.length){
    const T=toks(t);let best=0;
    for(const p of DATA.plan||[]){const s=parecido(T,p.tok);if(s>best){best=s;ids=[p.id]}else if(s&&s===best)ids.push(p.id)}
  }
  MATCH.set(t,ids);return ids;
}
const TEM=new Map();
function teDe(p){
  if(!DATA.te)return null;
  const key=p.id+'|'+DATA.teAt;if(TEM.has(key))return TEM.get(key);
  let r=null;
  for(const x of DATA.te){
    if(!parecido(p.tok,x.tok))continue;
    if(!r)r={proc:null,pend:0,real:0,lastFin:null,firstIni:null,items:[]};
    r.items.push(x);
    if(x.est==='proc'&&!r.proc)r.proc=x;
    else if(x.est==='acep'||x.est==='plan')r.pend++;
    else if(x.est==='real'){r.real++;if(x.fin!=null&&(r.lastFin==null||x.fin>r.lastFin))r.lastFin=x.fin}
    if(x.ini!=null&&(r.firstIni==null||x.ini<r.firstIni))r.firstIni=x.ini;
  }
  TEM.set(key,r);return r;
}
function tipoDe(p){
  if(p.zl)return /^DINALI/.test(p.u)?['🛵','Motocarro de Zona Limpia']:['🚛','Camión de Zona Limpia'];
  if(p.per.bol)return ['🚛','Camión de bolsones'];
  if(p.per.age||/voluminoso/i.test(p.nombre))return ['🚛','Agenda / voluminosos'];
  return ['🛵','Motocarro'];
}
/* Turno de hoy en ms (reloj de Montevideo). Un nocturno que cruza la medianoche, de madrugada, es el que empezó ayer. */
function ventana(p,W){
  const hoy=diaDe(W),m=minDe(W);
  const base=p.e>1440&&m<p.e-1440+CFG.MARGEN?hoy-DIA:hoy;
  p.S=base+p.s*60000;p.E=base+p.e*60000;
}
/* Si un mismo nombre de la base corresponde a varios turnos (DG1 hace matutino, vespertino y nocturno), cada tarea va al turno más cercano a su hora */
const distV=(p,t)=>t<p.S?p.S-t:t>p.E?t-p.E:0;
function elegir(cands,t){let b=cands[0],bd=Infinity;for(const p of cands){const d=distV(p,t);if(d<bd){bd=d;b=p}}return b}
function armar(){
  const W=ahora(),hoy=diaDe(W),m=minDe(W);
  const nuevo=p=>({...p,pend:[],done:[],per:{},base:new Set()});
  const P=(DATA.plan||[]).map(nuevo).concat((DATA.zl||[]).map(nuevo));
  for(const p of P)ventana(p,W);
  const byId=new Map(P.map(p=>[p.id,p]));
  const fuera=new Map();
  const reg=(p,k,it,tipo)=>{p[tipo].push(it);p.base.add(it.t);(p.per[k]||(p.per[k]={pend:0,done:0,last:0}))[tipo]++;if(tipo==='done'&&it.f>p.per[k].last)p.per[k].last=it.f};
  for(const k of KEYS){
    const b=DATA.bases[k];if(!b)continue;
    const add=(it,tipo)=>{
      if(esPseudo(it.t)||unidad(it.t)==='CAP')return;   // CAP no se controla
      const cands=emparejar(it.t).map(i=>byId.get(i)).filter(Boolean);
      if(!cands.length){
        if(tipo==='done'&&it.f<hoy)return;   // de ayer a la noche: solo cuenta para un turno nocturno
        let f=fuera.get(it.t);
        if(!f){f={id:'f:'+it.t,nombre:limpio(it.t),fuera:true,pend:[],done:[],per:{},base:new Set()};fuera.set(it.t,f)}
        reg(f,k,it,tipo);return;
      }
      const t=tipo==='done'?it.f:W,p=elegir(cands,t);
      if(tipo==='done'&&distV(p,t)>60*60000)return;   // cierre fuera de su turno (p. ej. de ayer)
      reg(p,k,it,tipo);
    };
    for(const it of b.pend)add(it,'pend');
    for(const it of b.done)add(it,'done');
  }
  for(const p of P)juzgar(p,W,hoy,m);
  for(const f of fuera.values())posicion(f);
  // Sin nada con coordenadas en las bases (bloques, barrios, recién salidos): al centro de su municipio, repartidos en un círculo
  const porMun={};
  for(const p of P){
    if(p.pos)continue;
    const mun=munDe(p);if(!mun)continue;
    (porMun[mun]||(porMun[mun]=[])).push(p);
  }
  for(const mun in porMun){
    const c=centroMun(mun),arr=porMun[mun];
    arr.forEach((p,i)=>{const a=i/arr.length*2*Math.PI,r=arr.length>1?.007:0;p.pos=[c[0]+r*Math.sin(a),c[1]+r*1.2*Math.cos(a)];p.approx='mun';p.mun=mun});
  }
  return {P,fuera:[...fuera.values()],W,m};
}
const munKey=s=>{const x=String(s||'').toUpperCase().trim();if(MUNI_GEO&&MUNI_GEO[x])return x;const m=/^(CH|[A-G])\b/.exec(x);return m&&MUNI_GEO&&MUNI_GEO[m[1]]?m[1]:''};
function munDe(p){
  // Primero dónde anda según Tareas especiales: la que está haciendo, si no la última que terminó, si no la próxima.
  if(p.te){
    const it=p.te.items,km=x=>x&&munKey(x.mun);
    const proc=it.find(x=>x.est==='proc'&&km(x));if(proc)return km(proc);
    const real=it.filter(x=>x.est==='real'&&km(x)).sort((a,b)=>(b.fin??b.ini??0)-(a.fin??a.ini??0))[0];if(real)return km(real);
    const sig=it.find(x=>km(x));if(sig)return km(sig);
  }
  const g=munKey(p.grupo);if(g)return g;
  for(const x of p.pend)if(munKey(x.mun))return munKey(x.mun);
  return '';
}
const CMUN={};
function centroMun(id){
  if(CMUN[id])return CMUN[id];
  let best=null;for(const pol of MUNI_GEO[id])if(!best||pol[0].length>best.length)best=pol[0];
  let la=0,ln=0;for(const [x,y] of best){la+=y;ln+=x}
  return CMUN[id]=[la/best.length,ln/best.length];
}
function posicion(p){
  let last=null;for(const d of p.done)if(d.la&&(!last||d.f>last.f))last=d;
  if(last){p.pos=[last.la,last.ln];p.lastF=last.f;p.approx=false;return}
  let n=0,la=0,ln=0;for(const x of p.pend)if(x.la){la+=x.la;ln+=x.ln;n++}
  p.pos=n?[la/n,ln/n]:null;p.approx=!!n;
}
/* Agenda/voluminosos y bolsones: no tienen "poca tarea" (o tienen tarea o no) */
const esAgBol=p=>!p.zl&&(p.per.bol||p.per.age||/voluminoso/i.test(p.nombre));
function juzgar(p,W,hoy,m){
  posicion(p);
  const te=p.te=p.zl?null:teDe(p);
  // hora de "ahora" para este recurso: la de la base más atrasada en la que tiene tareas (no se le cuenta como parado el atraso de la base)
  let ref=W;for(const k in p.per){const b=DATA.bases[k];if(b)ref=Math.min(ref,b.at)}
  p.ref=ref;
  const lastDone=p.done.reduce((x,d)=>Math.max(x,d.f),0);
  const cand=[];
  if(lastDone)cand.push((ref-lastDone)/60000);
  if(te){if(te.proc&&te.proc.ini!=null)cand.push(m-te.proc.ini);if(te.lastFin!=null)cand.push(m-te.lastFin)}
  if(p.entra!=null&&p.entra<=m)cand.push(m-p.entra);
  p.idle=cand.length?Math.max(0,Math.min(...cand)):null;
  p.lastDone=lastDone;
  const nW=p.done.filter(d=>d.f>=ref-CFG.RITMO*60000).length;
  p.rate=nW>=3?nW/(CFG.RITMO/60):0;
  const hizoAlgo=p.done.length>0||!!(te&&(te.proc||te.real));
  const salio=p.asis||hizoAlgo;
  p.salio=salio;
  const n=p.pend.length,min=x=>x/60000;
  const gracia=p.zl?CFG.GRACIA_ZL:CFG.GRACIA;   // el horario de las empresas es estimado: se espera un poco más
  const cerrando=p.zl&&p.idle!=null&&p.idle<=CFG.PARADO;
  let st;
  // La planilla manda: si dice "No asistió" no salió, aunque en Tareas especiales figure algo (se avisa en la ficha)
  p.contradice=p.noAsis&&hizoAlgo;
  if(p.noAsis)st='no_salio';
  else if(p.retiro!=null||p.noCulmina)st='retirado';
  else if(W>p.E&&!cerrando)st='termino';   // una empresa que sigue cerrando después de su hora típica sigue en calle
  else if(!salio)st=W>=p.S+gracia*60000?'sin_marca':'por_entrar';
  else if(te&&te.proc)st='especial';
  else if(n===0){
    if(te&&te.pend)st=te.lastFin!=null&&m-te.lastFin>CFG.PARADO?'parado':'te_espera';   // tiene tareas especiales por hacer: si hace rato que no arranca ninguna, está parado
    else if(cerrando)st='ok';   // las empresas de ZL cierran contenedores sin tenerlos asignados: si vienen cerrando, trabajan
    else st=min(p.E-W)<=CFG.CIERRE?'cierre':'sin_tarea';
  }
  else if(p.idle!=null&&p.idle>CFG.PARADO&&min(W-p.S)>CFG.PARADO)st='parado';
  else if(n<=CFG.POCAS&&!cerrando&&!esAgBol(p))st='pocas';   // agenda y bolsones: con 1 o más ya están con tarea
  else st='ok';
  p.st=st;
}
/* Qué recursos se miran: los que deberían estar trabajando ahora (dentro de su horario) y los que siguen en calle pasada su hora */
function enVista(p,W){
  return (W>=p.S&&W<=p.E)||TRABAJANDO.includes(p.st);
}
function detalle(p){
  const S=p.st,est=p.zl?'~':'';
  if(S==='no_salio')return (p.contradice?'⚠ pero figura con tareas hoy · ':'')+(p.obs||'—');
  if(S==='retirado')return (p.retiro!=null?'a las '+hm(p.retiro):'')+(p.obs?' · '+p.obs:'');
  if(S==='termino')return 'turno '+est+hm(p.s)+'–'+est+hm(p.e);
  if(S==='por_entrar')return 'entra '+est+hm(p.s);
  if(S==='sin_marca')return p.zl?'suele salir '+hm(p.s)+' · sin cierres todavía':'debía entrar '+hm(p.s)+' · nada en la planilla';
  if(S==='especial')return p.te.proc.tarea+(p.te.proc.ini!=null?' · desde '+hm(p.te.proc.ini):'');
  if(S==='te_espera')return (p.te.items.find(x=>x.est==='acep'||x.est==='plan')||{}).tarea||'';
  if(S==='sin_tarea')return p.idle!=null?'sin tareas · últ. actividad hace '+dur(p.idle):'sin tareas asignadas';
  if(S==='parado')return p.pend.length?'hace '+dur(p.idle)+' sin cerrar · '+p.pend.length+' asignadas':'hace '+dur(p.idle)+' sin actividad · '+p.te.pend+' tarea'+(p.te.pend===1?'':'s')+' especial'+(p.te.pend===1?'':'es')+' por hacer';
  if(S==='cierre')return 'termina '+est+hm(p.e);
  return (p.lastDone?'último cierre '+hhmm(p.lastDone):'sin cierres aún')+(p.rate?' · '+Math.round(p.rate)+'/h':'');
}
const corto=n=>{const w=String(n).split(/\s+/);return w.length>2&&!/\by\b|&/i.test(n)?w[0]+' '+w[w.length-1]:n};


/* Grupo del monitoreo (los 4 colores del mapa): con tarea, poca tarea, parado, sin tarea; el resto, apagado */
function grupoK(p) {
  const s = p.st;
  if (s === 'no_salio' || s === 'retirado') return 'inasis';
  if (s === 'sin_marca' || s === 'por_entrar') return 'sinconf';
  if (['ok', 'especial', 'te_espera', 'cierre'].includes(s)) return 'con';
  return s;
}

window.Monitoreo = {
  CFG, ST, DATA,
  alCambiar(f) { avisar = f; },
  // Lee todo una vez (las planillas de Google y el archivo de n8n)
  cargar() { return Promise.allSettled([cargarPlan(), cargarTE(), cargarAsis(), cargarBases()]); },
  cargarPlan, cargarTE, cargarAsis, cargarBases,
  armar, enVista, tipoDe, detalle, munDe, grupoK, ahora, hhmm, dur
};
})();
