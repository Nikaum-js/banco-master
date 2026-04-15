# Implementation Plan: Compra & Aluguel

**Branch**: `main` (feature dir `003-compra-aluguel`) | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-compra-aluguel/spec.md`

## Summary

Resolver de verdade o que era stub no Fluxo de Turno (002): ao parar numa propriedade, **comprar** (modal compra/recusa), **leiloar** (recusa → leilão com cronômetro por lance) e **pagar aluguel** com escalonamento por posse (cidade base/150%/200%, aeroporto $25–$200, utilidade 4×/10×/20× dos dados).

Esta feature **introduz a economia**: adiciona `cash` ao jogador (semente $2.000, SRS §3.1) e os **títulos de propriedade** (`pos → { ownerId, mortgaged }`). Substitui os handlers stub de `property`/`airport`/`utility` em `turn/resolution.ts` por lógica real, mantendo a fronteira de portas do 002. A compra/leilão são **interativos** (exigem decisão), então a resolução da casa fica **pendente** (não finaliza o turno) até a interação concluir — implementado com um slice `resolution` transitório + comandos puros, sem reescrever a FSM do 002. Tudo permanece **puro e serializável** (princípio VII): o leilão guarda um `deadline` (timestamp), e o cronômetro em si é efeito do store (reconstruível na reconexão). **Fora de escopo:** aluguel por construção (Construção), mecânica de hipoteca (Hipoteca — aqui só se lê a flag), insolvência (Falência — sinalizada por porta), negociação, Hangar/Skyscraper.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as do 002 — React 19, Vite, Tailwind v4, **Zustand** (estado), **Vitest** (testes). Nenhuma dependência nova.

**Storage**: estado de partida em runtime/Zustand. Esta feature **estende** o `GameState`: `Player.cash` e `GameState.titles` (+ slice transitório `resolution` para modal/leilão). Tudo serializável.

**Testing**: Vitest. Lógica de aluguel/compra/leilão é pura → testes determinísticos. O cronômetro do leilão usa **fake timers** do Vitest (`vi.useFakeTimers`) para testar o fechamento por tempo.

**Target Platform**: Web (desktop-first), idem 001/002.

**Project Type**: SPA frontend único.

**Performance Goals**: cálculo de aluguel/compra O(1)–O(n_props); sem I/O. Resolução < 16ms.

**Constraints**: estado **serializável** — o leilão guarda `deadline: number` (epoch ms), não um handle de timer; o `setTimeout` vive só no store e é reconstruído a partir do `deadline` na reconexão (princípio VII). Lógica de regra **pura** (sem efeitos fora do store). A resolução de propriedade **integra** com a FSM do 002 sem alterá-la: completa a resolução via `pendingResolve`.

**Scale/Scope**: até 8 jogadores; 35 propriedades compráveis (28 cidades + 4 aeroportos + 3 utilidades). Escopo de código: novo `src/game/economy/` (~5 arquivos) + extensão de `turn/resolution.ts` e `store.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §2.4/§2.5/§4.1/§4.2/§5.1/§7 + 2 clarificações (timer de leilão, 150% em 3-de-4). Não inventa regra. | ✅ |
| **II. Discovery antes de código** | Plan é design. Usuário autorizou o **pipeline completo** desta feature (specify→…→implement). Implementação na sequência, com a spec aprovada. | ✅ |
| **III. Tesouro precisa impactar** | Não toca cartas. | ✅ N/A |
| **IV. Catch-up é discreto** | Aluguel/leilão não expõem rótulo de catch-up. O crédito do GO Progressivo segue como porta do 002 (Balanceamento), sem vazar ranking aqui. | ✅ |
| **V. Sem dependência obrigatória de cooperação** | Compra/aluguel são individuais; nenhum gate de cooperação. O escalonamento por posse premia monopólio mas não o exige (grupo parcial é da Construção). | ✅ |
| **VI. Privacidade de cartas** | N/A. | ✅ |
| **VII. Resiliência de sessão** | `cash`/`titles`/`auction` são serializáveis; o leilão guarda `deadline` (não handle), reconstruível na reconexão. Pausa do 002 congela o cronômetro. | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

> ⚠️ **Nota de integração (não-violação):** o leilão usa **cronômetro** (clarificação aprovada). D-015 veda timer **de turno**, não de leilão — registrado na spec. O timer é efeito do store; a regra pura recebe `closeAuction`.

## Project Structure

### Documentation (this feature)

```text
specs/003-compra-aluguel/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões (modelo de posse, integração com a FSM, timer serializável)
├── data-model.md        # Fase 1 — Title, cash, slice resolution/auction
├── quickstart.md        # Fase 1 — verificação (SC-001..007 → testes)
├── contracts/
│   └── economy.md       # Fase 1 — comandos (buy/decline/bid/closeAuction) + cálculo de aluguel + portas
├── checklists/
│   └── requirements.md  # Criado pelo /speckit-specify
└── tasks.md             # Fase 2 — /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/
├── economy/                    # NOVO — posse, dinheiro, aluguel, compra, leilão
│   ├── types.ts                # Title, ResolutionSlice, Auction; extensões de Player/GameState
│   ├── titles.ts               # consultas puras: ownerOf, mortgaged, groupOwnedCount, airports/utilitiesOwned
│   ├── rent.ts                 # cálculo puro de aluguel (cidade/aeroporto/utilidade)
│   ├── purchase.ts             # buyProperty / declineProperty (puras)
│   └── auction.ts              # placeBid / closeAuction (puras); deadline serializável
├── turn/
│   └── resolution.ts           # MODIFICADO — handlers reais p/ property/airport/utility (abrem compra ou cobram aluguel)
└── store.ts                    # MODIFICADO — seed de cash/titles; comandos de economia; timer do leilão

tests/game/economy/
├── rent.test.ts                # SC-003/004/005/006 — escalonamento e isenções
├── purchase.test.ts            # SC-001 — compra/recusa, caixa insuficiente
└── auction.test.ts             # SC-002 — lances, fechamento por tempo (fake timers)
```

**Structure Decision**: a feature **adiciona** `src/game/economy/` e **estende** dois arquivos do 002 (`turn/resolution.ts`, `store.ts`) sem mexer na FSM (`turnMachine.ts`). A compra/leilão completam a resolução do turno via o flag `pendingResolve` já existente — o 002 não precisa saber *como* a propriedade resolve, só que resolveu. O cálculo de aluguel e as consultas de posse são funções puras (testáveis isoladamente); a interação (modal/leilão) vive num slice transitório do `GameState`.

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
