# HANDOVER — Banco Master

> Última atualização: 2026-07-24 · branch `main` · `22a460d` (+ docs desta sessão)
> Leitura de partida: este arquivo → `CLAUDE.md` → `docs/AUDITORIA-2026-07-23.md` → a spec ativa.

## Estado atual

- **Motor (M1): completo e sem gaps de regra conhecidos** — os 3 bugs achados pela auditoria de 2026-07-23 foram corrigidos nesta sessão (ver abaixo). **UI jogável (M2): fechada** (painéis ao vivo, modais, cartas de mão, trade, pregão, som). **Simulação (spec 036): entregue** (fuzzing seedado + invariantes + smoke E2E).
- **Gates:** `bun run test` → **359 testes / 46 arquivos verdes** (~1–2min); `bunx tsc -b` limpo; `bun run build` ok. **Lint: 36 erros pré-existentes** (12 em `boards/shared.tsx` por react-refresh; resto em `tests/sim`, incl. o falso positivo `useBusTicket` em `driver.ts:110`). **Sem CI** (`.github/` não existe).
- **Multiplayer (M3): não começou.** ADRs travados: D-019 (auth anônima por link) + D-020 (host-autoritativo + Realtime + snapshot). Nenhum código Supabase.
- **Push agora é rotina:** remote `origin` = `github.com:Nikaum-js/banco-master` — commits desta e da sessão anterior foram pushados. Backdate de commits segue a regra do `~/.claude/rules/git-conventions.md` (hook injeta).
- **Auditoria completa em `docs/AUDITORIA-2026-07-23.md`** — 17 itens priorizados por impacto×esforço; é o backlog técnico vigente (itens 1, 2, 7 e 14 já resolvidos).

## Sessão de 2026-07-23/24 — auditoria ponta a ponta + 3 fixes de engine + SRS v1.3

**Auditoria** (`docs/AUDITORIA-2026-07-23.md`, commit `d262f12`): mapeamento + 7 dimensões (arquitetura, design, regras, UX, qualidade, perf, segurança), tudo ancorado em arquivo:linha. Destaques: núcleo do motor elogiado (reducers puros, sim de invariantes); casca com dívidas (ciclo `shared.tsx ↔ game/ui`, god file 3.261 linhas, log stringly-typed como event bus de som/cor, dead code com valores divergentes do tema).

**3 bugs de engine corrigidos** (test-first, 6 testes novos):

1. `e5bb33e` — **Dívida de juros × slot único de resolution.** `chargeLoanInterest` (juros no GO) gravava `resolution: debt` durante o `advance`; a resolução da casa de pouso sobrescrevia (juros residuais sumiam) ou `payDebt` pulava a casa. Fix: dívida ganha `origin: 'loan-interest'` (`economy/types.ts`); `resolvePending` é no-op com qualquer `resolution` em voo (de brinde, elimina reset acidental de leilão→modal de compra); `finishIfEnded` não passa a vez com dívida aberta (caso GO → Vá pra Prisão); `payDebt` de dívida de juros devolve o turno à casa ainda pendente em vez de `completeResolution`.
2. `191a656` — **Multa de prisão sem caixa.** `jailDecision('pay')` debitava $50 sem checar caixa (só a UI guardava). Agora é no-op com caixa < `JAIL_FINE`, padrão de comando inválido do motor.
3. `22a460d` — **Asset dumping pré-falência.** Com dívida pendente, troca envolvendo o devedor (ativo) só é válida se o `liquidationValue` dele continuar ≥ dívida após a troca. **Decisão de regra:** NÃO bloqueamos trade durante dívida por completo — venda legítima para levantar caixa é rota de resgate válida; só a troca que torna o devedor incapaz de pagar (doação para lesar o credor) é rejeitada. Extraído `applyTrade` (núcleo sem validação) para `validateTrade` projetar o estado pós-troca sem recursão.

**Compatibilidade verificada antes dos fixes:** `GameDriver` já não auto-resolvia com `resolution` presente e o enumerador do sim (`tests/sim/engine/actions.ts`) já gateava `pay`/`resolve-pending` nas condições dos novos guards — nenhum fluxo existente mudou fora dos cenários de bug. Única asserção antiga ajustada: shape da dívida de juros em `emprestimos.test.ts` (ganhou `origin`).

**SRS v1.3** — §13.5 reescrito: **GO Progressivo → Bônus de GO fixo** ($200 ao passar, $400 ao parar exato), alinhando à revisão **D-007 (2026-05-24)** que já estava em DECISIONS (a auditoria errou ao dizer que não havia ADR — corrigida). Atualizados também: tabela de mecânicas (linha 74), §3.3, §4.7, carta "Volta para o GO" (credita $400) e glossário. Versão/data do doc bumpadas (1.2→1.3, Julho 2026).

**Dead-ends / avisos:**
- 3 subagentes de auditoria morreram por limite de sessão — regras/design/qualidade foram auditadas inline (mais lento, mesmo resultado).
- 1 flake na suíte completa sob carga (timeout de teste de sim na 1ª execução; 2 execuções seguintes 100% verdes) — se repetir, suspeitar de carga da máquina antes de culpar código.
- Colisão residual conhecida do slot único: dívida de juros durante fluxo de CARTA de movimento (avance3/voltaGo) ainda pode disputar o slot — teórico (exige empréstimo + carta + GO + insolvência); resolver de vez = fila de resolutions (não vale agora).

## Próximos passos (do backlog da auditoria, em ordem)

1. **CI GitHub Actions** (lint + tsc + vitest + sim curto) e **zerar os 36 erros de lint** — inclui renomear `useBusTicket` → `spendBusTicket` no engine (mata o falso positivo react-hooks em `driver.ts:110`); `bun update @babel/core` (advisory low GHSA-4x5r-pxfx-6jf8).
2. **Deletar dead code de `boards/shared.tsx`**: `HOUSE_COST` (diverge do `theme.ts`!), `MOCK_PLAYERS`/`LOCAL_PLAYER_NAME`, `PlayerTokens`, `LotteryCard`, `CenterPlate`, `GROUP_BG`.
3. **Log tipado** (`LogEntry {kind, who, amount, what}`) — destrava explicação de aluguel na UI, som robusto (hoje classifica por substring em `classify.ts:72-83`), cor do histórico e i18n. Item de maior alavancagem estrutural.
4. **Pacote "mostrável"**: persistência do `GameState` em localStorage (F5 hoje mata a partida) + ErrorBoundary; leilão comum multi-licitante + botão "passar" (`passBid` existe no store sem UI — copiar o seletor do pregão em `LandAuctionLayer.tsx:217-230`); lobby mínimo com nomes (UI hoje celebra "p1" na vitória).
5. **Sim: registrar vencedor/curva de patrimônio por rodada** (`tests/sim/engine/report.ts` só conta mecanismos) — pré-requisito para validar/refutar a hipótese de ROI desproporcional da construção parcial (D-026) em orange/red.
6. **M3 (Supabase)**: antes da spec, decidir a autoridade de estado — hoje os comandos aceitam `playerId` de quem chamar (`store.ts:262`); D-020 (host-autoritativo) precisa disso resolvido no desenho do transporte.

## Sessões anteriores

- **2026-07-23:** auditoria ponta a ponta entregue (`docs/AUDITORIA-2026-07-23.md`, commit `d262f12`); suíte na época: 353 testes.
- **2026-07-1x:** animação de dados cup-drop sincronizada ao áudio (`8a600ce`, showcase em `727a843`); fix `lastRoll` em passes forçados (`abad5c8`); spec 035 (som): ~40 cues, 3 canais, unlock de autoplay, SoundBoard via `?sons`.
- **2026-07-11 (spec 036):** simulação headless (`tests/sim/`, mulberry32, mesmos reducers do produto), `sim:replay`/`sim:batch`, smoke E2E Playwright (2/3/6p via `?players=N` — hook de boot, NÃO é o lobby do M3); 4 bugs de produção achados pelo fuzzer e corrigidos (cartas de pagamento, multa 3ª tentativa, solvência no fecho de leilões); testes de conservação com oráculo independente (23 casos) — empréstimos ficam em 0 ocorrências no lote aleatório (cobertos por unit).
- **2026-05-27 (spec 034 / D-026):** construção com país PARCIAL — constrói com 1+ cidade, aluguel construído escala 50→100% pela posse (`posseFactor` em `rent.ts`); D-027: Bus Ticket também usável no fim do turno.
- **2026-05-24/25:** M1+M2 fechados (specs 001–033): motor completo (turno, economia, cartas 32/32, empréstimos, falência §9.4, Tax Man, pregão de escassez D-023), UI jogável (painéis/modais/trade/cartas de mão), tema Cidades do Mundo (`theme.ts` fonte única, 10 grupos com platinum/Emirados), rebalanceamento D-024. Revisões de playtest: Speed Die SUSPENSO (`THEME.SPEED_DIE_ENABLED=false`, D-003), GO Progressivo → fixo $200/$400 (D-007), construção ilimitada (D-022 — leilão de casas removido).

## Convenções que valem a pena relembrar

- **bun, nunca npm/npx.** Lógica pura em `src/game/**` (reducers `(state, ctx) → state` com `structuredClone`; único efeito é o store Zustand). `GameState` 100% serializável (princípio VII). RNG e relógio injetáveis via `ctx`.
- Resolução de casa = slice única em `GameState.resolution` — **cuidado: slot único** (ver fix `e5bb33e`); eventos autônomos (`pendingTrade`, `landAuction`, `notice`) vivem FORA dela.
- Workflow por feature: Spec Kit (`/speckit-specify → plan → tasks → implement`); próxima spec é a **037**. Antes de specificar: constitution + SRS (agora v1.3) + DECISIONS.
- Commits: inglês, emoji+conventional, backdate via hook, NUNCA co-author. Push em `main` direto.

## Ponteiros

- `docs/AUDITORIA-2026-07-23.md` — backlog técnico priorizado (17 itens).
- `docs/SRS.md` (v1.3) — verdade das regras · `docs/DECISIONS.md` — ADRs (D-007 GO fixo, D-020 M3 host-autoritativo, D-022/24/26 economia).
- `specs/00N-*/` — spec/plan/tasks por feature · `docs/MILESTONES.md` — roadmap.
