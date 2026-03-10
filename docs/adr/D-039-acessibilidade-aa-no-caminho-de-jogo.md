# D-039 — Acessibilidade AA no caminho de jogo, paisagem como orientação de jogo

**Data:** 2026-07-26 · **Status:** aceita

**Decisão:** a v1 assume **WCAG 2.2 nível AA como obrigação no caminho de jogo** — as telas sem as quais não se joga: home, lobby, tabuleiro e HUD, modais de decisão (§12.2), superfícies de pausa/reconexão e a tela de fim de jogo. O compromisso é verificável, não declarativo: uma auditoria automatizada roda no CI sobre essas telas e **falha o build** em violação séria ou crítica.

Fora do caminho de jogo — popovers informativos de propriedade, board de auditoria de SFX (`?sons`), telas de debug — o alvo é o mesmo, sem gate automatizado.

Quatro compromissos concretos, porque "AA" sozinho não decide nada na hora de codar:

1. **Teclado é caminho completo.** Todo controle é alcançável e operável por teclado, na ordem visual, com foco sempre visível. Modal recebe o foco ao abrir, prende o foco enquanto está aberto e devolve o foco a quem o abriu ao fechar.
2. **Esc fecha o que não decide.** Modal informativo fecha por Esc; **modal que decide a partida não** (compra, leilão, reação, dívida, descarte de carta). Esc que resolve uma decisão da partida é um comando disparado por engano — e comando enviado é comando aplicado (D-020).
3. **Cor nunca é o único canal.** Posse de propriedade, jogador da vez, raridade de carta e status de conexão precisam de um segundo sinal — forma, rótulo, ícone ou texto.
4. **Movimento tem freio, e o freio não apaga informação.** `prefers-reduced-motion` é respeitado em toda animação; com movimento reduzido, a transição vira troca imediata e o **fato continua legível** (o resultado do dado, a mudança de posse, o pagamento). Nenhuma informação existe apenas na animação.

**Orientação:** o tabuleiro de 48 casas é servido em **paisagem** — tablet e celular. Em **retrato**, o produto não entrega a mesa quebrada nem finge que cabe: exibe um aviso para girar o aparelho, sem perder o estado da sessão quando a rotação acontece. Retrato não é "não suportado": é **uma orientação com uma tela própria**, que continua acessível pelas mesmas regras acima.

**Por quê:** hoje `src/` tem **85 atributos `aria-*`**, **4 `role=`**, **zero** ocorrências de `focus-visible` ou `tabIndex`, e `prefers-reduced-motion` consultado em **7 lugares** de uma interface inteira feita de animação. Não é descuido isolado — é o estado normal de uma UI construída a mouse, e cada spec nova acrescenta mais superfície sem gate nenhum. Sem um alvo verificável no CI, "acessibilidade" vira item de checklist que se marca no fim e regride na spec seguinte.

Escolher o **caminho de jogo** como fronteira do gate é o que torna a promessa sustentável. AA no app inteiro incluiria superfícies de diagnóstico que existem para o desenvolvimento (`?sons`, DebugLogger) e transformaria cada PR numa negociação com o auditor. AA onde a partida acontece cobre 100% do que um jogador usa para jogar.

A regra do Esc não é detalhe de implementação: é a diferença entre acessibilidade e perda de propriedade. A tecla que todo mundo aperta para "sair disso aqui" não pode recusar uma compra, abandonar um leilão ou dispensar uma janela de reação.

Paisagem como orientação de jogo vem da geometria, não de preguiça: o tabuleiro é quadrado e limitado pela altura da viewport (`.board-frame` em `index.css:590`). Em retrato de celular, um quadrado que caiba na largura deixa cada casa com poucos pixels — nomes ilegíveis, alvos abaixo do mínimo e uma mesa que ninguém consegue ler. Servir isso seria pior que pedir para girar.

**Alternativa descartada — subset pragmático sem gate no CI:** entrega rápido e regride em silêncio na spec seguinte. O custo do gate é uma dependência de auditoria e um job; o custo de não tê-lo é redescobrir o mesmo problema em toda feature.

**Alternativa descartada — reescrever o tabuleiro para retrato:** é redesenho do layout principal, não polimento. Se virar necessidade, é spec própria.

**Como aplicar:** a spec 044 operacionaliza. O SRS ganha a seção **§12.6 (Acessibilidade e responsividade)** e vai a v1.9. O trap de foco, a restauração de foco e a política de Esc entram no primitivo de modal, uma vez, em vez de espalhados por cada modal do §12.2 — modal novo herda o comportamento em vez de reimplementá-lo.
