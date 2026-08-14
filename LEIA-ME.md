# Painel de Concretagem — Sunset Beach Hall

Aplicação local. Roda no computador da obra e abre na TV, no celular e no tablet
pela rede, sempre com os mesmos dados.

## Como rodar

1. Instale o **Node.js LTS** (https://nodejs.org) — uma vez só, em qualquer versão recente.
2. Windows: dê dois cliques em **INICIAR-WINDOWS.bat**.
   Mac/Linux: no terminal, `./iniciar.sh`
3. O terminal mostra os endereços. Exemplo:

   ```
   Neste computador:   http://localhost:8080
   Na TV / celular:    http://192.168.0.14:8080
   Modo TV direto:     http://192.168.0.14:8080/?tv=1
   ```

4. Na TV, abra o navegador e digite o endereço `http://192.168.0.xx:8080/?tv=1`.
   A TV precisa estar no mesmo Wi-Fi do computador.

Para trocar a porta: `node server.js 3000`

## Banco de dados

- Arquivo: `dados/banco.json` — gravação atômica, não corrompe se faltar energia.
- Backups automáticos a cada 10 minutos de uso em `dados/backups/` (mantém os 60 últimos).
- A planta de fundo fica em `dados/plantas/` e as fotos do checklist em `dados/fotos/`.
- Tudo salva sozinho: cada lançamento vai para o servidor em meio segundo.
  O indicador no topo mostra "salvo às hh:mm" ou avisa se o servidor caiu.
- Todos os aparelhos conectados se atualizam sozinhos a cada 4 segundos.
  Lançou no celular na frente da bomba, aparece na TV do canteiro.

Para levar o histórico embora, use **Exportar cópia** (JSON) ou **Baixar CSV**.
Para fazer backup completo, copie a pasta `dados/`.

## Planta de fundo

Já vem com a planta do pavimento. Para trocar, clique em **Planta de fundo** e
arraste o novo arquivo (PNG, JPG, WEBP ou SVG). Se o desenho estiver em PDF,
exporte antes como imagem.

Controles: opacidade, escala, posição, rotação e inversão de cores (o padrão é
invertido, porque o traço preto do CAD some no fundo escuro).

Se preferir mover os trechos em vez da planta, use **Ajustar áreas** (abaixo).

## Gestão à vista — o que o painel entrega

**Semáforo do dia** (faixa no topo, aparece também no modo TV): quantos trechos
concretam, desformam, reescoram e liberam escoras hoje, com os nomes na frente.

**Previsto × realizado.** Na aba Planejamento você define a data de início, o ciclo
entre etapas, o intervalo entre tetos e a sequência de execução; o painel gera as 56
datas-meta. A partir daí cada trecho mostra o desvio em dias, a borda fica vermelha
quando atrasa, e o KPI "Desvio do plano" no topo dá a média da obra. A tabela
previsto × realizado sai em CSV.

**Curva de avanço** (aba Indicadores): volume acumulado previsto contra realizado, mês
a mês, com as barras do volume de cada mês e a diferença em m³ contra o plano.

**Consumo real × teórico.** O volume aplicado (somado dos caminhões, ou o campo de
volume) é comparado com o volume de projeto de cada trecho. Até 5% passa; entre 5% e 8%
fica amarelo; acima de 8% fica vermelho e vira alerta. O KPI "Perda de concreto" mostra
o número da obra inteira.

**Rastreabilidade.** Dentro do trecho, aba Caminhões: número, nota fiscal, volume e cor
de cada carga. O painel desenha as faixas proporcionais na sequência de descarga e
imprime a ficha no formato do FORM PQO 05.

**Corpos de prova.** Ao lançar a data da concretagem, o painel já calcula os
rompimentos de 7 e 28 dias. A aba Qualidade cobra o que venceu, compara o fck obtido
com o de projeto (7 dias contra 70% do fck) e marca aprovado ou reprovado. O selo
vermelho na aba mostra quantos rompimentos estão em atraso.

**Checklist de liberação.** Oito itens antes de concretar — armadura, prumo,
escoramento, embutidos, espaçadores, desmoldante, limpeza e segurança — com conforme /
não conforme / não se aplica, descrição da não conformidade e foto. Salvar com item
pendente ou em aberto pede confirmação e o trecho fica marcado como não liberado na aba
Qualidade.

**Equipes por trecho.** Cadastre as equipes com cor e efetivo na aba Equipes. Na planta,
ligue "Mostrar equipes", escolha a equipe e clique no desenho para colocar o capacete.
Arraste para mover, clique duas vezes para tirar. A alocação é por teto e o efetivo
total aparece somado.

## Ajustar as áreas dos trechos

Na aba Planta, botão **Ajustar áreas**: arraste o miolo do trecho para mover e as alças
laranja para mudar largura e comprimento, cada uma independente. As medidas aparecem
embaixo de cada área enquanto você ajusta. Há um link para restaurar as áreas originais.
Tudo fica salvo no banco.

## Nomenclatura

| Código do projeto | Nome no painel |
|---|---|
| CO1 | Bloco A — 1ª etapa |
| CO2 | Bloco A — 2ª etapa |
| CO3 | Bloco A — 3ª etapa |
| CO4 | Bloco B — 1ª etapa |
| CO5 | Bloco B — 2ª etapa |
| CO6 | Bloco B — 3ª etapa |
| CO7 | Bloco C — 1ª etapa |
| CO8 | Bloco C — 2ª etapa |

O código original continua visível em cima do nome, para bater com as pranchas.

## Regras aplicadas (da prancha)

- Desforma das paredes: fck 3 MPa, cerca de 8 horas
- Retirada das faces laterais: 3 dias
- Reescoramento 50% (faces inferiores com pontaletes): 14 dias
- Retirada total das escoras: 28 dias
- Escoramento: 100% até 14 dias · 50% de 14 a 28 dias · livre acima de 28 dias
- Alerta quando o intervalo entre um teto e o de baixo fica abaixo de 7 dias

Para mudar qualquer regra, volumes ou cotas, edite o bloco `CONFIGURAÇÃO` no
começo do script em `publico/index.html`.

## Deixar rodando sempre

Windows: coloque um atalho do `INICIAR-WINDOWS.bat` na pasta
`shell:startup` (Win+R → `shell:startup`). O painel sobe junto com o computador.
