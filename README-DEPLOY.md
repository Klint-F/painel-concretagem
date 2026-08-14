# 🚀 Deploy do Painel de Concretagem

## Opção 1 — Render (mais fácil, grátis)

1. Crie uma conta em https://render.com
2. Crie um **New Web Service**
3. Conecte seu repositório GitHub (ou faça upload do ZIP e use "Deploy from Git")
4. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server.js`
   - **Plan:** Free
5. Clique em **Create Web Service**

⚠️ **Atenção:** no plano gratuito do Render, o disco é efêmero. Se o container "dormir" (15 min sem uso) ou reiniciar, o banco SQLite pode ser resetado. Para uso contínuo, faça backup diário via "Exportar cópia" no painel.

**URL pública:** `https://painel-concretagem-XXXX.onrender.com`

---

## Opção 2 — Fly.io (SQLite persistente, grátis)

1. Instale o CLI: `brew install flyctl` (Mac) ou veja https://fly.io/docs/hands-on/install-flyctl/
2. Login: `fly auth login`
3. No terminal, dentro da pasta do projeto:
```bash
fly launch --name painel-concretagem --region gru --no-deploy
fly volumes create concretagem_data --size 1 --region gru
fly deploy
```
4. Pronto! O volume persiste entre reinicializações.

**URL pública:** `https://painel-concretagem.fly.dev`

---

## Opção 3 — Glitch (super fácil, mas "dorme")

1. Vá em https://glitch.com
2. Clique em **New Project** → **Import from GitHub** (ou arraste os arquivos)
3. No `package.json`, altere o script start para: `"start": "node server.js"`
4. O Glitch sobe sozinho

⚠️ O container "dorme" após 5 minutos de inatividade e demora ~10s para acordar.

---

## Opção 4 — PC/Raspberry Pi na obra (recomendado para uso interno)

Se a TV e os computadores estão na mesma rede, rodar local é mais rápido e não depende de internet:

```bash
npm install
npm run dev
```

Acesse pelo IP da máquina:
```
http://192.168.1.XXX:5173
```

Para deixar ligado 24/7, use o PM2:
```bash
npm install -g pm2
pm2 start server.js --name concretagem
pm2 startup
pm2 save
```

---

## 🔐 Backup automático (importante!)

Independentemente da hospedagem, configure backup do banco:

**Render/Fly:** O arquivo `concretagem.db` e a pasta `uploads/` são seus dados. Faça download periódico.

**No painel:** Use o botão **"Exportar cópia"** para baixar um JSON com todos os lançamentos.
