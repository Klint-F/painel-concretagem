/* =====================================================================
   Painel de Concretagem — servidor com PostgreSQL (Supabase/Render)
   Roda local SEM banco:  node server.js
   Roda online COM banco:  DATABASE_URL=postgresql://... node server.js
   ===================================================================== */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORTA   = Number(process.argv[2]) || 8080;
const RAIZ    = __dirname;
const PUBLICO = path.join(RAIZ, 'publico');
const DADOS   = path.join(RAIZ, 'dados');
const BANCO   = path.join(DADOS, 'banco.json');
const BACKUPS = path.join(DADOS, 'backups');
const PLANTAS = path.join(DADOS, 'plantas');
const FOTOS   = path.join(DADOS, 'fotos');

for (const d of [DADOS, BACKUPS, PLANTAS, FOTOS]) fs.mkdirSync(d, { recursive: true });

/* =====================================================================
   MODO:  'pg'  = PostgreSQL online  |  'json' = arquivo local
   ===================================================================== */
const MODO_PG = !!process.env.DATABASE_URL;
let pool = null;

if (MODO_PG) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

/* ------------------------- banco de dados ------------------------- */
const VAZIO = { rev: 0, atualizado: null, pours: {}, planta: null, ajustes: {},
                metas: {}, plano: null, equipes: [], alocacoes: [] };

let ESTADO = Object.assign({}, VAZIO);

/* --- local (JSON) --- */
function lerLocal() {
  try {
    const j = JSON.parse(fs.readFileSync(BANCO, 'utf8'));
    return Object.assign({}, VAZIO, j);
  } catch (e) {
    return Object.assign({}, VAZIO);
  }
}

function gravarLocal(estado) {
  const tmp = BANCO + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(estado, null, 2), 'utf8');
  fs.renameSync(tmp, BANCO);
  backupLocal(estado);
  return estado;
}

let ultimoBackup = 0;
function backupLocal(estado) {
  const agora = Date.now();
  if (agora - ultimoBackup < 10 * 60 * 1000) return;
  ultimoBackup = agora;
  const d = new Date();
  const nome = 'banco-' + d.toISOString().slice(0, 16).replace(/[:T]/g, '') + '.json';
  try {
    fs.writeFileSync(path.join(BACKUPS, nome), JSON.stringify(estado), 'utf8');
    const antigos = fs.readdirSync(BACKUPS).filter(f => f.endsWith('.json')).sort();
    while (antigos.length > 60) fs.unlinkSync(path.join(BACKUPS, antigos.shift()));
  } catch (e) { /* backup nunca derruba o servidor */ }
}

/* --- PostgreSQL --- */
async function initPG() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS painel_estado (
      id INTEGER PRIMARY KEY DEFAULT 1,
      rev INTEGER DEFAULT 0,
      atualizado TIMESTAMPTZ,
      pours JSONB DEFAULT '{}',
      planta JSONB,
      ajustes JSONB DEFAULT '{}',
      metas JSONB DEFAULT '{}',
      plano JSONB,
      equipes JSONB DEFAULT '[]',
      alocacoes JSONB DEFAULT '[]'
    )
  `);
  await pool.query(`
    INSERT INTO painel_estado (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);
}

async function lerPG() {
  const res = await pool.query('SELECT * FROM painel_estado WHERE id = 1');
  if (res.rows.length === 0) return Object.assign({}, VAZIO);
  const row = res.rows[0];
  return {
    rev: row.rev || 0,
    atualizado: row.atualizado,
    pours: row.pours || {},
    planta: row.planta,
    ajustes: row.ajustes || {},
    metas: row.metas || {},
    plano: row.plano,
    equipes: row.equipes || [],
    alocacoes: row.alocacoes || []
  };
}

async function gravarPG(estado) {
  await pool.query(`
    UPDATE painel_estado SET
      rev = $1,
      atualizado = $2,
      pours = $3,
      planta = $4,
      ajustes = $5,
      metas = $6,
      plano = $7,
      equipes = $8,
      alocacoes = $9
    WHERE id = 1
  `, [
    estado.rev,
    estado.atualizado,
    JSON.stringify(estado.pours),
    estado.planta ? JSON.stringify(estado.planta) : null,
    JSON.stringify(estado.ajustes),
    JSON.stringify(estado.metas),
    estado.plano ? JSON.stringify(estado.plano) : null,
    JSON.stringify(estado.equipes),
    JSON.stringify(estado.alocacoes)
  ]);
  return estado;
}

/* --- unificado --- */
async function carregar() {
  if (MODO_PG) {
    ESTADO = await lerPG();
  } else {
    ESTADO = lerLocal();
    if (!fs.existsSync(BANCO)) gravarLocal(ESTADO);
  }
}

async function salvar(estado) {
  if (MODO_PG) {
    await gravarPG(estado);
  } else {
    gravarLocal(estado);
  }
  ESTADO = estado;
}

/* ------------------------- utilitários HTTP ------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.ico': 'image/x-icon'
};

function json(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length });
  res.end(b);
}

function corpo(req, limiteMB = 60) {
  return new Promise((ok, falha) => {
    const partes = []; let tam = 0;
    req.on('data', c => {
      tam += c.length;
      if (tam > limiteMB * 1024 * 1024) { falha(new Error('arquivo grande demais')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => ok(Buffer.concat(partes)));
    req.on('error', falha);
  });
}

/* ------------------------- servidor ------------------------- */
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'local'));
  const rota = decodeURIComponent(url.pathname);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    /* --- estado completo --- */
    if (rota === '/api/estado' && req.method === 'GET') return json(res, 200, ESTADO);

    if (rota === '/api/estado' && req.method === 'PUT') {
      const novo = JSON.parse((await corpo(req)).toString('utf8'));
      const estado = {
        rev: (ESTADO.rev || 0) + 1,
        atualizado: new Date().toISOString(),
        pours: novo.pours || {},
        planta: novo.planta !== undefined ? novo.planta : ESTADO.planta,
        ajustes: novo.ajustes || {},
        metas: novo.metas || {},
        plano: novo.plano !== undefined ? novo.plano : ESTADO.plano,
        equipes: novo.equipes || [],
        alocacoes: novo.alocacoes || []
      };
      await salvar(estado);
      return json(res, 200, { ok: true, rev: estado.rev, atualizado: estado.atualizado });
    }

    /* --- ping de sincronismo: a TV pergunta só a revisão --- */
    if (rota === '/api/rev') return json(res, 200, { rev: ESTADO.rev, atualizado: ESTADO.atualizado });

    /* --- upload da planta baixa --- */
    if (rota === '/api/planta' && req.method === 'POST') {
      const ext = (url.searchParams.get('ext') || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
      const buf = await corpo(req);
      const arquivo = 'planta-' + Date.now() + '.' + ext;
      fs.writeFileSync(path.join(PLANTAS, arquivo), buf);
      const estado = {
        ...ESTADO,
        planta: { arquivo, tipo: MIME['.' + ext] || 'application/octet-stream', bytes: buf.length },
        rev: (ESTADO.rev || 0) + 1,
        atualizado: new Date().toISOString()
      };
      await salvar(estado);
      return json(res, 200, { ok: true, url: '/planta/' + arquivo, rev: estado.rev });
    }

    if (rota === '/api/planta' && req.method === 'DELETE') {
      const estado = { ...ESTADO, planta: null, rev: (ESTADO.rev || 0) + 1 };
      await salvar(estado);
      return json(res, 200, { ok: true, rev: estado.rev });
    }

    if (rota.startsWith('/planta/')) {
      const nome = path.basename(rota);
      const arq = path.join(PLANTAS, nome);
      if (!fs.existsSync(arq)) { res.writeHead(404); return res.end('planta não encontrada'); }
      const ext = path.extname(nome).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'max-age=3600' });
      return fs.createReadStream(arq).pipe(res);
    }

    /* --- fotos do checklist e dos ensaios --- */
    if (rota === '/api/foto' && req.method === 'POST') {
      const ext = (url.searchParams.get('ext') || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
      const buf = await corpo(req);
      const arquivo = 'f' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
      fs.writeFileSync(path.join(FOTOS, arquivo), buf);
      return json(res, 200, { ok: true, url: '/fotos/' + arquivo });
    }

    if (rota.startsWith('/fotos/')) {
      const arq = path.join(FOTOS, path.basename(rota));
      if (!fs.existsSync(arq)) { res.writeHead(404); return res.end('foto não encontrada'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(arq).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'max-age=86400' });
      return fs.createReadStream(arq).pipe(res);
    }

    /* --- backup manual pela interface --- */
    if (rota === '/api/backup' && req.method === 'POST') {
      if (!MODO_PG) { ultimoBackup = 0; backupLocal(ESTADO); }
      return json(res, 200, { ok: true, modo: MODO_PG ? 'pg' : 'local' });
    }

    /* --- estáticos --- */
    let alvo = rota === '/' ? '/index.html' : rota;
    const arquivo = path.join(PUBLICO, path.normalize(alvo).replace(/^([/\\])+/, ''));
    if (!arquivo.startsWith(PUBLICO)) { res.writeHead(403); return res.end('acesso negado'); }
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(arquivo).toLowerCase()] || 'text/plain; charset=utf-8' });
      return fs.createReadStream(arquivo).pipe(res);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 — não encontrado');
  } catch (e) {
    json(res, 500, { erro: String(e.message || e) });
  }
});

/* ------------------------- inicialização ------------------------- */
function ips() {
  const lista = [];
  const nets = os.networkInterfaces();
  for (const nome of Object.keys(nets)) {
    for (const n of nets[nome] || []) {
      if (n.family === 'IPv4' && !n.internal) lista.push(n.address);
    }
  }
  return lista;
}

async function iniciar() {
  if (MODO_PG) {
    await initPG();
    await carregar();
  } else {
    await carregar();
  }

  servidor.listen(PORTA, '0.0.0.0', () => {
    const linha = '─'.repeat(56);
    console.log('\n' + linha);
    console.log('  PAINEL DE CONCRETAGEM — servidor no ar');
    console.log(linha);
    console.log('  Modo banco:         ' + (MODO_PG ? 'PostgreSQL (online)' : 'JSON local'));
    console.log('  Neste computador:   http://localhost:' + PORTA);
    ips().forEach(ip => console.log('  Na TV / celular:    http://' + ip + ':' + PORTA));
    console.log('  Modo TV direto:     http://' + (ips()[0] || 'localhost') + ':' + PORTA + '/?tv=1');
    console.log(linha);
    if (!MODO_PG) {
      console.log('  Banco:    ' + BANCO);
      console.log('  Backups:  ' + BACKUPS);
    }
    console.log('  Registros salvos: ' + Object.keys(ESTADO.pours).length + '  ·  revisão ' + ESTADO.rev);
    console.log(linha);
    console.log('  Para parar o servidor: Ctrl + C\n');
  });
}

servidor.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n  A porta ' + PORTA + ' já está em uso.');
    console.error('  Rode em outra porta:  node server.js 8081\n');
  } else console.error(e);
  process.exit(1);
});

/* grava antes de encerrar */
for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, async () => {
    if (MODO_PG && pool) await pool.end();
    console.log('\n  Servidor encerrado.\n');
    process.exit(0);
  });
}

iniciar();