# D-065 — O Fiscal sai do jogo

**Data:** 2026-07-29 · **Status:** aceita · **Revoga:** o Fiscal / Tax Man (SRS §13.8, spec 012) · **Revoga parcialmente:** [D-063](D-063-toda-mutacao-de-caixa-tem-causa-registrada.md) (o fato `tax-man` deixa de ser emitido)

**Decisão:** o **Fiscal** sai do jogo. Não existe mais token do banco andando pelo tabuleiro na passagem de turno, nem cobrança do dono pela casa em que ele parar. Somem com ele `state.taxManPos`, a porta `taxMan` do `TurnCtx` e o módulo `balancing/taxMan.ts`.

**O que motivou:** o Fiscal era a causa raiz de **três** relatos independentes de bug financeiro do playtest — "perdi dinheiro quando não era minha vez", "perdi 200 fora da vez" e "as contas oscilam" — e de um quarto pela porta dos fundos ("perdi dinheiro quando o leilão acabou": o leilão fechava, a vez passava no comando seguinte, e o Fiscal corria ali).

A [D-063](D-063-toda-mutacao-de-caixa-tem-causa-registrada.md) tratou isso como problema de **narração**, e o diagnóstico estava certo: a cobrança era legítima e completamente muda. Narrar resolveu o "não sei de onde saiu". Não resolveu o problema real, que o playtest expôs em seguida: **mesmo narrado, o jogador não entende o que está acontecendo.** Uma linha no histórico dizendo que um token invisível parou numa propriedade sua e cobrou imposto durante o turno de outra pessoa é informação, não compreensão.

**Por que ele era incompreensível — e isto não é opinião:**

1. **O token nunca existiu na tela.** O SRS §13.8 define o Fiscal como "token especial controlado pelo banco", e nenhuma superfície do jogo o desenhava. O jogador não tinha como ver a peça andar, nem prever onde ela ia parar, nem entender que existia uma peça. A mecânica pedia um objeto no tabuleiro e nunca ganhou um.
2. **Ele age no único instante em que ninguém está olhando.** Roda dentro da passagem de turno — entre o fim de uma jogada e o começo de outra, quando a atenção da mesa está trocando de dono.
3. **Ele cobra de quem não agiu.** É a única regra do jogo que debita um jogador sem nenhuma ação dele, e sem nenhuma ação de ninguém contra ele. Aniversário, Crise, Imposto Federal e Aquisição também cobram fora da vez, mas todas nascem de uma **carta que alguém jogou** — há um autor, e o autor é público.
4. **O dinheiro é destruído.** Não vai à Loteria, não vai a um adversário. Some da mesa. Não há nem para onde rastrear.

Quatro propriedades que, somadas, produzem exatamente a experiência de estar sendo roubado. Consertar a quarta com uma frase de log é tratar o sintoma mais barato.

**Custo aceito — o dreno econômico e a alavanca de catch-up somem, e nada entra no lugar.** Isto é o ponto honesto da decisão, e ele é grande:

- O Fiscal era o **principal sumidouro de dinheiro** do jogo depois dos impostos de casa. Sem ele, mais caixa fica em circulação, os jogadores ficam solventes por mais tempo e a partida tende a **alongar** — o mesmo efeito que a [D-060](D-060-leilao-de-escassez-restaurado-com-janela-legivel.md) acabou de pagar para evitar.
- Era também a única alavanca de **catch-up** que agia sobre patrimônio em vez de caixa (princípio IV): quanto mais propriedade caro-alugada um jogador tinha, mais ele pagava. Some a única regra que punia dominar o tabuleiro.
- **Nenhum substituto entra agora**, e inventar um seria repetir o erro que a D-059 cometeu e a D-060 corrigiu — legislar sobre ritmo com um mecanismo novo, no mesmo passo em que se remove outro, sem dado de playtest sobre o resultado.

Se o desequilíbrio aparecer, o caminho é uma decisão nova com números medidos. As alavancas mais baratas a testar primeiro, na ordem: **imposto de casa** (§4.5, já visível e compreendido), **custo de passar pelo GO** e a **Loteria** — todas mecanismos que o jogador já vê funcionando. Um evento que interrompe ou um token invisível não voltam à mesa.

**Por que o `LogKind` `tax-man` FICA no tipo:** partida gravada antes desta decisão tem entradas `tax-man` no log. `normalizeLog` só converte para `legacy` o que não tem `kind`; uma entrada com `kind: 'tax-man'` passaria direto e estouraria no `assertNever` do descritor — quebrando a tela de quem reabrisse a sala. O kind continua descrito, com ícone e som; o que sai é o **emissor**. Mesmo padrão que a [D-064](D-064-rebalanceamento-do-catalogo-de-cartas.md) usou para `evict`.

**Como aplicar:** SRS v1.27 — §13.8 vira nota de remoção (a seção não é renumerada: os ids de §13 são citados em código e ADRs), §13.1 perde o Fiscal da lista de remédios, §9.1 perde a linha dele da tabela de cobranças que truncam, §12.3 deixa de citá-lo como exemplo de débito fora da vez, e a tabela de decisões da §1.4 registra a remoção. Motor — `balancing/taxMan.ts` sai; `taxManPos` sai do `GameState` e do `setup`; a porta `taxMan` sai de `TurnPorts` e a chamada sai de `advanceSeat`. Snapshot anterior traz `taxManPos`, e campo a mais não quebra desserialização. Simulação — o checker `applyTaxMan` e os mecanismos `taxman-*` saem de `conservation.ts`; os testes que exercitavam imunidade e Boicote **através** do Fiscal passam a exercitá-los pelo caminho de aluguel normal (`economyResolve`), que é onde a regra de fato vive.
