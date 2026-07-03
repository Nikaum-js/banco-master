# Data Model: Simulação Automatizada de Partidas

> Estas entidades vivem **inteiramente em `tests/sim/` e `scripts/`** (dev-only). **Nenhuma
> mudança no `GameState`** de produção (`src/game/turn/types.ts`) — o harness é um consumidor
> externo do motor, como já afirma a spec (§ "Conformidade com a constitution").

## SimAction (`tests/sim/engine/actions.ts`)

União discriminada que espelha 1:1 os comandos expostos por `src/game/store.ts` (cada variante
carrega os args do reducer que ela chama). Cobre o repertório completo exigido por FR-002:

| Grupo | Variantes (`kind`) | Reducer chamado |
|---|---|---|
| Turno | `roll`, `finalize`, `jail-decision`, `choose-bus-move`, `choose-triple-dest`, `use-bus-ticket` | `turnMachine.ts` |
| Casa/compra | `resolve-pending`, `buy-property`, `decline-property` | `resolution.ts`/`purchase.ts` |
| Leilão de propriedade | `place-bid`, `pass-bid` | `auction.ts` |
| Pregão de terrenos (031) | `place-land-bid` | `landAuction.ts` |
| Construção | `build-house`, `sell-building`, `build-hangar`, `sell-hangar` | `construction.ts` |
| Hipoteca | `mortgage`, `unmortgage` | `mortgage.ts` |
| Cartas | `play-hand-card`, `discard-card`, `choose-card-shortcut`, `confirm-card-reveal`, `respond-reaction` | `draw.ts`/`reacao.ts` |
| Dívida/falência | `pay-debt`, `declare-bankruptcy` | `falencia.ts` |
| Empréstimo | `propose-loan`, `respond-loan`, `pay-off-loan` | `emprestimos.ts` |
| Troca | `propose-trade`, `accept-trade`, `reject-trade` | `trade.ts` |

`enumerateActions(state, ctx): DecisionPoint | null` — ver abaixo — é a única função que produz
`SimAction[]`; nenhum outro código do harness monta ações à mão (garante que o catálogo nunca
diverge do que os reducers realmente aceitam).

## DecisionPoint

```
interface DecisionPoint {
  actorId: string          // jogador que deve decidir agora
  mandatory: boolean        // true = bloqueia o turno até responder (resolution/pendingLoan)
  actions: SimAction[]      // sempre não-vazio quando mandatory=true (senão a partida trava)
}
```

`enumerateActions` aplica a prioridade descrita em `research.md` D4:

1. Resolução bloqueante ativa → 1 `DecisionPoint` obrigatório para o `actorId` certo:
   - `resolution.kind === 'debt'` → devedor (`payDebt`/`declareBankruptcy`/`proposeLoan` se ainda
     sem `pendingLoan`)
   - `pendingLoan !== null` → credor da proposta (`respond-loan`)
   - `resolution.kind === 'purchase'` → jogador ativo (`buy-property`/`decline-property`)
   - `resolution.kind === 'auction'` → cada `activeBidders` (um `DecisionPoint` por licitante ainda
     ativo; ver nota de concorrência abaixo)
   - `resolution.kind ∈ {'card-discard','card-shortcut','card-reveal'}` → jogador ativo
   - `resolution.kind ∈ {'reaction-diplomacia','reaction-bunker'}` → `reactorId` (pode ≠ jogador ativo)
2. Sem bloqueio + turno em estado livre → `DecisionPoint`s **opcionais** (`mandatory:false`) para
   cada jogador não-eliminado com ação fora-de-turno disponível: `propose-trade` (a qualquer outro
   jogador), `accept-trade`/`reject-trade` (se `pendingTrade.toId === ele`), `place-land-bid` (se
   `landAuction` aberto e ele é `bidders`).
3. Sempre, por fim, o `DecisionPoint` do jogador ativo para o estado do turno
   (`aguardando-rolagem` → `roll`/`use-bus-ticket`; `prisao-decisao` → `jail-decision`;
   `casa-a-resolver` sem `awaitingChoice` → `resolve-pending`; `aguardando-finalizacao` →
   `finalize`/`build-*`/`mortgage`/`unmortgage`/`play-hand-card`/`use-bus-ticket`).

**Concorrência do leilão de propriedade**: como só há 1 leilão por vez e cada lance reinicia o
prazo, o loop do harness, a cada tick de leilão, sorteia 1 licitante ativo por vez para agir
(`place-bid` ou `pass-bid`) até sobrar ≤1 ativo ou ninguém mais bidar — então fecha via D2 (relógio
lógico).

## InvariantCheck (FR-004a–g) — `tests/sim/engine/invariants.ts`

| Código | Regra | Onde é lido |
|---|---|---|
| `a` | Todo `player.cash` é número finito e ≥ 0, exceto durante uma `resolution.kind === 'debt'` aberta (dívida prevista pelas regras) | `players[].cash` |
| `b` | Toda transferência P2P identificada no turno conserva a soma (quem paga X, o outro recebe X) | diff `prevState`↔`state` para os 2 IDs envolvidos (troca/aluguel/empréstimo/juros) |
| `c` | Estoque global de casas/hotéis nunca negativo nem excede o total do tema (`THEME`) | `titles[].houses/hotel/hotel2/skyscraper` agregado |
| `d` | `player.pos ∈ [0, 47]` | `players[].pos` |
| `e` | `player.hand.length ≤ 3` | `players[].hand` |
| `f` | `player.busTickets ≥ 0` | `players[].busTickets` |
| `g` | Toda `titles[pos].ownerId` não-nulo aponta para um `players[].id` existente e não-eliminado-sem-herdeiro | `titles` × `players` |

`checkInvariants(prev, next): Violation[]` roda ao fim de cada `finalizeTurn`/`declareBankruptcy`
resolvidos (ponto em que o turno "fecha"), nunca em estados intermediários de uma resolução aberta.

## InvalidProbeCatalog (`tests/sim/engine/invalidProbe.ts`) — FR-005 / clarify Q3

Catálogo fixo, indexado, 1 entrada sorteada por turno pela seed da partida:

| # | Ação inválida sondada | Por que deve ser recusada |
|---|---|---|
| 1 | `buy-property` sem `resolution.kind === 'purchase'` | fora da janela de compra |
| 2 | `place-bid` com `amount ≤ currentBid` (ou sem leilão aberto) | lance não supera o atual |
| 3 | `build-house` numa propriedade que o jogador não possui | dono incorreto |
| 4 | `mortgage` numa propriedade alheia | dono incorreto |
| 5 | `play-hand-card` com `cardId` fora de `player.hand` | carta inexistente na mão |
| 6 | `jail-decision` fora de `turn.state === 'prisao-decisao'` | estado errado |
| 7 | `finalize` com `turn.pendingResolve === true` | resolução pendente |
| 8 | `execute-trade`-equivalente (`accept-trade`) sem `pendingTrade` | nada para aceitar |
| 9 | `respond-loan` sem `pendingLoan` | nada para responder |
| 10 | `use-bus-ticket` com `busTickets === 0` | sem ticket |
| 11 | `roll` fora de `aguardando-rolagem` | estado errado |
| 12 | `place-land-bid` num `pos` fora dos lotes abertos, ou `amount ≤ lot.currentBid` | lote/valor inválido |

Cada entrada é aplicada sobre `structuredClone(state)` (descartável); a asserção é: reducer não
lança + `deepEqual(before, after)`.

## SimResult / SimFailure / SimReport (`tests/sim/engine/types.ts`)

```
interface SimResult {
  seed: number
  playerCount: 2 | 3 | 6
  outcome: 'ok' | 'fail'
  rounds: number            // rodadas completas até o fim (ou até a falha)
  actionsExecuted: number
  durationMs: number
  failure?: SimFailure       // presente quando outcome === 'fail'
}

interface SimFailure {
  reason: 'exception' | 'invariant' | 'invalid-action-accepted' | 'round-cap-exceeded'
  seed: number
  playerCount: number
  round: number
  action?: SimAction         // ação em execução no momento da falha (FR-007)
  detail: string             // mensagem/violação legível
}

interface SimReport {         // FR-008 — resumo do lote
  total: number
  ok: number
  failed: number
  durationMs: number
  roundsHistogram: Record<number, number> // distribuição de rodadas-até-o-fim (partidas ok)
  failures: SimFailure[]
}
```

Este é o contrato consumido tanto pelo teste do lote padrão (`headless.*.test.ts`, que falha o
`test()` se `failed > 0`) quanto pelos scripts `sim:batch`/`sim:replay` (impressão em texto/JSON —
ver `contracts/`).

## Invariantes do próprio harness

- `GameState` nunca é mutado fora dos reducers puros existentes — o harness só chama funções já
  exportadas por `src/game/**`; nenhuma cópia de regra de negócio (princípio I).
- Nada em `tests/` ou `scripts/` é importado por `src/` — garante FR-012 (fora do bundle) por
  construção (Vite só bundla a partir de `index.html`/`src/main.tsx`).
- `SimResult.seed` + `playerCount` são suficientes para reproduzir 100% do resultado (FR-003/SC-003)
  — nenhum outro insumo externo (relógio real, `Math.random()`) entra no caminho de simulação.
