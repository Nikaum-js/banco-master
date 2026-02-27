# Research — Leilão de escassez de terrenos (031)

Não restou nenhum `NEEDS CLARIFICATION` da spec (design fechado na discovery). Este documento consolida as **decisões técnicas** e o reuso de padrões existentes.

## R1 — Evento autônomo vs. resolução de turno

- **Decisão:** o pregão vive em um campo próprio `GameState.landAuction` (autônomo), **fora** de `state.resolution`.
- **Rationale:** o leilão de propriedade do 003 vive em `resolution` e seu fechamento chama `completeResolution` (avança o turno) — acoplado à vez. A spec exige que abrir/fechar o pregão **não** toque no turno (FR-002, SC-005). O padrão certo é o de `pendingTrade` (024) e `notice` (030): evento serializável paralelo ao turno.
- **Alternativas:** reusar `resolution.kind:'auction'` → rejeitado (acopla ao turno e é single-lote; foi exatamente o bug do antigo leilão de casas, removido na D-022).

## R2 — Estrutura simultânea (N lotes, 1 prazo)

- **Decisão:** `LandAuction { lots: LandLot[]; deadline: number; bidders: string[] }`, onde `LandLot { pos; currentBid; highBidder }`. Um único `deadline` compartilhado.
- **Rationale:** "fecham juntos" (FR-004) → um prazo só. Cada lote guarda seu próprio lance/líder (leilões ingleses paralelos).
- **Alternativas:** um `deadline` por lote (fechamento escalonado) → rejeitado, contraria "fecham juntos" e complica a UI.

## R3 — Cronômetro / soft-close (reuso do 003)

- **Decisão:** `deadline` em epoch ms (serializável); cada lance válido faz `deadline = now + AUCTION_WINDOW`. O store agenda **um** `setTimeout` para `closeLandAuction`, recomputado a cada mudança pelo `deadline` (igual ao leilão 003 em `store.ts`). `now` injetado (`ctx.now()`), determinístico em teste.
- **Rationale:** Princípio VII — timer reconstruível na reconexão; padrão já validado no 003.
- **Janela:** reusar `AUCTION_WINDOW` (`purchase.ts`, 10_000 ms) — knob de tema único para os dois leilões. (Se quisermos janela diferente p/ o pregão, vira um `LAND_AUCTION_WINDOW` no `theme.ts`; default = reusar.)

## R4 — Trava de solvência (arrematar vários)

- **Decisão:** lance em `pos` por `playerId` por `amount` é válido sse:
  1. `playerId ∈ bidders`;
  2. `amount ≥ minBid` (lance mínimo do tema) e `amount > lot.currentBid`;
  3. `committedOutros + amount ≤ caixa`, onde `committedOutros = Σ lot.currentBid` dos **outros** lotes em que `playerId` já é `highBidder`.
- **Rationale:** garante que todo vencedor paga a soma dos lotes arrematados sem ficar negativo (FR-006, SC-003). Ser coberto em um lote reduz `committedOutros`, liberando caixa naturalmente.
- **Alternativas:** "cada lance ≤ caixa" isolado (como o 003) → rejeitado: permitiria liderar 3 lotes somando mais que o caixa e quebrar no fechamento.

## R5 — Gatilho e trava de episódio

- **Decisão:** `maybeOpenLandAuction(state, now)` abre o pregão sse: `freeLots(state).length ≤ THRESHOLD` (=3) **e** `vivos ≥ 2` **e** `landAuction == null` **e** episódio "armado". Chamado no **store** após: compra concluída, fechamento do leilão 003, e finalização de turno (pontos onde a posse muda). Após falência (terreno volta ao banco → `freeLots` sobe), o episódio **re-arma**.
- **Episódio:** flag `landAuctionArmed: boolean` no estado. Inicia `true`. `closeLandAuction` → `false`. Sempre que `freeLots > THRESHOLD` (checado no `maybeOpen`), re-seta `true`. Assim dispara 1×/descida; sobras sem lance não reabrem; falência re-arma (FR-011, SC-006).
- **Rationale:** evita reabertura em loop sobre os mesmos sobrados; só novo episódio (subida→descida) re-dispara.
- **`freeLots`:** terrenos `kind ∈ {property, airport, utility}` com `ownerId == null`. (28+4+3 = 35 compráveis.)

## R6 — Onde plugar o gatilho

- **Decisão:** no `store.ts`, envolver os comandos que mudam posse (`buy`, `closeAuction`, `finalizeTurn`) para, após aplicar, chamar `maybeOpenLandAuction(game, now)` e, se abriu, agendar o timer. Mantém os reducers do núcleo puros (o trigger é puro; o agendamento é efeito do store).
- **Rationale:** mesmo lugar onde o 003 já agenda o timer de leilão; coeso. O motor (002) não importa specs posteriores — o trigger entra pela composição do store, como as portas.
- **Alternativas:** chamar dentro de `purchase`/`closeAuction` (reducers) → exigiria `now` puro; preferimos manter o efeito de tempo no store.

## R7 — UI (modal autônomo)

- **Decisão:** `LandAuctionLayer` (em `ui/landAuction/`), montado no `App` junto de `TradeLayer`/`NoticeLayer`; lê `game.landAuction`. Mostra cada lote (nome/grupo via board + lance + maior licitante), tempo restante (do `deadline`), botões de lance por lote, e um seletor "lance por: [jogador vivo]" (single-client). Reusa estilos dos popovers/modais existentes.
- **Rationale:** consistente com os outros eventos autônomos; sem tocar no `activeModal`/`resolution`.

## R8 — Documentação (SRS + ADR)

- **Decisão:** adicionar em **SRS §7** um item em "7.1 Quando ocorre" (escassez de terrenos) + nova subseção "7.x Leilão de escassez de terrenos (pregão simultâneo)" com as regras. Registrar **D-023** em DECISIONS (gatilho, formato simultâneo, cronômetro, trava de solvência, sem-lance-fica-livre; referencia D-022 para contrastar com o leilão de casas removido).
- **Rationale:** Princípio I — a regra nasce no SRS; a spec operacionaliza.
