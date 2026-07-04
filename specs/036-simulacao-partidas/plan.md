# Plano de Implementação: Simulação Automatizada de Partidas (Test Harness)

**Spec**: [spec.md](./spec.md) · **Branch/dir**: `036-simulacao-partidas` · **Status**: rascunho (aguardando aprovação p/ `/speckit-tasks`)

## Summary

Harness de teste **dev-only**, em duas camadas independentes. **Headless** (`tests/sim/`): reusa
diretamente os reducers puros já existentes (`src/game/**`), sem passar pelo `Zustand`/timers reais
— um driver próprio com relógio lógico e RNG seedada (`mulberry32`) dirige N agentes que enumeram
e escolhem ao acaso apenas ações válidas, verificando invariantes a cada turno e sondando 1 ação
inválida/turno. Roda como parte da suíte padrão (`bun run test`), 100 partidas × {2,3,6} jogadores,
sob 2 minutos. **Smoke E2E** (`e2e/`, Playwright): 3 partidas curtas pela UI real com um roteiro
fixo determinístico. Nenhuma linha nova em `src/` além de eventuais correções de bugs que a
simulação encontrar — a feature em si é só infraestrutura de teste.

## Technical Context

**Language/Version**: TypeScript 5 (mesma stack existente) — sem novo runtime.

**Primary Dependencies**: **nenhuma nova** para a camada headless (reusa `src/game/**` puro).
**`@playwright/test`** como devDependency nova, exclusiva do smoke E2E (D9).

**Storage**: N/A — tudo em memória, execução efêmera.

**Testing**: Vitest (headless, integrado à suíte já existente — `vitest.config.ts` já inclui
`tests/**/*.test.ts`) + Playwright (`e2e/*.spec.ts`, config própria).

**Target Platform**: Node (headless, ambiente `node` do Vitest) + browser real headless (E2E,
Chromium via Playwright).

**Project Type**: web app SPA existente — esta feature só adiciona uma árvore de testes/scripts.

**Performance Goals**: lote headless (300 partidas) < 2 min (SC-002); smoke E2E (3 partidas × 10
rodadas) < 5 min (SC-005).

**Constraints**: determinismo total por seed (FR-003/SC-003); zero mudança em `GameState`/regra de
produção (FR-012, princípio I); nada do harness entra no bundle Vite.

**Scale/Scope**: até 300 rodadas/partida (teto configurável), até 6 jogadores simultâneos, ~30
famílias de ação (ver `data-model.md`).

## Constitution Check

*GATE — reavaliado pós-design.*

| Princípio | Avaliação |
|---|---|
| **I.** SRS é verdade | Harness não define regra nova; só exercita o motor existente. Bug encontrado é corrigido na spec/motor dono da regra, nunca "ajustado" no harness. ✓ |
| **II.** Discovery antes de código | Spec já clarificada; usuário autorizou avançar para o plano. Este documento é design, ainda não implementação. ✓ |
| **III.** Tesouro impacta | N/A — harness não altera cartas. ✓ |
| **IV.** Catch-up é discreto | N/A — harness não tem UI, não rotula nada. ✓ |
| **V.** Sem coop obrigatória | N/A — política do agente é aleatória pura (Assumption), não modela "jogador razoável". ✓ |
| **VI.** Privacidade de carta | O harness opera sobre `GameState` completo (visão onisciente, é teste) — não expõe nada a "outro jogador"; não há usuário final nesta feature. ✓ |
| **VII.** Resiliência de sessão | N/A — não é gameplay real; `paused`/reconexão não fazem parte do escopo desta simulação (fora do repertório de ações do agente). ✓ |
| **Decisão rejeitada "IA/bots fora do escopo"** | Reafirmada explicitamente na spec — agentes simulados são infra de teste, não aparecem no produto, não usam heurística de "jogador razoável" (política puramente aleatória seedada). ✓ |

**Sem violações.** Sem entradas em Complexity Tracking.

## Design técnico

### Camada headless — arquitetura

```
tests/sim/
├── engine/
│   ├── rng.ts            # mulberry32(seed): RNG — único gerador determinístico do harness
│   ├── driver.ts          # SimSession { game: GameState, ctx: TurnCtx } — chama os MESMOS
│   │                       # reducers de src/game/store.ts, com now() lógico (D2) em vez de Date.now()
│   ├── actions.ts         # SimAction (union) + enumerateActions(state): DecisionPoint | null (D4)
│   ├── invalidProbe.ts    # catálogo fixo de ações inválidas + pickProbe(rng): ProbeEntry (D5)
│   ├── agent.ts           # pickRandom(rng, actions: SimAction[]): SimAction — política do agente
│   ├── invariants.ts      # checkInvariants(prev, next): Violation[] — FR-004a–g (D6)
│   ├── runGame.ts         # orquestra 1 partida completa (seed, N) → SimResult (D7 fim-de-jogo/teto)
│   └── types.ts           # SimResult / SimFailure / SimReport (ver data-model.md)
└── headless/
    ├── 2p.test.ts          # 100 seeds, 2 jogadores — shard de paralelismo (D8)
    ├── 3p.test.ts          # 100 seeds, 3 jogadores
    └── 6p.test.ts          # 100 seeds, 6 jogadores

scripts/
├── sim-replay.ts           # bun run sim:replay -- --seed=N --players=P (FR-009)
└── sim-batch.ts            # bun run sim:batch -- --games=N --counts=2,3,6 (FR-008/nightly)
```

**Loop de decisão** (detalhe em `research.md` D4 e `data-model.md` § DecisionPoint): a cada tick,
`enumerateActions` prioriza (1) resolução bloqueante com decisor específico (nem sempre o jogador
ativo — reação, resposta de empréstimo, leilão), depois (2) ações oportunistas fora-de-turno de
outros jogadores (trocas, lances no pregão de terrenos), por fim (3) a ação do turno do jogador
ativo. `agent.ts` sorteia 1 ação entre as enumeradas usando a MESMA instância de RNG da partida
(D3) — dados, embaralhamento e decisões do agente compartilham uma seed única.

**Sonda de ação inválida** (D5/clarify Q3): a cada turno resolvido, `pickProbe(rng)` sorteia 1
entrada do catálogo fixo (`invalidProbe.ts`), aplica sobre um `structuredClone` descartável do
estado, e assere no-op (sem exceção, estado idêntico antes/depois).

**Invariantes** (D6): `checkInvariants` roda ao fim de cada turno fechado, cobrindo FR-004(a–g)
literalmente — ver tabela em `data-model.md`.

**Relógio lógico** (D2): leilões (propriedade e pregão de terrenos) usam `ctx.now()` só como
número comparado a `deadline`; o driver avança esse número manualmente quando não resta lance
possível, e fecha o leilão na hora — sem `setTimeout` real.

### Camada E2E — arquitetura

```
e2e/
├── playwright.config.ts     # (ou na raiz) webServer: bun run dev/preview
├── script.ts                 # política determinística por tipo de modal (D10) — reusada pelos 3 specs
├── 2players.spec.ts
├── 3players.spec.ts
└── 6players.spec.ts
```

Cada spec: cria a partida com N jogadores pela UI, roda ≥10 rodadas aplicando `script.ts` (mesma
regra por modal a cada execução — não fuzzing), assere ausência de erro de runtime e presença dos
elementos essenciais (tabuleiro, painéis, dados) do início ao fim.

### Estratégia de performance (SC-002)

Shards por contagem de jogadores (D8) para o Vitest paralelizar em nível de arquivo. Se o
benchmark de implementação não couber em 2 min, particionar mais (ex.: 4 arquivos por contagem)
sem mudar o tamanho do lote (100/contagem é requisito, FR-008/FR-011).

## Project Structure

### Documentation (this feature)

```text
specs/036-simulacao-partidas/
├── plan.md              # este arquivo
├── research.md           # decisões D1–D11
├── data-model.md          # SimAction/DecisionPoint/InvariantCheck/SimResult/InvalidProbeCatalog
├── quickstart.md
├── contracts/
│   ├── relatorio-simulacao.md
│   └── cli-scripts.md
└── tasks.md              # gerado por /speckit-tasks (ainda não existe)
```

### Source Code (repository root)

```text
tests/sim/
├── engine/
│   ├── rng.ts
│   ├── driver.ts
│   ├── actions.ts
│   ├── invalidProbe.ts
│   ├── agent.ts
│   ├── invariants.ts
│   ├── runGame.ts
│   └── types.ts
└── headless/
    ├── 2p.test.ts
    ├── 3p.test.ts
    └── 6p.test.ts

scripts/
├── sim-replay.ts
└── sim-batch.ts

e2e/
├── playwright.config.ts   # (path exato definido na implementação)
├── script.ts
├── 2players.spec.ts
├── 3players.spec.ts
└── 6players.spec.ts
```

**Structure Decision**: `tests/sim/` (Vitest, dentro do glob já existente `tests/**/*.test.ts`) para
a camada headless — reusa `src/game/**` só por import, nunca o contrário. `e2e/` top-level, fora do
glob do Vitest, dedicado ao Playwright. `scripts/` novo diretório na raiz para os CLIs dev-only
(FR-008/FR-009) — nenhum dos três é referenciado por `src/`, garantindo FR-012 por construção
(o bundle Vite parte de `index.html`/`src/main.tsx`, que não os importa).

## Estratégia de testes

- **Regressão do motor**: `bun run test` inteiro (suíte atual + o novo lote headless) deve seguir
  verde — o harness não pode quebrar nenhum teste existente por reusar os mesmos reducers.
- **Auto-teste do harness**: `tests/sim/engine/*.test.ts` (unidade) para `enumerateActions`,
  `checkInvariants` e o catálogo de sondas — cobrir casos onde a enumeração deveria/não deveria
  incluir uma ação (ex.: `place-bid` só aparece para `activeBidders`).
- **Injeção de bug controlada** (SC-004, validação manual pontual — não fica commitada): comentar
  uma guarda de invariante e confirmar que o lote falha apontando o código FR-004 certo.
- **E2E**: `bunx playwright test` roda os 3 specs; falha proposital de runtime (ex.: lançar erro
  num handler de clique via flag temporária) deve fazer o smoke falhar (SC-005).

## Decisões de design (resumo — detalhe em research.md)

- **D1/D2** — driver próprio sobre os reducers puros existentes, sem Zustand/timers; relógio lógico
  controlado pelo harness fecha leilões instantaneamente.
- **D3** — RNG seedada única (`mulberry32`) compartilhada por dados, embaralhamento e decisões do
  agente — determinismo por construção (FR-003).
- **D4** — enumeração de ações por **decisor** (nem sempre o jogador ativo), não por "turno", para
  cobrir trocas/empréstimos/reações/leilões cruzados.
- **D5** — catálogo fixo de 1 sonda inválida/turno, seedada, aplicada sobre clone descartável.
- **D8** — sharding por arquivo de teste (não `test.concurrent`) para paralelismo real no Vitest.
- **D9/D10** — Playwright + roteiro de política fixa por tipo de modal (não seed de dados de jogo).
- **D11** — scripts bun (`sim:replay`/`sim:batch`) reexportando o mesmo engine dos testes, sem
  duplicar regra.

## Gate

`bunx tsc --noEmit` + `bun run test` (suíte completa, incluindo o lote headless, < 2 min) +
`bun run build` verdes; `bunx playwright test` verde localmente antes de considerar a US3 pronta.
