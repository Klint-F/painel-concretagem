import express from 'express'
import cors from 'cors'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/planta', express.static(path.join(__dirname, 'uploads')))

// Ensure uploads dir
const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = req.query.ext || file.originalname.split('.').pop()
    cb(null, 'planta-' + Date.now() + '.' + ext)
  }
})
const upload = multer({ storage })

// SQLite init
let db
async function initDb() {
  db = await open({
    filename: process.env.DB_PATH || path.join(__dirname, 'concretagem.db'),
    driver: sqlite3.Database
  })
  await db.exec(`
    CREATE TABLE IF NOT EXISTS estado (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      pours TEXT NOT NULL DEFAULT '{}',
      planta TEXT,
      ajustes TEXT NOT NULL DEFAULT '{}',
      rev INTEGER NOT NULL DEFAULT 0,
      atualizado TEXT
    );
    INSERT OR IGNORE INTO estado (id, pours, ajustes, rev) VALUES (1, '{}', '{}', 0);
  `)
}

// API Routes
app.get('/api/estado', async (req, res) => {
  const row = await db.get('SELECT * FROM estado WHERE id = 1')
  res.json({
    pours: JSON.parse(row.pours),
    planta: row.planta ? JSON.parse(row.planta) : null,
    ajustes: JSON.parse(row.ajustes),
    rev: row.rev,
    atualizado: row.atualizado
  })
})

app.put('/api/estado', async (req, res) => {
  const { pours, planta, ajustes } = req.body
  const rev = Date.now()
  const atualizado = new Date().toISOString()
  await db.run(
    'UPDATE estado SET pours = ?, planta = ?, ajustes = ?, rev = ?, atualizado = ? WHERE id = 1',
    JSON.stringify(pours || {}),
    planta ? JSON.stringify(planta) : null,
    JSON.stringify(ajustes || {}),
    rev,
    atualizado
  )
  res.json({ ok: true, rev })
})

app.get('/api/rev', async (req, res) => {
  const row = await db.get('SELECT rev FROM estado WHERE id = 1')
  res.json({ rev: row?.rev || 0 })
})

app.post('/api/planta', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file' })
  const planta = { arquivo: req.file.filename, nome: req.file.originalname }
  const rev = Date.now()
  await db.run(
    'UPDATE estado SET planta = ?, rev = ? WHERE id = 1',
    JSON.stringify(planta), rev
  )
  res.json({ ok: true, arquivo: req.file.filename })
})

app.delete('/api/planta', async (req, res) => {
  const row = await db.get('SELECT planta FROM estado WHERE id = 1')
  if (row?.planta) {
    const p = JSON.parse(row.planta)
    const fp = path.join(uploadsDir, p.arquivo)
    if (fs.existsSync(fp)) fs.unlinkSync(fp)
  }
  const rev = Date.now()
  await db.run('UPDATE estado SET planta = NULL, rev = ? WHERE id = 1', rev)
  res.json({ ok: true })
})

// Serve static files from dist in production, otherwise Vite handles it
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

initDb().then(() => {
  app.listen(PORT, () => {
    console.log('\n🚀 Servidor rodando em http://localhost:' + PORT)
    console.log('📺 Para abrir na TV: use o IP da máquina na rede')
    console.log('   Exemplo: http://192.168.1.100:' + PORT)
    console.log('\n💾 Banco SQLite: concretagem.db')
    console.log('🖼️  Plantas salvas em: uploads/\n')
  })
})
