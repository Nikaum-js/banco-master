# D-079 — Retrato de celular é orientação servida, com layout próprio

**Data:** 2026-07-31 · **Status:** aceita · **Refina:** [D-039](D-039-acessibilidade-aa-no-caminho-de-jogo.md) (revoga a cláusula **Orientação**; o resto da D-039 — os quatro compromissos de AA e o gate no CI — continua intacto)

**Decisão:** o celular em **retrato joga**. O aviso "gire o aparelho" sai do caminho de jogo: nenhuma orientação é recusada. Em retrato estreito o produto não serve o layout de paisagem encolhido — ele serve **outro layout**, com outra distribuição de caixas:

- **O tabuleiro é o herói e vem primeiro.** Ocupa a largura inteira da viewport, no topo, sempre inteiro na tela — nunca abaixo da dobra, nunca cortado. Ele não rola.
- **Os painéis laterais deixam de ser laterais.** Viram uma **gaveta** abaixo do tabuleiro, com abas (Jogadores · Ações). Só a gaveta rola.
- **Um cockpit fixo** carrega, sem exigir toque nenhum, o que o jogador precisa para decidir: **o caixa e a vez do assento deste dispositivo**. A ação principal continua no **miolo do tabuleiro** (§12.2, D-066), que em retrato está sempre visível.
- Abaixo do limiar, `.side-panel` deixa de disputar largura com o tabuleiro: os dois nunca ocupam a mesma linha.

O limiar é **retrato com largura ≤ 820px**. Acima dele, o empilhamento de tablet (1100px) que já existia continua valendo, porque lá a mesa cabe em coluna sem virar miniatura. Paisagem — de celular a desktop — **não muda em nada**.

**Por quê:** a D-039 justificou paisagem-só pela geometria, e a geometria estava certa: um quadrado limitado pela ALTURA da viewport, em retrato, vira uma miniatura ilegível. O erro não foi a conta — foi manter o **mesmo layout** e concluir que retrato era impossível. Em retrato o recurso escasso é a altura, e o abundante é a largura; o layout de paisagem gasta largura com duas gavetas e depois reclama que falta espaço.

Medido nesta branch, antes do conserto, com o aviso de rotação suprimido para fotografar o que existia debaixo dele:

| Viewport | O que o jogador via |
|---|---|
| 390×844 | Painel de Jogadores e "Efeitos ativos" comendo a metade de cima; tabuleiro espremido embaixo, nomes de casa girados e ilegíveis, preços sobrepostos; "Pote da Loteria" cortado pela borda |
| 320×568 | Tabuleiro **quase inteiro abaixo da dobra** — a mesa começa a ~410px numa tela de 568px. Não dá para jogar |

O aviso escondia isso: como ele cobria a tela, o layout de baixo nunca precisou funcionar, e apodreceu sem gate. "Retrato é uma orientação com uma tela própria" (D-039) virou, na prática, uma tela própria que dispensava o produto de existir ali.

Servir retrato de verdade é o que o gênero exige. Um jogo de tabuleiro online é jogado no celular que a pessoa tem na mão, em pé, numa mão só. Pedir para girar é pedir para trocar de postura antes de cada partida — e a rotação forçada é, ela mesma, uma barreira de acessibilidade: quem usa o aparelho preso a um suporte, cadeira ou braço articulado não gira coisa nenhuma. A D-039 pedia AA no caminho de jogo e, na mesma decisão, tornava o caminho de jogo inalcançável para esse jogador.

A largura inteira é o que torna a conta viável. Medido depois do conserto, um celular de 390px dá tabuleiro de **390px** e casa de borda de **49 × 25px** — maior que a casa que a paisagem mínima suportada já produz hoje (740 × 360 dá tabuleiro de ~352px, casa de ~27px de profundidade). O que faltava não era pixel: era **parar de gastar 200px de largura com uma gaveta** que, deitada, faz sentido, e de pé não.

A casa continua abaixo de 44px na profundidade, nas duas orientações. Isso não é regressão nem exceção nova: o alvo de 44px do §12.6 vale para **controles**, e a casa do tabuleiro nunca foi dimensionada por ele — o gate de paisagem já passa com ~27px desde a 044. O que a D-079 acrescenta é que retrato não fica **pior** que a paisagem que já se promove.

**Alternativa descartada — tabuleiro com zoom e pan:** resolve a legibilidade da casa e destrói a leitura da mesa. Num jogo de tabuleiro, a informação é a posição relativa de todo mundo; um tabuleiro que só cabe ampliado obriga a um gesto antes de cada decisão e nunca mostra o estado completo. Foi oferecido e recusado.

**Alternativa descartada — manter o aviso e consertar só o resto:** deixa de pé a única quebra que impede jogar. As outras (modal de convite, alvos de toque) são reparos; esta é a razão de o celular não servir.

**Correção de 2026-07-31, depois do primeiro deploy — geometria não é densidade.** A primeira implementação desta decisão acertou o que a decisão dizia (tabuleiro inteiro acima da dobra, sem rolagem horizontal, alvos de 44px) e mesmo assim chegou ilegível ao aparelho. O gate passava porque media **geometria**; o que estava errado era **densidade**. Três causas, todas medidas em 360×667 (a altura que sobra num navegador de celular depois da barra de endereço e da de navegação):

1. **A compactação da gaveta mora atrás de `(orientation: landscape)`.** São ~160 linhas — respiro de cartão, altura de linha de jogador, dica de estado vazio — que retrato nunca recebeu, herdando tamanhos de desktop. Copiá-las seria errado: lá o recurso escasso é a **largura** (gaveta de 112–190px, por isso o caixa ganha fileira própria e os rótulos encurtam); aqui é a **altura**. Retrato ganhou compactação **vertical** própria, sem encurtar texto nenhum.
2. **`.side-panel` é flex column e nenhuma seção declarava `flex-shrink: 0`.** Numa gaveta alta isso nunca aparece; numa de 215px as seções eram espremidas e, como `.side-panel-section` tem `overflow: hidden`, o conteúdo era **cortado em silêncio** — a linha do jogador aparecia sem o caixa. Rolagem é navegável; corte silencioso não.
3. **A régua global de 44px de altura em ponteiro grosso anulava `.hit-44`.** O comentário da regra afirmava que forçar altura "não empurra vizinho, numa coluna". Empurra: o botão de desistir é filho flex da headline, então os 44px inflavam a linha inteira em 22px — comprando uma área de toque que o `::after` do `.hit-44` já garantia. `.hit-44` saiu da régua de altura.

Some-se o **dado**: 56px fixos em `game/ui/dice.tsx`, num miolo de tabuleiro que em retrato é uma fração do desktop. Ele passou a ser dirigido por `--die-size`, e não por um `scale` na folha, porque as seis faces do cubo são posicionadas com `translateZ(metade da aresta)` — encolher só a caixa deixaria as faces flutuando, e um `scale` no ancestral encolheria o desenho sem devolver o espaço do layout.

A lição que fica no gate: **medir que nada transborda não é medir que dá para ler.** `e2e/responsive.spec.ts` ganhou um bloco de densidade que falha se uma seção da gaveta for espremida, se a linha do jogador voltar à altura de desktop, se o dado desproporcionar em relação ao tabuleiro, ou se não couberem dois jogadores inteiros. Ele foi verificado contra o código anterior — falha nele.

**Consequência aceita:** retrato passa a ser uma terceira geometria a manter, ao lado de paisagem estreita e desktop. O custo é real e é pago com gate: `e2e/responsive.spec.ts` deixa de afirmar que retrato pede rotação e passa a **provar que retrato joga** — tabuleiro inteiro acima da dobra, sem rolagem horizontal, alvos de 44px e nenhuma violação séria do axe. Sem esse gate, esta decisão apodrece exatamente como a anterior.

**Como aplicar:** o SRS ganha a reescrita de **§12.6 (Orientação)** e vai a v1.39. `OrientationGate` sai do caminho de jogo (`OnlineSessionGate`); o componente e seu teste são removidos junto, porque um gate que nunca dispara é sedimento. O layout de retrato vive em `src/index.css` num bloco próprio, depois do de 1100px e antes do de paisagem estreita, e a gaveta com abas em `src/boards/PortraitDock.tsx`.
