# Código legado (não usado em produção)

Estes três arquivos (`index.html`, `main.js`, `vite.config.js`) são de uma versão
anterior do painel, feita para rodar com Vite (`npm run dev` na porta 5173,
proxy para uma API na porta 3000). Essa versão **não tem login, não tem aba
Equipes/Serviços, não tem Funcionários/Kanban, não tem checklist de liberação
nem corpos de prova** — foi substituída pela versão atual, de arquivo único,
em `publico/index.html`, servida diretamente pelo `server.js`.

O `server.js` atual só serve arquivos estáticos da pasta `publico/`, então
nada aqui é executado em produção. Ficam guardados apenas para referência
histórica. Podem ser apagados com segurança quando não forem mais necessários.

Movidos para cá em 14/08/2026 durante a refatoração da aba Equipes → Serviços.
