# HANDOVER — Banco Master

> Estado para continuar em um **chat novo**. Snapshot de 2026-05-24.
> Leitura de partida: este arquivo → `CLAUDE.md` → `docs/MILESTONES.md` → a spec ativa (`specs/012-.../plan.md`).

## Onde estamos

Saímos da discovery e entramos em **implementação ativa**, feature a feature, via GitHub Spec Kit (`spec → plan → tasks → implement`, com testes). Já existe um **motor de jogo completo e testado** (`src/game/`) + uma **UI mínima jogável**. Falta: regras restantes, UI completa e multiplayer.

**Como verificar:**
```bash
bunx vitest run tests/game  # 124 testes (a verdade do motor) — projeto usa BUN, não npm/npx
bun run build               # tsc -b + vite (deve passar, exit 0)
bun run dev                 # demo local jogável (HUD na barra de baixo)
```

## Features entregues (motor, em `src/game/`)

| # | Spec | Entregou |
|---|---|---|
| 001 | `tabuleiro-48-casas` | estrutura de 48 casas + render estático do board (`boards/`) |
| 002 | `fluxo-de-turno` | FSM pura do turno (rolar/mover/resolver/finalizar, duplas, prisão, Speed Die) + portas de resolução |
| 003 | `compra-aluguel` | compra/recusa, leilão (timer), aluguel escalonado; introduz **caixa** e **títulos** |
| 004 | `construcao` | casas/hotel, uniformidade, grupo parcial (70%), estoque do banco, leilão de casas |
| 005 | `hipoteca` | hipotecar/deshipotecar (metade + 10%), regra de transferência |
| 006 | `sistema-cartas` | 2 decks (Acaso/Tesouro), raridades, mão (limite 3, privada), saque, timing, 14 efeitos autocontidos; **D-018** propagou Surpresa→Acaso |
| 007 | `balanceamento-catchup` | **GO Progressivo** (creditado por ranking de patrimônio) + **Free Parking** (pote acumula/coleta); imposto e multa de prisão passaram a debitar de fato |
| 008 | `falencia-fim-jogo` | dívida pendente → **pagar/falir**, destino dos ativos (§9.2), eliminação, **fim de jogo** (vencedor) |
| 009 | `bus-tickets` | **uso** do ticket (§10.7: `useBusTicket`/`sideOf` em `turn/`, move pelo lado, credita GO ao cruzar) + **espaço Bus Ticket** (§2.7: parar concede +1) |
| 010 | `emprestimos` | `emprestimos/` — `grantLoan`/`payOffLoan`/`chargeLoanInterest`; `Loan` + `GameState.loans`; juros simples no GO (porta `afterPassGo`); **falência §9.3** (credor do empréstimo herda) em `falencia.ts` |
| 011 | `construcao-avancada` | estende o 004: ladder 0–7 (`cityLevel`), 2º hotel + Skyscraper via `buildHouse`/`sellBuilding`; Hangar (`buildHangar`/`sellHangar`); `rentCity` (Skyscraper fixo + ×3 de grupo); `Title`+`hotel2/skyscraper/hangar`, `bank.skyscrapers`; **sem UI** |
| 012 | `tax-man` | `balancing/taxMan.ts` — `rollTaxMan` move o Fiscal 1×/turno (porta `taxMan` em `advanceSeat`) e cobra do dono o aluguel (removido da economia); `GameState.taxManPos`; `defaultPorts` **sem** o Fiscal (só o store injeta — zero regressão); **sem UI** |
| — | UI wiring | `src/game/ui/` — `GameHUD` (controle do turno; inclui seletor de Bus Ticket e pedir/quitar empréstimo) + `LiveTokens`; montados no `App.tsx`/`Board01Classic.tsx`. **Construção (004/011) não está no HUD** (M2) |

**Loop single-player local completo:** comprar → aluguel → construir → hipotecar → GO/Férias → dívida → falir → vencedor.

## Arquitetura (convenções do `src/game/`)

- **Camadas:** `turn/` (FSM), `economy/` (compra/aluguel/construção/hipoteca/leilão), `cards/`, `balancing/`, `falencia/`, `ui/`, e `store.ts` (Zustand, raiz).
- **Lógica pura:** reducers `(state) → state` que **clonam** via `structuredClone`; o **único ponto com efeito é o store** (setters + timers de leilão).
- **Serializável (princípio VII):** todo o `GameState` é JSON puro (sem refs/closures); decks/mão = ids; timers guardam `deadline`, não handles.
- **Portas** (injetadas pelo store, recebem `state`): `onPassGo`/`onPayToCenter`/`onCollectCenter` (balanceamento), `isEliminated`. O 002 **não** importa specs posteriores — elas entram pelas portas / pela composição de `ctx.resolve` (`economyResolve ?? cardResolve`).
- **Resolução de casa = "slices" pendentes** em `GameState.resolution` que bloqueiam finalizar o turno: `purchase`, `auction`, `house-auction`, `card-discard`, `card-shortcut`, `debt`.
- **RNG injetável** (`ctx.rng`) → testes determinísticos. `bunx vitest run tests/game`.
- **UI:** só o **HUD mínimo** (`GameHUD`) é funcional; os painéis laterais (`PlayersPanel`/`ActionsPanel` em `boards/shared.tsx`) são **mockados/decorativos**.

## Pendências e itens DEFERIDOS (o backlog real)

**Regras do motor:**
- **Cartas deferidas** (no-op stub no catálogo 006): ofensivas (Aquisição Hostil, Despejo, Auditoria Fiscal), reação (Diplomacia, Bunker Fiscal), temporárias de N voltas (Boicote, Imunidade, Apagão, Greve). Precisam de um **subsistema de reação/efeitos-temporários**.
- **Negociação** (§8) — sem spec ainda.
- **Imunidades** no `declareBankruptcy`: no-op até as cartas de Imunidade. (Falência §9.3 já fechada pelo 010.)
- **Balanceamento: COMPLETO** (Speed Die, GO Progressivo, Free Parking, Bus Tickets, Hangar, Skyscraper, 2º hotel, Tax Man — todos entregues).
- **Tema "Cidades do Mundo":** preços/aluguéis/custos **finais** (hoje escada/multiplicadores provisórios em `boardData.ts` e nos módulos).

**Simplificações documentadas (revisitar):**
- Cartas de **movimento** mudam a posição mas **não auto-resolvem** a casa de destino (006).
- **Leilão de casas** e **leilão dos bens da falência-ao-banco**: mecânica existe / simplificada para "volta ao banco"; gatilho em jogo é raro.
- **Bus Ticket em utilidade** (009): destino utilidade alcançado por ticket cobra **$0** (`diceValue(null)===0`, sem rolagem). Raro; revisitar se virar problema de balanceamento (research R6).
- **Tax Man — dono sem caixa** (012): o Fiscal debita o que houver (sem caixa negativo); **não fale** um jogador (que pode ser não-ativo) — falência cross-player fora do modelo do 008 (research R7). O dinheiro é **removido** (banco), não vai ao pote.
- **Empréstimo — juros no GO sem caixa** (010): se o juro de GO excede o caixa pós-bônus, abre `debt` ao credor; no overlap raro de também pousar em aluguel impagável no mesmo GO-pass, o slot único fica com a dívida de juros e a casa de pouso não é re-resolvida (research R5). Credor eliminado antes da quitação → empréstimo perdoado (R8).

**Produto:**
- **UI completa** (só HUD mínimo hoje).
- **Multiplayer / Supabase / Lobby / Sessão & Resiliência** (M3 do MILESTONES) — nada começado.

## Estado do Git

- **117 commits**, todos em `main` (o projeto não usa branches de feature — trabalha em `main`); incluem até o 010.
- Histórico criado via skill **`/micro-commits`** (datas backdatadas aleatórias **espalhadas** pelos últimos 6 meses, identidade `Nikolas Santana <nikolasdssantana@gmail.com>`, mensagens em **inglês** emoji+conventional).
- **NÃO foi feito push** — o usuário faz o push manualmente (`git push origin main`).
- **011 (Construção avançada) e 012 (Tax Man) ainda NÃO commitados** — working tree sujo com os arquivos das features + docs. Rodar `/micro-commits` quando o usuário pedir.
- ⚠️ **Usar `bun`**, nunca npm/npx (rodar npm gera `package-lock.json` indevido — já existe um commitado, o usuário optou por mantê-lo).

## Como continuar (workflow desta sessão)

1. **Por feature:** `/speckit-specify` → (clarify quando houver ambiguidade real, via perguntas) → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Tudo confirmado pelo usuário ("pode continuar" = conduza o pipeline inteiro).
2. **`.specify/feature.json`** rastreia a feature ativa (hoje aponta para `012`); o marcador `<!-- SPECKIT -->` no `CLAUDE.md` aponta para o `plan.md` ativo.
3. **Regra crítica (CLAUDE.md):** antes de `/speckit-specify`, ler constitution + SRS (seção da feature) + DECISIONS + specs dependentes.
4. **Commits:** ao final, rodar `/micro-commits` (backdated, **sem push**) quando o usuário pedir.
5. **Numeração de specs:** sequencial; a próxima é `013`.

**Próximos candidatos** (impacto): **Negociação** (grande superfície social, D-010 — maior regra de motor ainda pendente) · **subsistema de cartas deferido** (ofensivas/reação/temporárias de N voltas — destrava ~9 cartas no-op do 006) · **Tema "Cidades do Mundo"** (valores finais) · ou **UI completa / Multiplayer (M3)**. Balanceamento está **completo**.

## Ponteiros

- `docs/MILESTONES.md` — roadmap atualizado (reflete exatamente este estado).
- `docs/SRS.md` — fonte de verdade das regras (§ citados nas specs).
- `docs/DECISIONS.md` — ADRs (até D-018, "Acaso").
- `specs/00N-*/` — spec/plan/tasks/quickstart de cada feature.
- Memória persistente (carrega sozinha no chat novo): atualizada para refletir a fase de implementação.
