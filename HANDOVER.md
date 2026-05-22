# HANDOVER — Banco Master

> Estado para continuar em um **chat novo**. Snapshot de 2026-05-24.
> Leitura de partida: este arquivo → `CLAUDE.md` → `docs/MILESTONES.md` → a spec ativa (`specs/030-.../plan.md`).

## Onde estamos

Saímos da discovery e entramos em **implementação ativa**, feature a feature, via GitHub Spec Kit (`spec → plan → tasks → implement`, com testes). O **motor de jogo (M1) está completo e testado** (`src/game/`, regras + tema oficial + §9.4 + §8.4) + uma **UI jogável** (incl. jogar cartas de mão). Auditoria SRS×código (2026-05-24): motor sem gaps de regra **single-player** — uma regra inerentemente multiplayer (§9.2 leilão do falido-ao-banco) **movida ao M3**. _(2026-05-25: escassez de construção e o leilão de casas §5.4 foram **removidos** — construção ilimitada, ver [D-022](docs/DECISIONS.md).)_ Falta: 2 modais informativos do M2, **multiplayer (M3)** e tuning pós-playtest.

**Como verificar:**
```bash
bunx vitest run tests/game  # 250 testes (motor + playersView + log + activeModal + deedView + negociação/transferência + handView + notice) — projeto usa BUN, não npm/npx
bun run build               # tsc -b + vite (deve passar, exit 0)
bun run dev                 # demo local jogável (HUD na barra de baixo)
```

## Features entregues (motor, em `src/game/`)

| # | Spec | Entregou |
|---|---|---|
| 001 | `tabuleiro-48-casas` | estrutura de 48 casas + render estático do board (`boards/`) |
| 002 | `fluxo-de-turno` | FSM pura do turno (rolar/mover/resolver/finalizar, duplas, prisão, Speed Die) + portas de resolução |
| 003 | `compra-aluguel` | compra/recusa, leilão (timer), aluguel escalonado; introduz **caixa** e **títulos** |
| 004 | `construcao` | casas/hotel, uniformidade, grupo parcial (70%) — _estoque do banco/leilão de casas removidos (D-022)_ |
| 005 | `hipoteca` | hipotecar/deshipotecar (metade + 10%), regra de transferência |
| 006 | `sistema-cartas` | 2 decks (Acaso/Tesouro), raridades, mão (limite 3, privada), saque, timing, 14 efeitos autocontidos; **D-018** propagou Surpresa→Acaso |
| 007 | `balanceamento-catchup` | **GO Progressivo** (creditado por ranking de patrimônio) + **Free Parking** (pote acumula/coleta); imposto e multa de prisão passaram a debitar de fato |
| 008 | `falencia-fim-jogo` | dívida pendente → **pagar/falir**, destino dos ativos (§9.2), eliminação, **fim de jogo** (vencedor) |
| 009 | `bus-tickets` | **uso** do ticket (§10.7: `useBusTicket`/`sideOf` em `turn/`, move pelo lado, credita GO ao cruzar) + **espaço Bus Ticket** (§2.7: parar concede +1) |
| 010 | `emprestimos` | `emprestimos/` — `grantLoan`/`payOffLoan`/`chargeLoanInterest`; `Loan` + `GameState.loans`; juros simples no GO (porta `afterPassGo`); **falência §9.3** (credor do empréstimo herda) em `falencia.ts` |
| 011 | `construcao-avancada` | estende o 004: ladder 0–7 (`cityLevel`), 2º hotel + Skyscraper via `buildHouse`/`sellBuilding`; Hangar (`buildHangar`/`sellHangar`); `rentCity` (2º hotel > 1º hotel; Skyscraper fixo + ×3 de grupo); `Title`+`hotel2/skyscraper/hangar`; **sem UI** _(estoque do banco removido — D-022)_ |
| 012 | `tax-man` | `balancing/taxMan.ts` — `rollTaxMan` move o Fiscal 1×/turno (porta `taxMan` em `advanceSeat`) e cobra do dono o aluguel (removido da economia); `GameState.taxManPos`; `defaultPorts` **sem** o Fiscal (só o store injeta — zero regressão); **sem UI** |
| 013 | `negociacao-troca` | `economy/trade.ts` — `executeTrade(state, trade)`: troca atômica de propriedades (incl. hipotecadas, taxa 10% `transferKeepFee`) + caixa entre 2 jogadores, off-turn; cidades com construção/cartas/Bus Tickets não-negociáveis; sem estado novo; **sem UI** |
| 014 | `imunidade-aluguel` | `economy/imunidade.ts` (`hasImmunity`/`tickImmunities`) + `GameState.immunities`; `Trade` estendida (`fromImmunities`/`toImmunities`); isenção em `resolveRentable`; expira no `afterPassGo`; HUD mostra status; transferência deferida |
| 015 | `cartas-efeitos-temporarios` | `economy/tempEffects.ts` + `GameState.tempEffects`; Apagão/Greve (handlers no saque), Boicote/Imunidade Temporária (`playHandCard(target)`); checagens em `resolveRentable`+`taxMan`; expira no `afterPassGo`; 4 cartas saíram de no-op (catálogo `implementado`) |
| 016 | `cartas-ofensivas` | `cards/ofensivas.ts` (`acquire`/`evict`/`audit`) despachadas por `playHandCard(target?/targetPlayer?)`; Aquisição Hostil (força venda, ×1,5 aeroporto/utilidade, taxa §6.3 se hipotecada), Despejo (−1 casa), Auditoria (10% netWorth ao pote); respeitam `isTempImmune` (015); 3 cartas → `implementado` |
| 017 | `cartas-reacao` | `cards/reacao.ts` — interrupção via `resolution` (`reaction-diplomacia`/`reaction-bunker`); Diplomacia intercepta as 4 ofensivas (em `playHandCard`), Bunker intercepta imposto (`taxBunkerResolve` no `ctx.resolve`); `respondReaction(use)`; predicados `canAcquire/canEvict/canAudit`. **0 cartas no-op** |
| 018 | `tema-cidades-do-mundo` | `src/game/theme.ts` (fonte única dos knobs econômicos; módulos derivam, exports preservados → zero regressão); aeroportos renomeados (nomes únicos); `boardData` relabelado; `docs/TEMA.md` |
| 019 | `limpeza-eliminacao` | `declareBankruptcy` (008) remove, na eliminação (§9.4): imunidades concedidas/recebidas pelo eliminado + `tempEffects` por ele originados; `Immunity` ganha `granterId` (setado no `executeTrade`). **M1 completo.** |
| 020 | `ui-paineis-ao-vivo` | **(M2 fatia 1)** `playersView(game)` (puro) + `useLivePlayers`; `PlayersPanel` e seção "Turno" do `ActionsPanel` (em `boards/shared.tsx`) consomem o store real (caixa/vez/mão/Bus Tickets/pote/Próx. GO); reuso visual total. Log/Trades seguem MOCK |
| 021 | `log-eventos` | **(M2 fatia 2)** `GameState.log` (`LogEntry {who,what}`, sem timestamp, bound 50) + `src/game/log.ts` `logEvent`. Emissões no núcleo: rolar/GO (turnMachine), compra (purchase), aluguel (resolveRentable), imposto (resolution), dívida/falência (falencia), saque (draw — **só o deck**, privacidade §10.3). Painel **Histórico** consome `[...game.log].reverse()` (MOCK_LOG removido) |
| 022 | `modais-centrais` | **(M2 fatia 3)** `src/game/ui/modals/activeModal.ts` (`activeModal(game) → ModalView \| null`, puro, testado) + `ModalLayer.tsx` (overlay central, reusa popovers). Cobre `purchase`/`auction`/`house-auction`/`card-discard`/`card-shortcut` + escolhas do Speed Die (ônibus/triple via `awaitingChoice`); o `GameHUD` deixou de tratar esses ramos. Lance = estado local; descarte só mostra a mão do jogador da vez (VI). |
| 023 | `construcao-hipoteca-ui` | **(M2 fatia 4)** gestão de propriedade pelo tabuleiro. Motor: predicados puros `canBuildHouse`/`canSellBuilding`/`canBuildHangar`/`canSellHangar` (`construction.ts`) + `canMortgage`/`canUnmortgage` (`mortgage.ts`) — comandos delegam (refactor sem mudança; 004/005/011 verdes). UI: `src/game/ui/deed/deedView.ts` (`deedView(game,pos)`, puro, 12 casos em `tests/game/ui/deedView.test.ts`) + `DeedActions` nos popovers (construir/vender/hangar/hipotecar/deshipotecar, só p/ dono da vez, com motivo do bloqueio) + `BuildingMark`/`MortgageMark` lendo `game.titles`. |
| 024 | `negociacao-ui` | **(M2 fatia 5)** negociação propor/aceitar/recusar. Motor: `Trade`/`ImmunityGrant` movidos p/ `economy/types.ts`; `validateTrade` extraído (`executeTrade` delega — **013 verde**) + `tradableProps`; `GameState.pendingTrade`; reducers `proposeTrade`/`acceptTrade`/`rejectTrade` + comandos (`tests/game/economy/negociacao-ui.test.ts`, 12 casos). UI: `src/game/ui/trade/TradeLayer.tsx` (compositor 2 colunas: propriedades+dinheiro+imunidades §8.4; modal recebido aceitar/recusar) + `useTradeUI` (store de abertura) + botão "Negociar" no `PlayersPanel`. Não gated por turno; `pendingTrade` serializável (VII); cartas/Bus Tickets fora do payload (VI). **Falta: confirmar acabamento visual no `bun run dev` (T015).** |
| 025 | `revelacao-carta` | **(M2 fatia 6)** revelação de carta sacada. `card-reveal` (ResolutionSlice) + `cardRevealResolve` (peek do topo, não muta) substitui `cardResolve` no `ctx.resolve`; `confirmCardReveal` saca/processa via o `cardResolve` **inalterado** (006 verde). Modal `card-reveal` no `ModalLayer`/`activeModal` (nome/deck/raridade/`CARD_DESC` + "Continuar"). 7 casos em `tests/game/cards/revelacao.test.ts`. **Falta: T010 visual.** |
| 027 | `trades-ao-vivo` | **(M2 fatia 8)** painel Trades real: `GameState.tradeHistory: Trade[]` (bounded 12); `acceptTrade` registra a troca + loga "fromId ↔ toId: troca aceita" (`executeTrade` intacto). `src/game/ui/trade/tradesView.ts` (`{pending, history}`, puro, testado). Painel "Trades" (em `ActionsPanel`) consome `tradesView` (pendente ativo + histórico, resumo); "+ Nova proposta" → `useTradeUI.show()`; `MOCK_TRADES`/tipo mock/`playerByName` removidos. **Falta: T009 visual.** |
| 026 | `leilao-casas-escassez` | ❌ **DESCONTINUADA (2026-05-25, D-022)** — escassez de construção removida (construção ilimitada). `economy/houseAuction.ts`, `HouseAuctionLayer`, o botão no `PlayersPanel` e `houseAuction.test.ts` foram **apagados**; `GameState.houseAuction` removido. Um leilão por escassez de _terrenos_ é outra coisa, a desenhar no futuro. |
| 028 | `transferir-imunidade` | **(§8.4 — último gap de regra)** transferir imunidade EXISTENTE numa troca (re-atribuir beneficiário, não conceder nova). `Trade += fromImmunityTransfers?: number[]`/`toImmunityTransfers?: number[]`. `validImmunityTransfers` (reusa `hasImmunity`) → `validateTrade` exige que o ofertante seja beneficiário ativo da pos. `executeTrade` re-atribui o `beneficiaryId` (from→to / to→from) **antes** das concessões novas, preservando `lapsRemaining` + `granterId`. Concessão de novas (014) inalterada. UI: `TradeLayer` ganha seção "Transferir imunidade" por lado (toggle das imunidades que o lado possui) + 🛡️➡️ no modal recebido. 6 casos novos em `negociacao-ui.test.ts`. **Falta: T007 visual.** |
| 030 | `modais-notificacao` | **(M2 — fecha o §12.2)** modais informativos "Free Parking coletado" e "Aquisição Hostil sofrida". Evento autônomo `GameState.notice: Notice \| null` (variantes `free-parking {playerId,amount}` / `hostile-takeover {victimId,attackerId,pos}`) — serializável, **não** bloqueia o turno (padrão `pendingTrade`/`houseAuction`). Hook mínimo: `collectCenter` (balancing, 007) e `acquire` (cards/ofensivas, 016) registram; `dismissNotice` (turnMachine) + comando no store limpam. `NoticeLayer` (overlay + "OK") montado no `App`. 5 casos em `tests/game/economy/notice.test.ts`; 007/016 intactos. **Falta: T010 visual.** |
| 029 | `jogar-cartas-mao` | **(M2 — fecha o gap mais grave)** painel "Minhas Cartas" + jogar cartas da mão (§12.4). **Zero mudança de motor.** Seletores puros em `src/game/ui/cards/handView.ts`: `handCardsView(game, playerId)` (lista + `playable`/`reason` por timing: reação/só-no-turno/só-preso/sem-alvo) e `cardTargets(game, playerId, cardId)` (alvos válidos reusando `reactorFor` p/ aquisição/despejo/boicote, `canAudit` p/ auditoria, `ownerOf` p/ imunidade; sem alvo → `null`). `cardMeta.ts` (RARITY_COLOR/CARD_LABEL/cardLabel/CARD_DESC) extraído do `ModalLayer` (que passa a importar). `HandPanel` (em `ActionsPanel`): cor de raridade, nome, efeito, "Usar" gated + motivo, contador X/3. `HandCardLayer` + `useHandCardUI` (overlay seletor de alvo) → `playHandCard(id, target?, targetPlayer?)`; Diplomacia já interceptada pelo motor (017). Reação (Diplomacia/Bunker) listada mas desabilitada (prompt no HUD). 11 casos em `tests/game/ui/handView.test.ts`. **Falta: T011 visual.** |
| 031 | `leilao-escassez-terrenos` | **(D-023 / SRS §7.3)** pregão SIMULTÂNEO dos últimos terrenos livres. Evento autônomo `GameState.landAuction` (+ `landAuctionArmed`) — **não** `resolution`. `economy/landAuction.ts`: `maybeOpenLandAuction` (gatilho 1≤livres≤3 + ≥2 vivos + trava de episódio), `placeLandBid` (regras §7.2 + trava de solvência `committedCash`), `closeLandAuction` (cada líder paga banco+escritura; sem lance fica livre). Store: timer próprio pelo `deadline` (padrão do 003 + `AUCTION_WINDOW`), gatilho após compra/closeAuction/finalize. `LandAuctionLayer` (modal, lotes + cronômetro + seletor de licitante) no `App`. 13 casos em `landAuction.test.ts`. **Falta: validação visual (T017).** |
| — | UI wiring | `src/game/ui/` — `GameHUD` (controle do turno; inclui seletor de Bus Ticket e pedir/quitar empréstimo) + `LiveTokens`; montados no `App.tsx`/`Board01Classic.tsx`. **Construção (004/011) não está no HUD** (M2) |

**Loop single-player local completo:** comprar → aluguel → construir → hipotecar → GO/Férias → dívida → falir → vencedor.

## Arquitetura (convenções do `src/game/`)

- **Camadas:** `turn/` (FSM), `economy/` (compra/aluguel/construção/hipoteca/leilão), `cards/`, `balancing/`, `falencia/`, `ui/`, e `store.ts` (Zustand, raiz).
- **Lógica pura:** reducers `(state) → state` que **clonam** via `structuredClone`; o **único ponto com efeito é o store** (setters + timers de leilão).
- **Serializável (princípio VII):** todo o `GameState` é JSON puro (sem refs/closures); decks/mão = ids; timers guardam `deadline`, não handles.
- **Portas** (injetadas pelo store, recebem `state`): `onPassGo`/`onPayToCenter`/`onCollectCenter` (balanceamento), `isEliminated`. O 002 **não** importa specs posteriores — elas entram pelas portas / pela composição de `ctx.resolve` (`economyResolve ?? cardResolve`).
- **Resolução de casa = "slices" pendentes** em `GameState.resolution` que bloqueiam finalizar o turno: `purchase`, `auction`, `house-auction`, `card-discard`, `card-shortcut`, `debt`, `reaction-diplomacia`, `reaction-bunker` (017).
- **RNG injetável** (`ctx.rng`) → testes determinísticos. `bunx vitest run tests/game`.
- **UI (022.1 — fluxo automático):** a rolagem é o **`DiceArena`** central (dispara `rollDice`, faces/vez reais, gated pelo turno). O **`GameDriver`** (`src/game/ui/GameDriver.tsx`, headless) faz o turno **ir sozinho**: chama `resolvePending` (aluguel/imposto/carta resolvem e logam) e `finalizeTurn` automaticamente; só pausa em decisão real — modal central (`ModalLayer`, 022: compra/leilão/descarte/atalho) ou prompt do **HUD** enxuto (`GameHUD`: prisão/dívida/reação + opções pré-rolagem Bus Ticket/quitar empréstimo; some quando não há decisão). **`DebugLogger`** (`src/game/ui/DebugLogger.tsx`, dev): joga o estado no **console do browser** a cada mudança (resumo + objeto `game` inteiro + novas entradas do log). **Fix:** grupo `purple` (tema Cidades do Mundo, 9 grupos) faltava em `GROUP_COLOR`/`HOUSE_COST` → quebrava `fmtMoney`; adicionados + `fmtMoney` blindado + modal usa `buildCost` do motor. **Speed Die ônibus/triple agora têm UI:** `activeModal` cobre `turn.awaitingChoice` → modais `bus-move` (dado A/B/soma) e `triple-dest` (lista de casas) no `ModalLayer`, chamando `chooseBusMove`/`chooseTripleDest` (gap anterior fechado). Carta imediata loga o nome (público §12.2); carta de mão só o deck (§10.3). `PlayersPanel`/Histórico (020/021) seguem ao vivo. **`LiveTokens` (022.1):** peão **anda casa a casa** — posição "exibida" por jogador avança de 1 em 1 até `player.pos` (passo 150ms), cada passo animado por `motion` `layout` (1 motion.div/jogador, key estável, offset de empilhamento). Movimento grande/para trás (teleporte, volte-3) dá snap direto. **Construção/hipoteca (023):** clicar a própria propriedade abre o popover com `DeedActions` (construir/vender/hangar/hipotecar/deshipotecar) via `deedView`; `BuildingMark`/`MortgageMark` refletem `game.titles`. Ainda **mock**: painel **Trades**. **Negociação/transferência (trade)** só via comando do store (sem UI).

## Pendências e itens DEFERIDOS (o backlog real)

**Regras do motor:**
- **Sistema de cartas: COMPLETO** — **0 cartas no-op** no catálogo (todas as 32 implementadas após 015/016/017). Deferido: Bunker sobre "Auditoria recebida" (Diplomacia já cobre) e o **timer de 10s** da reação (UI/M2).
- **Negociação: COMPLETA** (troca no 013 + concessão de imunidade no 014 + **transferência de imunidade existente no 028**).
- **Transferência de imunidade existente** (§8.4 "transferíveis"): **ENTREGUE no 028** — `Trade.fromImmunityTransfers`/`toImmunityTransfers` re-atribuem o `beneficiaryId` de uma imunidade ativa preservando voltas + `granterId`. **Não há mais gaps de regra no motor.**
- **Balanceamento: COMPLETO** (Speed Die, GO Progressivo, Free Parking, Bus Tickets, Hangar, Skyscraper, 2º hotel, Tax Man — todos entregues).
- **Tema "Cidades do Mundo": OFICIALIZADO** (018) — knobs centralizados em `src/game/theme.ts` (tunável num ponto só); ficha em `docs/TEMA.md`. Rebalanceamento real fica como tuning pós-playtest (editar `theme.ts`).

**Simplificações documentadas (revisitar):**
- Cartas de **movimento** mudam a posição mas **não auto-resolvem** a casa de destino (006).
- **Leilão dos bens da falência-ao-banco** (§9.2): simplificado para "volta ao banco"; leilão real fica no M3. _(O leilão de casas §5.4 foi removido — D-022.)_
- **Bus Ticket em utilidade** (009): destino utilidade alcançado por ticket cobra **$0** (`diceValue(null)===0`, sem rolagem). Raro; revisitar se virar problema de balanceamento (research R6).
- **Tax Man — dono sem caixa** (012): o Fiscal debita o que houver (sem caixa negativo); **não fale** um jogador (que pode ser não-ativo) — falência cross-player fora do modelo do 008 (research R7). O dinheiro é **removido** (banco), não vai ao pote.
- **Empréstimo — juros no GO sem caixa** (010): se o juro de GO excede o caixa pós-bônus, abre `debt` ao credor; no overlap raro de também pousar em aluguel impagável no mesmo GO-pass, o slot único fica com a dívida de juros e a casa de pouso não é re-resolvida (research R5). Credor eliminado antes da quitação → empréstimo perdoado (R8).

**Produto:**
- **M2 (UI jogável): FECHADO** — painéis ao vivo, modais de resolução, token animado, construção/hipoteca/negociação pelo tabuleiro, **jogar cartas de mão** (029) e os **modais informativos do §12.2** (030) prontos. Falta só validação visual no `bun run dev` (T010 da 030) + acabamento.
- **Multiplayer / Supabase / Lobby / Sessão & Resiliência** (M3 do MILESTONES, **redesenhado** 2026-05-24; **ADRs travados**: [D-019](docs/DECISIONS.md) auth anônima por link + [D-020](docs/DECISIONS.md) host-autoritativo + Realtime + snapshot) — nada de código começado. **Próximo passo natural = fatia 1 (infra Supabase)**, que depende de credenciais/projeto seu; caminho credential-free = scaffold do transporte de comandos (D-020). Inclui §9.2 (leilão do falido-ao-banco).

## Estado do Git

- **160 commits**, todos em `main` (o projeto não usa branches de feature — trabalha em `main`); incluem até o 017.
- Histórico criado via skill **`/micro-commits`** (datas backdatadas aleatórias **espalhadas** pelos últimos 6 meses, identidade `Nikolas Santana <nikolasdssantana@gmail.com>`, mensagens em **inglês** emoji+conventional).
- **NÃO foi feito push** — o usuário faz o push manualmente (`git push origin main`).
- **018–030 ainda NÃO commitados** — working tree sujo (até o 017 commitado, 160 commits). Rodar `/micro-commits` quando o usuário pedir.
- ⚠️ **Usar `bun`**, nunca npm/npx (rodar npm gera `package-lock.json` indevido — já existe um commitado, o usuário optou por mantê-lo).

## Como continuar (workflow desta sessão)

1. **Por feature:** `/speckit-specify` → (clarify quando houver ambiguidade real, via perguntas) → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Tudo confirmado pelo usuário ("pode continuar" = conduza o pipeline inteiro).
2. **`.specify/feature.json`** rastreia a feature ativa (hoje aponta para `030`); o marcador `<!-- SPECKIT -->` no `CLAUDE.md` aponta para o `plan.md` ativo.
3. **Regra crítica (CLAUDE.md):** antes de `/speckit-specify`, ler constitution + SRS (seção da feature) + DECISIONS + specs dependentes.
4. **Commits:** ao final, rodar `/micro-commits` (backdated, **sem push**) quando o usuário pedir.
5. **Numeração de specs:** sequencial; a próxima é `031`.

**Motor (M1): COMPLETO. M2 (UI) iniciado** (020 = painéis ao vivo; 021 = log/Histórico real; 022 = modais centrais dirigidos por resolução). **Próximas fatias do M2** (impacto): **token animado** (`LiveTokens` a partir de `player.pos`) · **construção/hipoteca/negociação na UI** (iniciadas pelo jogador) · **revelação de carta imediata** (exige novo estado no motor) · painel **Trades** ao vivo · (log: estender `logEvent` a construção/hipoteca/trade/loan/reação — one-liner cada). Depois: **Multiplayer/Sessão (M3)** · rebalance pós-playtest (motor sem gaps de regra — §8.4 fechado no 028). **UI precisa de validação visual no `bun run dev`** (não tenho como ver a tela) — pendente o acabamento dos modais/compositor.

## Ponteiros

- `docs/MILESTONES.md` — roadmap atualizado (reflete exatamente este estado).
- `docs/SRS.md` — fonte de verdade das regras (§ citados nas specs).
- `docs/DECISIONS.md` — ADRs (até D-018, "Acaso").
- `specs/00N-*/` — spec/plan/tasks/quickstart de cada feature.
- Memória persistente (carrega sozinha no chat novo): atualizada para refletir a fase de implementação.
