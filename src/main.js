/* =====================================================================
   PAINEL DE CONCRETAGEM — Vite + SQLite Local
   ===================================================================== */
const TRECHOS = [
  {cod:'CO1', bloco:'A', etapa:1, vol:29.54, cor:'#c89b6a'},
  {cod:'CO2', bloco:'A', etapa:2, vol:31.70, cor:'#3fd0e6'},
  {cod:'CO3', bloco:'A', etapa:3, vol:37.69, cor:'#ef5f5f'},
  {cod:'CO4', bloco:'B', etapa:1, vol:27.85, cor:'#6b7dff'},
  {cod:'CO5', bloco:'B', etapa:2, vol:31.70, cor:'#5fd8f0'},
  {cod:'CO6', bloco:'B', etapa:3, vol:39.27, cor:'#5fd67f'},
  {cod:'CO7', bloco:'C', etapa:1, vol:26.69, cor:'#d98cf5'},
  {cod:'CO8', bloco:'C', etapa:2, vol:24.96, cor:'#f0846f'}
];
const ORD = {1:'1ª',2:'2ª',3:'3ª'};
TRECHOS.forEach(t=>{ t.nome = 'Bloco '+t.bloco+' — '+ORD[t.etapa]+' etapa'; });

const BLOCOS = {
  A:{nome:'Bloco A', desc:'1ª, 2ª e 3ª etapa (ala esquerda)'},
  B:{nome:'Bloco B', desc:'1ª, 2ª e 3ª etapa (ala direita)'},
  C:{nome:'Bloco C', desc:'1ª e 2ª etapa (trecho central)'}
};
const TETOS = [
  {n:1,nome:'1º Teto',uso:'Térreo',cota:'+3,45'},
  {n:2,nome:'2º Teto',uso:'1º Tipo',cota:'+6,45'},
  {n:3,nome:'3º Teto',uso:'2º Tipo',cota:'+9,45'},
  {n:4,nome:'4º Teto',uso:'3º Tipo',cota:'+12,45'},
  {n:5,nome:'5º Teto',uso:'4º Tipo',cota:'+15,45'},
  {n:6,nome:'6º Teto',uso:'5º Tipo/Cobertura',cota:'+18,45'},
  {n:7,nome:'7º Teto',uso:'6º Tipo/Coberta',cota:'+21,40'}
];
const R = { desformaParedeH:8, facesLateraisD:3, reescoraD:14, liberacaoD:28, escora100Ate:14, escora50Ate:28 };
const IDADE_MIN_SUBIR = 7;

const GEO = {
  CO1:'M60,105 L300,105 L300,150 L330,150 L330,215 L60,215 Z',
  CO2:'M60,215 L330,215 L330,330 L60,330 Z',
  CO3:'M60,330 L330,330 L330,545 L98,545 L98,480 L60,480 Z',
  CO4:'M670,105 L940,105 L940,215 L670,215 Z',
  CO5:'M670,215 L940,215 L940,330 L670,330 Z',
  CO6:'M670,330 L940,330 L940,545 L670,545 Z',
  CO7:'M330,115 L500,115 L500,215 L330,215 Z',
  CO8:'M500,115 L670,115 L670,215 L500,215 Z'
};
const CENTRO = {CO1:[195,160],CO2:[195,272],CO3:[195,438],CO4:[805,160],CO5:[805,272],CO6:[805,438],CO7:[415,165],CO8:[585,165]};

/* ===================== estado + sincronismo ===================== */
let ST = {pours:{}, planta:null, ajustes:{}};
let revLocal = 0, tetoAtivo = 1, alvo = null, modoAjuste = false, editando = false;

const $ = id => document.getElementById(id);
const k = (t,c) => 'T'+t+'|'+c;
const T = cod => TRECHOS.find(x=>x.cod===cod);
const VOL_TETO = TRECHOS.reduce((s,t)=>s+t.vol,0);
const VOL_TOTAL = VOL_TETO * TETOS.length;

function marcarSync(estado, texto){
  const el = $('sync');
  el.className = 'sync' + (estado ? ' '+estado : '');
  $('syncTxt').textContent = texto;
}

let timerSalvar = null;
function agendarSalvar(){
  marcarSync('salvando','salvando…');
  clearTimeout(timerSalvar);
  timerSalvar = setTimeout(salvar, 500);
}
async function salvar(){
  try{
    const r = await fetch('/api/estado', {method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({pours:ST.pours, planta:ST.planta, ajustes:ST.ajustes})});
    const j = await r.json();
    revLocal = j.rev;
    marcarSync('', 'salvo às ' + new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
  }catch(e){
    marcarSync('erro','sem conexão com o servidor — os dados não foram gravados');
  }
}
async function carregar(){
  const r = await fetch('/api/estado');
  const j = await r.json();
  ST = {pours:j.pours||{}, planta:j.planta||null, ajustes:j.ajustes||{}};
  revLocal = j.rev || 0;
  marcarSync('', j.atualizado ? 'sincronizado' : 'banco vazio — lance a primeira concretagem');
}
setInterval(async ()=>{
  if (editando) return;
  try{
    const j = await (await fetch('/api/rev')).json();
    if (j.rev > revLocal){ await carregar(); aplicarCalib(); refresh(); }
  }catch(e){ marcarSync('erro','sem conexão com o servidor'); }
}, 4000);

/* ===================== datas e regras ===================== */
function hojeRef(){ const v=$('hoje').value; return v ? new Date(v+'T23:59:59') : new Date(); }
function baseDT(p){ return p&&p.data ? new Date(p.data+'T'+(p.hora||'07:00')) : null; }
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const addH=(d,n)=>{const x=new Date(d);x.setHours(x.getHours()+n);return x};
const fmt=d=>d?d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
const fmtDH=d=>d?d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+
  d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';
function idade(p,ref){const b=baseDT(p); return b?(ref-b)/86400000:null}
function marcos(p){const b=baseDT(p); if(!b)return null;
  return {parede:addH(b,R.desformaParedeH), lateral:addD(b,R.facesLateraisD),
          reescora:addD(b,R.reescoraD), liberacao:addD(b,R.liberacaoD)}}

const SITS=[
 {id:'pend',nome:'Não concretado',hex:'#4a5674',desc:'Sem lançamento'},
 {id:'prog',nome:'Programada',hex:'#8b7cf6',desc:'Data futura'},
 {id:'cura',nome:'Cura inicial',hex:'#ff7a45',desc:'0 a 3 dias · fôrmas laterais'},
 {id:'esc', nome:'100% escorada',hex:'#ffb020',desc:'3 a 14 dias'},
 {id:'ree', nome:'50% reescorada',hex:'#38b6ff',desc:'14 a 28 dias · pontaletes'},
 {id:'liv', nome:'Liberada',hex:'#3ddc84',desc:'Acima de 28 dias · sem escoras'}];

function sit(p,ref){
  if(!p||!p.data) return SITS[0];
  const i = idade(p,ref);
  if(i<0) return SITS[1];
  if(i<R.facesLateraisD) return SITS[2];
  if(i<R.escora100Ate) return SITS[3];
  if(i<R.escora50Ate) return SITS[4];
  return SITS[5];
}

/* ===================== planta de fundo ===================== */
function calib(){ return Object.assign({op:45,esc:100,x:0,y:0,rot:0}, ST.ajustes.__planta||{}); }
function aplicarCalib(){
  const c = calib();
  cOp.value=c.op; cEsc.value=c.esc; cX.value=c.x; cY.value=c.y; cRot.value=c.rot;
}
function onCalib(){
  ST.ajustes.__planta = {op:+cOp.value, esc:+cEsc.value, x:+cX.value, y:+cY.value, rot:+cRot.value};
  drawPlanta(); agendarSalvar();
}
['cOp','cEsc','cX','cY','cRot'].forEach(id=>$(id).addEventListener('input',onCalib));

$('btnPlanta').onclick = ()=>{ $('calib').classList.toggle('on'); };
$('pick').onclick = ()=> fPlanta.click();
fPlanta.onchange = e => { if(e.target.files[0]) enviarPlanta(e.target.files[0]); };
const dz = $('dz');
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('hot')}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('hot')}));
dz.addEventListener('drop', e=>{ const f=e.dataTransfer.files[0]; if(f) enviarPlanta(f); });

async function enviarPlanta(file){
  const ext = (file.name.split('.').pop()||'png').toLowerCase();
  marcarSync('salvando','enviando a planta…');
  try{
    const r = await fetch('/api/planta?ext='+encodeURIComponent(ext), {method:'POST',
      headers:{'Content-Type':file.type||'application/octet-stream'}, body:file});
    const j = await r.json();
    if(!j.ok) throw new Error('falhou');
    await carregar(); aplicarCalib(); drawPlanta();
    marcarSync('','planta salva no banco');
  }catch(e){ marcarSync('erro','não foi possível enviar a planta'); }
}
$('cDel').onclick = async ()=>{
  if(!confirm('Remover a planta de fundo?')) return;
  await fetch('/api/planta',{method:'DELETE'});
  await carregar(); drawPlanta();
};

/* ===================== desenho da planta ===================== */
function ajusteDe(cod){ return Object.assign({dx:0,dy:0,s:1}, ST.ajustes[cod]||{}); }

function drawPlanta(){
  const ref = hojeRef(), sv = $('svgPlanta'), c = calib();
  let h = '';
  h += '<defs><pattern id="hx" width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">'+
       '<line x1="0" y1="0" x2="0" y2="9" stroke="rgba(140,170,255,.07)" stroke-width="3"/></pattern></defs>';
  h += '<rect x="0" y="0" width="1000" height="660" fill="url(#hx)"/>';

  // SVG da planta baixa embutido como background
  h += '<g opacity="0.35">' + svgPlantaBaixa() + '</g>';

  if (ST.planta && ST.planta.arquivo){
    const esc = c.esc/100;
    h += '<g transform="translate(500,330) rotate('+c.rot+') scale('+esc+') translate(-500,-330) translate('+c.x+','+c.y+')">'+
         '<image href="/planta/'+ST.planta.arquivo+'" x="0" y="0" width="1000" height="660" '+
         'preserveAspectRatio="xMidYMid meet" opacity="'+(c.op/100)+'"/></g>';
  }

  TRECHOS.forEach(t=>{
    const p = ST.pours[k(tetoAtivo,t.cod)], s = sit(p,ref), ce = CENTRO[t.cod], a = ajusteDe(t.cod);
    const on = s.id !== 'pend';
    const tr = 'translate('+a.dx+','+a.dy+') translate('+ce[0]+','+ce[1]+') scale('+a.s+') translate('+(-ce[0])+','+(-ce[1])+')';
    h += '<g class="zone" data-t="'+t.cod+'" transform="'+tr+'">'+
      '<path class="zbody" d="'+GEO[t.cod]+'" fill="'+(on?s.hex:'#1b2540')+'" fill-opacity="'+(on?.34:.55)+'" '+
        'stroke="'+(on?s.hex:t.cor)+'" stroke-width="'+(on?3:1.8)+'" stroke-opacity="'+(on?1:.7)+'"/>'+
      '<text class="zcod" x="'+ce[0]+'" y="'+(ce[1]-40)+'" text-anchor="middle">'+t.cod+'</text>'+
      '<text class="zbloco" x="'+ce[0]+'" y="'+(ce[1]-18)+'" text-anchor="middle">BLOCO '+t.bloco+'</text>'+
      '<text class="zetapa" x="'+ce[0]+'" y="'+(ce[1]+2)+'" text-anchor="middle" fill="'+t.cor+'">'+
        ORD[t.etapa].toUpperCase()+' ETAPA</text>'+
      '<text class="zvol" x="'+ce[0]+'" y="'+(ce[1]+20)+'" text-anchor="middle">'+
        t.vol.toFixed(2).replace('.',',')+' m³</text>';
    if(on){
      const i = idade(p,ref);
      h += '<text class="zdate" x="'+ce[0]+'" y="'+(ce[1]+40)+'" text-anchor="middle">'+fmt(baseDT(p))+'</text>'+
           '<text class="zage" x="'+ce[0]+'" y="'+(ce[1]+57)+'" text-anchor="middle" fill="'+s.hex+'">'+
           (i<0?'programada':Math.floor(i)+' dias · '+s.nome)+'</text>';
    }else{
      h += '<text class="zage" x="'+ce[0]+'" y="'+(ce[1]+40)+'" text-anchor="middle" fill="#6a7b9e">clique para lançar</text>';
    }
    h += '</g>';
  });

  h += '<line x1="330" y1="115" x2="330" y2="215" stroke="#ffb020" stroke-width="2" stroke-dasharray="6 5" opacity=".8"/>';
  h += '<text x="336" y="103" font-family="var(--mono)" font-size="11" fill="#ffb020">junta 2cm</text>';
  h += '<text x="60" y="600" font-size="15" fill="#93a4c9" font-weight="600">'+
       TETOS[tetoAtivo-1].nome+' — '+TETOS[tetoAtivo-1].uso+' ('+TETOS[tetoAtivo-1].cota+' m)</text>';
  h += '<text x="60" y="622" font-size="12" fill="#6a7b9e">Referência: '+fmt(hojeRef())+'</text>';

  sv.innerHTML = h;
  sv.querySelectorAll('.zone').forEach(g=>{
    g.addEventListener('click', e=>{ if(!modoAjuste && !g.dataset.arrastou) abrir(g.dataset.t); delete g.dataset.arrastou; });
    g.addEventListener('pointerdown', iniciarArrasto);
    g.addEventListener('wheel', e=>{
      if(!modoAjuste) return;
      e.preventDefault();
      const a = ajusteDe(g.dataset.t);
      a.s = Math.max(.3, Math.min(3, a.s + (e.deltaY<0 ? .02 : -.02)));
      ST.ajustes[g.dataset.t] = a; drawPlanta(); agendarSalvar();
    }, {passive:false});
  });

  $('legend').innerHTML = SITS.map(s=>
    '<div class="lg"><span class="dot" style="background:'+s.hex+'"></span>'+
    '<span><b>'+s.nome+'</b><small>'+s.desc+'</small></span></div>').join('');
}

/* SVG da planta baixa baseada no PDF */
function svgPlantaBaixa(){
  let s = '';
  // Bloco A - esquerda
  s += '<rect x="65" y="110" width="230" height="100" fill="none" stroke="#4a5a7a" stroke-width="1" stroke-dasharray="4 3"/>';
  s += '<rect x="65" y="220" width="260" height="105" fill="none" stroke="#4a5a7a" stroke-width="1" stroke-dasharray="4 3"/>';
  s += '<rect x="65" y="335" width="260" height="205" fill="none" stroke="#4a5a7a" stroke-width="1" stroke-dasharray="4 3"/>';

  // Bloco B - direita
  s += '<rect x="675" y="110" width="260" height="100" fill="none" stroke="#4a5a7a" stroke-width="1" stroke-dasharray="4 3"/>';
  s += '<rect x="675" y="220" width="260" height="105" fill="none" stroke="#4a5a7a" stroke-width="1" stroke-dasharray="4 3"/>';
  s += '<rect x="675" y="335" width="260" height="205" fill="none" stroke="#4a5a7a" stroke-width="1" stroke-dasharray="4 3"/>';

  // Bloco C - central
  s += '<rect x="335" y="120" width="160" height="90" fill="none" stroke="#4a5a7a" stroke-width="1" stroke-dasharray="4 3"/>';
  s += '<rect x="505" y="120" width="160" height="90" fill="none" stroke="#4a5a7a" stroke-width="1" stroke-dasharray="4 3"/>';

  // Elementos PAR do PDF
  const parsA = [
    [75,120,'PAR1'],[120,120,'PAR2'],[165,120,'PAR3'],[210,120,'PAR4'],
    [75,180,'PAR5'],[120,180,'PAR6'],[165,180,'PAR7'],[210,180,'PAR8'],
    [75,230,'PAR9'],[120,230,'PAR9A'],[165,230,'PAR10'],[210,230,'PAR10'],
    [75,280,'PAR10'],[120,280,'PAR11'],[165,280,'PAR12'],[210,280,'PAR13'],
    [75,350,'PAR14'],[120,350,'PAR14'],[165,350,'PAR15'],[210,350,'PAR16'],
    [75,400,'PAR17'],[120,400,'PAR17'],[165,400,'PAR18'],[210,400,'PAR19'],
    [75,450,'PAR20'],[120,450,'PAR20'],[165,450,'PAR21'],[210,450,'PAR21A'],
    [75,500,'PAR22'],[120,500,'PAR22'],[165,500,'PAR23'],[210,500,'PAR23A'],
    [75,520,'PAR24'],[120,520,'PAR24'],[165,520,'PAR25'],[210,520,'PAR25'],
    [75,530,'PAR25'],[120,530,'PAR25'],[165,530,'PAR25'],[210,530,'PAR26']
  ];
  const parsB = [
    [685,120,'PAR1'],[730,120,'PAR2'],[775,120,'PAR3'],[820,120,'PAR4'],
    [685,180,'PAR5'],[730,180,'PAR6'],[775,180,'PAR7'],[820,180,'PAR8'],
    [685,230,'PAR9'],[730,230,'PAR9A'],[775,230,'PAR10'],[820,230,'PAR10'],
    [685,280,'PAR10'],[730,280,'PAR11'],[775,280,'PAR12'],[820,280,'PAR13'],
    [685,350,'PAR14'],[730,350,'PAR14'],[775,350,'PAR15'],[820,350,'PAR16'],
    [685,400,'PAR17'],[730,400,'PAR17'],[775,400,'PAR18'],[820,400,'PAR19'],
    [685,450,'PAR20'],[730,450,'PAR20'],[775,450,'PAR21'],[820,450,'PAR21A'],
    [685,500,'PAR22'],[730,500,'PAR22'],[775,500,'PAR23'],[820,500,'PAR23A'],
    [685,520,'PAR24'],[730,520,'PAR24'],[775,520,'PAR25'],[820,520,'PAR25'],
    [685,530,'PAR25'],[730,530,'PAR25'],[775,530,'PAR25'],[820,530,'PAR26']
  ];
  const parsC = [
    [345,130,'PARE1'],[390,130,'PARE1'],
    [515,130,'PARE1'],[560,130,'PARE1']
  ];

  [...parsA, ...parsB, ...parsC].forEach(([x,y,t])=>{
    s += '<rect x="'+(x)+'" y="'+(y)+'" width="38" height="14" rx="2" fill="rgba(74,86,116,0.3)" stroke="rgba(140,170,255,0.2)" stroke-width="0.5"/>';
    s += '<text x="'+(x+19)+'" y="'+(y+10)+'" text-anchor="middle" font-family="var(--mono)" font-size="7" fill="rgba(140,170,255,0.5)">'+t+'</text>';
  });

  // SHAFTS
  const shaftsA = [
    [80,140,'SHAFT 01'],[130,140,'SHAFT 02'],[180,140,'SHAFT 03'],[230,140,'SHAFT 04'],
    [80,200,'SHAFT 05'],[130,200,'SHAFT 06'],[180,200,'SHAFT 07'],[230,200,'SHAFT 08'],
    [80,250,'SHAFT 09'],[130,250,'SHAFT 10'],[180,250,'SHAFT 11'],[230,250,'SHAFT 12'],
    [80,300,'SHAFT 13'],[130,300,'SHAFT 14'],[180,300,'SHAFT 15'],[230,300,'SHAFT 16']
  ];
  const shaftsB = [
    [690,140,'SHAFT 17'],[740,140,'SHAFT 18'],[790,140,'SHAFT 19'],[840,140,'SHAFT 20'],
    [690,200,'SHAFT 21'],[740,200,'SHAFT 22'],[790,200,'SHAFT 23'],[840,200,'SHAFT 24'],
    [690,250,'SHAFT 25'],[740,250,'SHAFT 26'],[790,250,'SHAFT 27'],[840,250,'SHAFT 28'],
    [690,300,'SHAFT 29'],[740,300,'SHAFT 30'],[790,300,'SHAFT 31'],[840,300,'SHAFT 32']
  ];
  const shaftsC = [
    [350,150,'SHAFT 33'],[380,150,'SHAFT 34'],[410,150,'SHAFT 35'],
    [520,150,'SHAFT 36'],[550,150,'SHAFT 37'],[580,150,'SHAFT 38'],
    [350,170,'SHAFT 39'],[380,170,'SHAFT 40'],[410,170,'SHAFT 41'],
    [520,170,'SHAFT 42'],[550,170,'SHAFT 43'],[580,170,'SHAFT 44'],
    [350,190,'SHAFT 45'],[380,190,'SHAFT 46'],[410,190,'SHAFT 47'],
    [520,190,'SHAFT 48']
  ];

  [...shaftsA, ...shaftsB, ...shaftsC].forEach(([x,y,t])=>{
    s += '<circle cx="'+(x+15)+'" cy="'+(y+7)+'" r="8" fill="rgba(56,182,255,0.15)" stroke="rgba(56,182,255,0.3)" stroke-width="0.5"/>';
    s += '<text x="'+(x+15)+'" y="'+(y+10)+'" text-anchor="middle" font-family="var(--mono)" font-size="6" fill="rgba(56,182,255,0.5)">'+t.replace('SHAFT ','S')+'</text>';
  });

  // Eixos e cotas
  s += '<line x1="50" y1="80" x2="950" y2="80" stroke="rgba(140,170,255,0.15)" stroke-width="1"/>';
  s += '<text x="500" y="75" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="rgba(140,170,255,0.3)">EIXO A — PLANTA BAIXA</text>';
  s += '<line x1="50" y1="560" x2="950" y2="560" stroke="rgba(140,170,255,0.15)" stroke-width="1"/>';
  s += '<text x="500" y="575" text-anchor="middle" font-family="var(--mono)" font-size="10" fill="rgba(140,170,255,0.3)">EIXO B — PLANTA BAIXA</text>';

  return s;
}

/* arrastar trechos no modo ajuste */
let drag = null;
function pt(e){
  const sv = $('svgPlanta'), m = sv.getScreenCTM().inverse();
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
  return {x:p.x, y:p.y};
}
function iniciarArrasto(e){
  if(!modoAjuste) return;
  const g = e.currentTarget;
  const a = ajusteDe(g.dataset.t);
  drag = {cod:g.dataset.t, o:pt(e), dx0:a.dx, dy0:a.dy, g};
  g.setPointerCapture(e.pointerId);
}
window.addEventListener('pointermove', e=>{
  if(!drag) return;
  const p = pt(e);
  const a = ajusteDe(drag.cod);
  a.dx = drag.dx0 + (p.x - drag.o.x);
  a.dy = drag.dy0 + (p.y - drag.o.y);
  ST.ajustes[drag.cod] = a;
  drag.moveu = true;
  drawPlanta();
});
window.addEventListener('pointerup', ()=>{
  if(!drag) return;
  if(drag.moveu){ agendarSalvar(); const g=document.querySelector('.zone[data-t="'+drag.cod+'"]'); if(g) g.dataset.arrastou='1'; }
  drag = null;
});
$('btnAjuste').onclick = ()=>{
  modoAjuste = !modoAjuste;
  document.body.classList.toggle('ajuste', modoAjuste);
  $('btnAjuste').classList.toggle('on', modoAjuste);
  $('btnAjuste').lastChild.textContent = modoAjuste ? 'Concluir ajuste' : 'Mover trechos';
};

/* ===================== modal de lançamento ===================== */
function abrir(cod){
  alvo = cod; editando = true;
  const t = T(cod), p = ST.pours[k(tetoAtivo,cod)] || {};
  $('mTitle').textContent = t.nome;
  $('mSub').textContent = t.cod+' · '+TETOS[tetoAtivo-1].nome+' · volume de projeto '+
    t.vol.toFixed(2).replace('.',',')+' m³ · cota '+TETOS[tetoAtivo-1].cota+' m';
  fData.value=p.data||''; fHora.value=p.hora||'07:00';
  fVol.value=(p.vol!==undefined&&p.vol!=='')?p.vol:t.vol;
  fCam.value=p.cam||''; fNf.value=p.nf||''; fFck.value=p.fck||'40';
  fSlump.value=p.slump||'22'; fResp.value=p.resp||''; fObs.value=p.obs||'';
  renderMile();
  $('ov').classList.add('on');
}
function fechar(){ $('ov').classList.remove('on'); editando = false; }

function renderMile(){
  const el = $('mile'), ref = hojeRef();
  const p = {data:fData.value, hora:fHora.value};
  if(!p.data){
    el.innerHTML='<div class="ref">Informe a data da concretagem para calcular a desforma, o reescoramento e a liberação.</div>';
    $('mWarn').innerHTML=''; return;
  }
  const m = marcos(p);
  const linhas = [
    ['Desforma das paredes','fck 3 MPa · '+R.desformaParedeH+' horas', m.parede, true],
    ['Retirada das faces laterais','fôrmas laterais · '+R.facesLateraisD+' dias', m.lateral, false],
    ['Reescoramento 50%','faces inferiores com pontaletes · '+R.reescoraD+' dias', m.reescora, false],
    ['Retirada total das escoras','sem pontaletes · '+R.liberacaoD+' dias', m.liberacao, false]
  ];
  el.innerHTML = '<div class="ref" style="margin:0 0 10px"><b>Marcos calculados</b></div>' + linhas.map(l=>{
    const done = ref >= l[2], rest = Math.ceil((l[2]-ref)/86400000);
    return '<div class="mrow">'+
      '<div class="ic" style="background:'+(done?'rgba(61,220,132,.16)':'rgba(140,170,255,.10)')+'">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="'+(done?'#3ddc84':'#6a7b9e')+'" stroke-width="2.4">'+
      (done?'<path d="M20 6L9 17l-5-5"/>':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')+'</svg></div>'+
      '<div class="nm">'+l[0]+'<small>'+l[1]+'</small></div>'+
      '<div class="dt">'+(l[3]?fmtDH(l[2]):fmt(l[2]))+'</div>'+
      '<div class="st" style="background:'+(done?'rgba(61,220,132,.14)':'rgba(255,176,32,.14)')+
      ';color:'+(done?'#3ddc84':'#ffb020')+'">'+(done?'liberado':'faltam '+rest+'d')+'</div></div>';
  }).join('');

  let w = '';
  if(tetoAtivo > 1){
    const pb = ST.pours[k(tetoAtivo-1,alvo)];
    if(!pb || !pb.data){
      w = '<div class="warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>'+
        '<div>O <b>'+TETOS[tetoAtivo-2].nome+'</b> deste trecho ainda não foi lançado. Confirme a sequência antes de concretar o pavimento superior.</div></div>';
    }else{
      const dif = (baseDT(p)-baseDT(pb))/86400000;
      const ok = dif >= IDADE_MIN_SUBIR;
      w = '<div class="warn'+(ok?' ok':'')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+
        (ok?'<path d="M20 6L9 17l-5-5"/>':'<path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/>')+'</svg><div>Intervalo de <b>'+
        dif.toFixed(1)+' dias</b> em relação ao '+TETOS[tetoAtivo-2].nome+
        (ok?' — dentro da sequência prevista.':'. O detalhe prevê a laje inferior 100% escorada até 14 dias: confira a capacidade do escoramento e a liberação do projetista.')+
        '</div></div>';
    }
  }
  $('mWarn').innerHTML = w;
}
['fData','fHora'].forEach(id=>$(id).addEventListener('change',renderMile));
$('mClose').onclick = fechar;
$('ov').addEventListener('click', e=>{ if(e.target.id==='ov') fechar(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ fechar(); if(document.body.classList.contains('tv')) sairTv(); } });

$('mSave').onclick = ()=>{
  if(!fData.value){ alert('Informe a data da concretagem.'); return; }
  ST.pours[k(tetoAtivo,alvo)] = {data:fData.value,hora:fHora.value,vol:fVol.value,cam:fCam.value,
    nf:fNf.value,fck:fFck.value,slump:fSlump.value,resp:fResp.value,obs:fObs.value};
  fechar(); refresh(); agendarSalvar();
};
$('mDel').onclick = ()=>{
  if(!confirm('Excluir o lançamento de '+T(alvo).nome+' no '+TETOS[tetoAtivo-1].nome+'?')) return;
  delete ST.pours[k(tetoAtivo,alvo)];
  fechar(); refresh(); agendarSalvar();
};

/* ===================== escoramento ===================== */
function drawElev(){
  const ref = hojeRef();
  $('elev').innerHTML = Object.keys(BLOCOS).map(b=>{
    const tr = TRECHOS.filter(t=>t.bloco===b);
    const cols = '62px repeat('+tr.length+',1fr)';
    let rows = '';
    [...TETOS].reverse().forEach(tt=>{
      rows += '<div class="erow" style="grid-template-columns:'+cols+'"><div class="elab">'+tt.n+'º teto</div>';
      tr.forEach(t=>{
        const p = ST.pours[k(tt.n,t.cod)], s = sit(p,ref), i = p&&p.data?idade(p,ref):null;
        rows += s.id==='pend'
          ? '<div class="ecell empty" data-t="'+t.cod+'" data-n="'+tt.n+'">—</div>'
          : '<div class="ecell" data-t="'+t.cod+'" data-n="'+tt.n+'" style="background:'+s.hex+';border-color:'+s.hex+
            '" title="'+t.nome+' · '+s.nome+'">'+(i<0?'prog':Math.floor(i)+'d')+'</div>';
      });
      rows += '</div>';
    });
    const head = '<div class="erow" style="grid-template-columns:'+cols+'"><div></div>'+
      tr.map(t=>'<div class="ehead">'+ORD[t.etapa]+' etapa<br><span style="color:var(--txt3)">'+t.cod+'</span></div>').join('')+'</div>';
    return '<div class="blk"><h3>'+BLOCOS[b].nome+'</h3><p>'+BLOCOS[b].desc+'</p>'+
           '<div class="egrid">'+rows+head+'</div></div>';
  }).join('');
  document.querySelectorAll('.ecell').forEach(c=>c.addEventListener('click',()=>{
    tetoAtivo = +c.dataset.n; $('selTeto').value = tetoAtivo; drawPlanta(); abrir(c.dataset.t);
  }));
}

/* ===================== cronograma ===================== */
function drawCrono(){
  const ref = hojeRef(), tb = document.querySelector('#tblCrono tbody');
  const fb = fBloco.value, ft = fTeto.value, fs = fSit.value;
  const rows = [];
  TETOS.forEach(tt => TRECHOS.forEach(t=>{
    const p = ST.pours[k(tt.n,t.cod)], s = sit(p,ref);
    if(fb && t.bloco!==fb) return;
    if(ft && tt.n != ft) return;
    if(fs && s.id!==fs) return;
    const m = p&&p.data?marcos(p):null, i = p&&p.data?idade(p,ref):null;
    rows.push('<tr>'+
      '<td><b style="color:'+t.cor+'">'+t.nome+'</b><br><small style="color:var(--txt3)" class="m">'+t.cod+'</small></td>'+
      '<td>'+tt.n+'º teto<br><small style="color:var(--txt3)">'+tt.uso+'</small></td>'+
      '<td class="m">'+((p&&p.vol)?(+p.vol).toFixed(2):t.vol.toFixed(2)).replace('.',',')+'</td>'+
      '<td class="m">'+(p&&p.data?fmt(baseDT(p))+' '+(p.hora||''):'—')+'</td>'+
      '<td class="m">'+(i===null||i<0?'—':Math.floor(i)+'d')+'</td>'+
      '<td><span class="pill" style="background:'+s.hex+'22;color:'+s.hex+';border:1px solid '+s.hex+'55">'+s.nome+'</span></td>'+
      '<td class="m">'+(m?fmtDH(m.parede):'—')+'</td>'+
      '<td class="m">'+(m?fmt(m.reescora):'—')+'</td>'+
      '<td class="m">'+(m?fmt(m.liberacao):'—')+'</td>'+
      '<td class="m">'+((p&&(p.nf||p.cam))?((p.nf||'')+(p.cam?' · '+p.cam+' cam':'')):'—')+'</td></tr>');
  }));
  tb.innerHTML = rows.join('') || '<tr><td colspan="10" style="color:var(--txt3);padding:18px">Nenhum registro para este filtro.</td></tr>';
}

/* ===================== agenda ===================== */
function drawAgenda(){
  const ref = hojeRef();
  const al = [];
  TETOS.forEach(tt => TRECHOS.forEach(t=>{
    const p = ST.pours[k(tt.n,t.cod)]; if(!p||!p.data) return;
    const i = idade(p,ref);
    if(i>=R.reescoraD-1 && i<R.reescoraD) al.push(['#38b6ff','Reescoramento amanhã', t.nome+' · '+tt.n+'º teto atinge 14 dias']);
    if(i>=R.liberacaoD-1 && i<R.liberacaoD) al.push(['#3ddc84','Liberação amanhã', t.nome+' · '+tt.n+'º teto atinge 28 dias']);
    if(tt.n>1){
      const pb = ST.pours[k(tt.n-1,t.cod)];
      if(pb&&pb.data){
        const d=(baseDT(p)-baseDT(pb))/86400000;
        if(d<IDADE_MIN_SUBIR) al.push(['#ff5470','Sequência apertada', t.nome+': '+tt.n+'º teto concretado '+d.toFixed(1)+'d após o '+(tt.n-1)+'º']);
      } else al.push(['#ff5470','Pavimento inferior sem registro', t.nome+': '+(tt.n-1)+'º teto não lançado']);
    }
  }));
  $('alertas').innerHTML = al.length ? al.map(a=>
    '<div class="ag"><span class="dot" style="background:'+a[0]+'"></span>'+
    '<div class="t"><b>'+a[1]+'</b><br><span style="color:var(--txt2)">'+a[2]+'</span></div></div>').join('')
    : '<div class="ref">Nenhum alerta ativo para a data de referência.</div>';

  const ev = [];
  TETOS.forEach(tt => TRECHOS.forEach(t=>{
    const p = ST.pours[k(tt.n,t.cod)]; if(!p||!p.data) return;
    const m = marcos(p);
    [['Desforma das paredes',m.parede,'#ff7a45'],['Faces laterais',m.lateral,'#ffb020'],
     ['Reescoramento 50%',m.reescora,'#38b6ff'],['Retirada total das escoras',m.liberacao,'#3ddc84']]
    .forEach(([nm,dt,cor])=>{ const dd=(dt-ref)/86400000; if(dd>=-1&&dd<=10) ev.push({dt,nm,cor,loc:t.nome+' · '+tt.n+'º teto'}); });
  }));
  ev.sort((a,b)=>a.dt-b.dt);
  $('agenda').innerHTML = ev.length ? ev.map(e=>
    '<div class="ag"><span class="d">'+fmt(e.dt)+'</span><span class="dot" style="background:'+e.cor+'"></span>'+
    '<div class="t"><b>'+e.nm+'</b> — '+e.loc+'</div></div>').join('')
    : '<div class="ref">Sem marcos nos próximos 10 dias.</div>';

  $('prog').innerHTML = Object.keys(BLOCOS).map(b=>{
    const tr = TRECHOS.filter(t=>t.bloco===b);
    const tot = tr.reduce((s,t)=>s+t.vol,0)*TETOS.length;
    let fe=0, n=0;
    TETOS.forEach(tt=>tr.forEach(t=>{ const p=ST.pours[k(tt.n,t.cod)];
      if(p&&p.data&&idade(p,ref)>=0){ fe += p.vol?+p.vol:t.vol; n++; }}));
    const pc = tot ? fe/tot*100 : 0;
    return '<div style="margin-bottom:14px">'+
      '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;gap:10px;flex-wrap:wrap">'+
      '<b>'+BLOCOS[b].nome+'</b><span class="tag">'+n+'/'+(tr.length*TETOS.length)+' concretagens · '+
      fe.toFixed(2).replace('.',',')+' de '+tot.toFixed(2).replace('.',',')+' m³</span></div>'+
      '<div class="bar"><i style="width:'+pc.toFixed(1)+'%"></i></div></div>';
  }).join('');
}

/* ===================== KPIs ===================== */
function drawKpi(){
  const ref = hojeRef(); let n=0, v=0, esc=0;
  Object.keys(ST.pours).forEach(key=>{
    const p = ST.pours[key]; if(!p.data) return;
    const i = idade(p,ref); if(i<0) return;
    const cod = key.split('|')[1]; const t = T(cod); if(!t) return;
    n++; v += p.vol ? +p.vol : t.vol;
    if(i < R.escora50Ate) esc++;
  });
  k1.textContent = n;
  k2.textContent = v.toFixed(1).replace('.',',')+' m³';
  k3.textContent = (v/VOL_TOTAL*100).toFixed(1).replace('.',',')+'%';
  k4.textContent = esc;
}

function refresh(){ drawPlanta(); drawElev(); drawCrono(); drawAgenda(); drawKpi(); }

/* ===================== exportar / imprimir / TV ===================== */
$('btnExp').onclick = ()=>{
  const b = new Blob([JSON.stringify(ST,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'concretagens-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
};
$('btnPrint').onclick = ()=>window.print();
$('btnCsv').onclick = ()=>{
  const ref = hojeRef();
  const L = ['Trecho;Codigo;Bloco;Etapa;Teto;Volume;Data;Hora;Idade;Situacao;DesformaParede;Reescoramento;Liberacao;NF;Caminhoes;fck;Slump;Responsavel;Obs'];
  TETOS.forEach(tt=>TRECHOS.forEach(t=>{
    const p = ST.pours[k(tt.n,t.cod)]; if(!p||!p.data) return;
    const m = marcos(p), s = sit(p,ref);
    L.push([t.nome,t.cod,t.bloco,ORD[t.etapa]+' etapa',tt.n+'º teto',(p.vol||t.vol),p.data,p.hora||'',
      Math.floor(idade(p,ref)),s.nome,fmtDH(m.parede),fmt(m.reescora),fmt(m.liberacao),
      p.nf||'',p.cam||'',p.fck||'',p.slump||'',p.resp||'',(p.obs||'').replace(/[;\n]/g,' ')].join(';'));
  }));
  const b = new Blob(['\ufeff'+L.join('\n')],{type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(b);
  a.download = 'concretagens.csv'; a.click();
};

function entrarTv(){
  document.body.classList.add('tv');
  $('btnTvOff').style.display='inline-flex';
  if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
  drawPlanta();
}
function sairTv(){
  document.body.classList.remove('tv');
  $('btnTvOff').style.display='none';
  if(document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  drawPlanta();
}
$('btnTvOn').onclick = entrarTv;
$('btnTvOff').onclick = sairTv;

document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on')); t.classList.add('on');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('on'));
  $('v-'+t.dataset.v).classList.add('on');
});

/* ===================== início ===================== */
(async function(){
  $('hoje').value = new Date().toISOString().slice(0,10);
  const s = $('selTeto');
  s.innerHTML = TETOS.map(t=>'<option value="'+t.n+'">'+t.nome+' — '+t.uso+'</option>').join('');
  s.onchange = ()=>{ tetoAtivo = +s.value; drawPlanta(); };
  $('hoje').onchange = refresh;

  fBloco.innerHTML = '<option value="">Todos</option>'+Object.keys(BLOCOS).map(b=>'<option value="'+b+'">'+BLOCOS[b].nome+'</option>').join('');
  fTeto.innerHTML  = '<option value="">Todos</option>'+TETOS.map(t=>'<option value="'+t.n+'">'+t.nome+'</option>').join('');
  fSit.innerHTML   = '<option value="">Todas</option>'+SITS.map(x=>'<option value="'+x.id+'">'+x.nome+'</option>').join('');
  [fBloco,fTeto,fSit].forEach(e=>e.onchange = drawCrono);

  $('subhead').textContent = TETOS.length+' tetos · '+TRECHOS.length+' trechos · '+
    VOL_TETO.toFixed(2).replace('.',',')+' m³/pavimento · '+VOL_TOTAL.toFixed(2).replace('.',',')+' m³ totais';

  try{ await carregar(); }
  catch(e){ marcarSync('erro','servidor não encontrado — execute npm run dev'); }
  aplicarCalib();
  refresh();

  if(new URLSearchParams(location.search).get('tv')==='1') entrarTv();

  /* vira o dia sozinho quando a TV fica ligada a noite toda */
  let diaAtual = new Date().toDateString();
  setInterval(()=>{
    const d = new Date().toDateString();
    if(d !== diaAtual){ diaAtual = d; $('hoje').value = new Date().toISOString().slice(0,10); refresh(); }
  }, 60000);
})();
