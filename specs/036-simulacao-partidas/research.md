# Research: Simulação Automatizada de Partidas (Test Harness)

Fase 0 — decisões técnicas. As 3 ambiguidades de produto já foram fechadas em `/speckit-clarify`
(seção "Clarifications" do spec). Restam decisões de **arquitetura de harness**, resolvidas aqui.

## D1 — Como dirigir o motor sem o Zustand/timers reais

- **Decisão**: o harness **não** usa `useGameStore` (Zustand). Ele reimplementa, num módulo próprio
  (`tests/sim/engine/driver.ts`), o mesmo mapeamento comando→reducer que `src/game/store.ts` já faz
  (ex.: `rollDice(game, ctx)`, `buildHouse(game, pos)`, `executeTrade(game, trade)` — todas as
  funções importadas por `store.ts` são puras e reutilizáveis diretamente). O "estado" do harness é
  só `{ game: GameState, ctx: TurnCtx }` mutado por reatribuição, sem `set()`/React/timers.
- **Rationale**: o store existe para ligar reducers puros ao React (efeitos: `setTimeout` dos
  leilões, `Date.now()`). O harness headless não tem UI nem precisa de tempo real — precisa dos
  MESMOS reducers com um `now()` controlável. Duplicar as ~30 chamadas do store é o preço de não
  acoplar o motor de testes ao Zustand/timers (que travariam a simulação em segundos reais).
- **Alternativas**:
  - Rodar o `useGameStore` real e usar `vi.useFakeTimers()`: acopla o harness ao React/Zustand e à
    ordem de microtasks do store; frágil a cada novo timer futuro — descartado.
  - Expor os reducers atrás de uma nova camada "action bus" dentro de `src/game/`: tocaria em código
    de produção só para servir ao teste (viola FR-012) — descartado.

## D2 — Relógio lógico (deadlines de leilão sem espera real)

- **Decisão**: `ctx.now()` do harness é um contador lógico (`number`) controlado pelo próprio
  harness, não `Date.now()`. Quando não resta ação de lance válida num leilão de propriedade (todos
  os `activeBidders` deram pass) ou num lote do pregão de terrenos (031) sem novos lances possíveis,
  o harness **avança o relógio lógico até o `deadline`** e chama `closeAuction`/`closeExpiredLandLots`
  diretamente — sem `setTimeout`, sem esperar de verdade.
- **Rationale**: os reducers de leilão (`auction.ts`, `landAuction.ts`) só comparam `now` numérico
  contra `deadline`; não exigem relógio de parede. Isso mantém partidas de centenas de turnos em
  milissegundos (SC-002).

## D3 — Seed única e reprodutibilidade (FR-003)

- **Decisão**: PRNG determinístico local, sem dependência nova — `mulberry32(seed: number): RNG`
  (função geradora de 32 bits, ~8 linhas), casando com o tipo `RNG = () => number` já usado por
  `turn/dice.ts`. **Uma única instância de RNG por partida**, compartilhada em ordem sequencial fixa
  por: embaralhar os decks (`weightedShuffle`), `ctx.rng` da máquina de turno (dados), e a política
  do agente (escolher ação entre as válidas) + sorteio da sonda inválida do turno (clarify Q3). Como
  tudo é síncrono e a ordem de chamadas é determinística dado o mesmo fluxo de regras, uma única
  seed ⇒ mesma sequência de números ⇒ mesma partida (FR-003/SC-003).
- **Rationale**: o motor já injeta RNG por parâmetro (nunca `Math.random()` direto nos reducers
  exercitados aqui) — o harness só precisa fornecer uma fonte seedada e não deixar vazar
  `Math.random()` em nenhum ponto do caminho de simulação (inclusive o embaralhamento inicial dos
  decks, que em `freshGame()` usa `Math.random()` "de verdade" — o harness usa `createSeedState` +
  `weightedShuffle` com a própria seed em vez de `freshGame`).
- **Alternativas**: sub-streams derivados por hash (`seed, label`) para desacoplar dados de decisões
  de agente — desnecessário: acopla determinismo a uma ordem fixa por design (mais simples de
  auditar/depurar um replay linha a linha) — mantido como possível refino futuro, não bloqueia P1/P2.

## D4 — Modelo de decisão: enumerar ações válidas por decisor

- **Decisão**: o "jogador da vez" nem sempre é quem deve agir a seguir. O harness modela um
  **loop de decisão por tick**:
  1. Se há uma resolução que **bloqueia o turno** e exige resposta de um jogador específico
     (`resolution.kind` ∈ `debt`, `card-discard`, `card-shortcut`, `card-reveal`,
     `reaction-diplomacia`, `reaction-bunker`, `purchase`, `auction`; ou `pendingLoan` aberto), esse
     jogador (nem sempre o `activePlayer` — ex.: o reator de uma reação é o alvo, não quem jogou a
     carta) é o **decisor obrigatório**: enumera-se só as ações válidas dele e sorteia-se uma.
  2. Sem bloqueio pendente, e com o turno em estado "livre" (`aguardando-rolagem`,
     `aguardando-finalizacao`, `prisao-decisao`), o harness dá, **antes** da ação do jogador ativo,
     uma chance (probabilidade fixa por tick, seedada) de um jogador não-ativo tomar uma ação
     **fora de turno**: propor troca, responder a uma troca pendente endereçada a ele, dar lance
     num lote do pregão de terrenos aberto. Isso evita starvation do turno enquanto ainda exercita
     esses caminhos (US1 cenário 4).
  3. Só então o jogador ativo escolhe entre as ações válidas do seu ponto de decisão do turno.
  - Catálogo de ações candidatas (`SimAction`) e a função `enumerateActions` ficam em
    `tests/sim/engine/actions.ts` — ver `data-model.md`.
- **Rationale**: reflete fielmente o que `store.ts` expõe (nenhuma ação é "do turno" por
  construção — `executeTrade`/`proposeTrade`/`respondLoan`/lances de terreno não checam
  `activeSeat`). Enumerar por decisor (não por "jogador da vez") é o único jeito de FR-002 cobrir
  o repertório completo sem travar em decisões cruzadas (aceitar troca, responder empréstimo,
  reagir a ofensiva).
- **Alternativas**: só o jogador ativo age, trocas/leilão de terreno desligados no harness — deixaria
  de exercitar mecânicas inteiras (026/031/013) contra fuzzing — rejeitado, contraria US1.

## D5 — Sonda de ação inválida (clarify Q3)

- **Decisão**: catálogo fixo de "ações deliberadamente inválidas" (`tests/sim/engine/invalidProbe.ts`),
  uma por família de comando (comprar sem oferta pendente, lance abaixo do atual, hipotecar
  propriedade alheia, jogar carta fora da mão, decisão de prisão fora de `prisao-decisao`, finalizar
  turno com resolução pendente, etc. — ver `data-model.md`). A cada turno resolvido, o harness
  sorteia 1 entrada do catálogo (mesma seed da partida), aplica sobre um clone do estado ANTES da
  ação real do turno, e afirma: (a) o reducer não lança exceção e (b) o estado resultante é
  **idêntico** (deep-equal) ao estado antes da sonda — nenhuma mutação vaza mesmo em no-op.
- **Rationale**: opera exatamente como a clarificação define — 1 sonda/turno, seedada, sem
  interferir no fluxo real (roda sobre clone descartável).

## D6 — Invariantes de estado (FR-004 a–g)

- **Decisão**: `checkInvariants(state, prevState?): Violation[]` roda ao fim de cada turno
  resolvido (após `finalizeTurn`/eliminação), cobrindo literalmente FR-004(a–g). Ver tabela em
  `data-model.md`. Conservação de transferências (FR-004b) compara `prevState` vs `state` só nos
  jogadores envolvidos numa transferência P2P identificada pelo log do turno (não soma global —
  Assumption "conservação de dinheiro").
- **Rationale**: checar comparando com o estado anterior (não só invariantes "absolutos") é
  necessário para (b) conservação de transferências — não dá para validar isso olhando um único
  snapshot.

## D7 — Teto de rodadas e detecção de vencedor

- **Decisão**: contador de "rodadas completas" incrementado sempre que `advanceSeat` fecha um ciclo
  em `turnOrder` (volta ao índice 0). Teto default 300 (Assumption), configurável por parâmetro do
  runner. Vitória = `game.phase === 'ended'` (já setado por `checkEndGame` em `falencia.ts`) com
  exatamente 1 `!eliminated` — reaproveita a regra existente, o harness não reimplementa fim-de-jogo.
- **Rationale**: zero lógica nova de vitória — só observa o campo que o motor já mantém (princípio I:
  motor é a fonte de verdade; harness só exercita).

## D8 — Paralelismo e orçamento de tempo (SC-002: lote de 300 partidas < 2 min)

- **Decisão**: o lote padrão headless é dividido em **arquivos de teste "shard"** por contagem de
  jogadores (`tests/sim/headless/2p.test.ts`, `3p.test.ts`, `6p.test.ts`), cada um rodando as 100
  seeds daquela contagem num loop síncrono dentro de um único `test()`. Isso deixa o Vitest paralelizar
  os 3 arquivos entre workers (paralelismo por arquivo é o padrão do Vitest; paralelismo dentro de um
  arquivo não ajuda trabalho síncrono ligado a CPU). Se o benchmark na máquina de dev não couber em
  2 min com 3 shards, particionar mais (ex.: 4 arquivos por contagem = 12 shards) — decisão de
  ajuste fino tomada na implementação, medindo o tempo real.
- **Rationale**: o motor já usa `structuredClone` por comando (custo por ação); com centenas de
  partidas isso é o único risco real de performance da feature. Particionar por arquivo é a forma
  mais simples de obter paralelismo real no Vitest sem configuração de pool.
- **Alternativas**: rodar tudo num `test.concurrent` dentro de 1 arquivo — não paraleliza CPU-bound
  síncrono (mesma thread) — descartado. Usar worker_threads manuais dentro do teste — complexidade
  desproporcional para o dev-only desta feature — descartado por ora.

## D9 — Ferramenta de smoke E2E (US3)

- **Decisão**: **Playwright** (`@playwright/test`), nova devDependency. Projeto novo, top-level
  `e2e/` (fora de `tests/`, que é escopo Vitest via `include: ['tests/**/*.test.ts']`), config
  `playwright.config.ts` na raiz, specs `e2e/*.spec.ts` (extensão distinta evita qualquer colisão de
  glob com o Vitest).
- **Rationale**: é o padrão de facto para Vite + React (auto-wait, seletores por role/texto,
  trace/vídeo em falha — útil para depurar smoke frágil), suporta os 3 browsers engines se um dia
  for preciso, e roda headless em CI. `@playwright/test` é devDependency pura — não entra no bundle
  (FR-012).
- **Alternativas**: Cypress (menos idiomático para multi-tab/multi-perfil, EE features pagas para
  paralelismo) — descartado. Testar via `jsdom`/RTL: não é E2E de browser real, não cobre o que a
  US3 pede (animações, modais reais) — descartado.

## D10 — "Roteiro fixo determinístico" do E2E (clarify Q2)

- **Decisão**: "fixo determinístico" = **mesma política de decisão a cada execução**, não "mesmos
  cliques exatos" — os dados são reais (`Math.random()` do jogo em produção, não seedado no E2E).
  A política é uma regra simples e estável por tipo de modal (ex.: "se aparecer oferta de compra e
  o caixa cobre, comprar; senão recusar", "nunca propor troca", "nunca jogar carta ofensiva",
  "sempre confirmar revelação de carta", "encerrar o turno assim que possível") aplicada por um
  helper `e2e/script.ts` reusado nos 3 specs (2/3/6 jogadores). Mesma sequência de TIPOS de
  interação em toda execução; fuzzing de regras continua exclusivo da camada headless (US1).
- **Rationale**: resolve a ambiguidade da clarificação sem exigir seed no `Math.random()` de
  produção (que a UI real não expõe nem deveria, por escopo — FR-013).

## D11 — Onde vive o CLI de replay/lote maior (FR-008/FR-009)

- **Decisão**: dois scripts bun executáveis diretamente (`bun run scripts/sim-replay.ts` /
  `scripts/sim-batch.ts`), reexportando as mesmas funções de `tests/sim/engine/*` usadas pelos
  testes — nenhuma duplicação de regra. `package.json` ganha `"sim:replay"` e `"sim:batch"`.
- **Rationale**: FR-009 pede depuração "com um comando" — um script bun roda fora do runner de
  testes (sem overhead do Vitest, com saída verbosa/trace), e FR-008/Assumption ("lotes maiores em
  execuções noturnas") pedem um tamanho configurável que não faz sentido fixar num `test()`.
