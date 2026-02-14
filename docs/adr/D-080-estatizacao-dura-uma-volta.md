# D-080 — Estatização dura uma volta

**Data:** 2026-08-01 · **Status:** aceita · **Refina:** [D-064](D-064-rebalanceamento-do-catalogo-de-cartas.md) — **somente quanto à duração da Estatização**

**Decisão:** a **Estatização** (Acaso, Épica, imediata) passa a durar **1 volta completa**, e
não mais 2. Todo o resto da carta fica **intacto**:

- todo aluguel pago na mesa continua indo **direto para a Loteria** em vez do dono;
- raridade permanece **Épica** (roxo, ◆◆◆);
- permanece com **1 cópia** no baralho **Acaso**;
- permanece **imediata** (sem ir para a mão, sem timing de uso);
- elegibilidade e alcance permanecem os mesmos — o efeito é **board-wide**, sem alvo escolhido;
- o destino do dinheiro permanece a **Loteria** (`centerPot`), nunca o banco nem outro jogador;
- o relógio da expiração continua sendo a passagem pelo **GO de quem originou** o efeito, como
  em todo `TempEffect`.

**Por quê:** a Estatização é o único efeito board-wide do catálogo que **desliga a economia
inteira** — enquanto ela vale, nenhum dono recebe nada, e o único beneficiário é um pote que
só um jogador vai coletar. Duas voltas de mesa cheia são, na prática, dois turnos completos de
cada um dos participantes sem retorno de aluguel: numa mesa de 6, isso são doze turnos em que
comprar, construir e cobrar deixam de se relacionar. Medido contra as outras Épicas, o
desequilíbrio é de eixo, não de grau — Boicote e Embargo também duram 2 voltas, mas atingem
**uma** propriedade e **um** jogador; a Estatização atinge todos ao mesmo tempo.

Uma volta preserva integralmente o que a carta é — o susto de ver o aluguel evaporar para o
pote, e a corrida ao Free Parking que ela cria — sem transformar um efeito em um intervalo de
jogo. É a mesma duração que a **Imunidade Total** e a **Greve** já usam, e pela mesma razão:
efeito que vale para a mesa inteira paga o alcance com prazo curto.

**Custo aceito:** a carta fica menos punitiva para quem tem grupos construídos, que é
justamente quem ela existia para atingir. Aceito: a assimetria continua — quem tem mais
aluguel a receber continua sendo quem mais perde —, apenas por uma janela que a mesa consegue
absorver.

**O que esta decisão NÃO faz:** não altera nenhuma outra carta, não muda o destino do dinheiro
(segue a Loteria), não mexe na duração de Boicote nem de Embargo de Obras (2 voltas cada), não
reabre a distribuição de raridades da [D-075](D-075-quarto-nivel-de-raridade-epica.md) nem as
cópias fixadas pela [D-074](D-074-raridade-de-carta-nao-inverte-probabilidade.md).

**Como aplicar:** SRS v1.40 (§10.6, Épicas). No motor, `applyEffect('estatizacao')` cria o
`TempEffect` com `lapsRemaining: 1`. Todas as fontes derivadas passam a dizer **uma** volta —
texto da carta (`cardMeta`), narrativa do log (`describeLog`), rótulo do painel de efeitos
ativos, catálogo de mapa e testes. A interface **nunca** repete o número: ela lê
`lapsRemaining` do estado, que é o que a torna imune à próxima mudança de duração. Snapshot em
voo com `lapsRemaining: 2` continua válido e expira normalmente pelo decremento de sempre — não
há migração, porque a duração só é lida na **criação** do efeito.
