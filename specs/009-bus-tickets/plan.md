# Implementation Plan: Uso de Bus Tickets & espaço Bus Ticket

**Branch**: `main` (feature dir `009-bus-tickets`) | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-bus-tickets/spec.md`

## Summary

Dar utilidade ao Bus Ticket (contador `player.busTickets` já existe — 006). Duas metades:

1. **Uso** (§10.7): novo comando de turno `useBusTicket(state, dest, ctx)` em `turn/turnMachine.ts`, disponível só no estado `aguardando-rolagem`, fora de canto e com `busTickets ≥ 1`. Valida que `dest` é uma casa do **mesmo lado** (não-canto, ≠ pos atual), **decrementa** o contador, **avança no sentido horário** até `dest` reusando `advance` (credita GO via `onPassGo` se o caminho cruzar o GO), e **pousa** com `land(..., null)` — sem dupla/re-rolagem (igual a sair da prisão). A casa de destino entra em `casa-a-resolver` e é resolvida pelo fluxo existente (`resolvePending` → `economyResolve`/`cardResolve`/registry).

2. **Espaço Bus Ticket** (§2.7): o handler `'bus-ticket'` em `turn/resolution.ts` deixa de ser `stub` no-op e passa a **incrementar** `busTickets` do jogador em 1 (e `{ done: true }`).

Store ganha o comando `useBusTicket(dest)`; o HUD ganha o controle "Usar Bus Ticket" com seletor das casas válidas do lado atual. Nenhum tipo novo de estado é necessário (não há slice de `resolution` para o ticket — a escolha do destino acontece na UI **antes** de chamar o comando, análogo a `chooseTripleDest(pos)`).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as de 002–008 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. **Sem campos novos** no `GameState` — `busTickets` já existe (006). Serializável.

**Testing**: Vitest. `useBusTicket` e o handler do espaço são puros → determinístico (RNG não é usado: ticket não rola dados).

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(1) por uso; cálculo de destinos válidos O(11) (casas de um lado). Trivial.

**Constraints**: lógica **pura** (efeito só no store); estado **serializável**. Disponível só em `aguardando-rolagem` e fora de canto (reusa os guards do turno). Sem rolagem ⇒ sem dupla ⇒ sem re-rolagem.

**Scale/Scope**: 1 comando novo em `turnMachine.ts` + 1 helper de lado + handler `'bus-ticket'` em `resolution.ts` + comando no store + controle no HUD + testes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §10.7 (uso) e §2.7 (espaço). Ambiguidades resolvidas em clarify (canto indisponível; movimento horário com crédito de GO). Tensão §2.7 ("canto") vs §10.7/glossário ("qualquer casa do lado") resolvida a favor de §10.7 (seção dedicada). | ✅ |
| **II. Discovery antes de código** | Spec aprovada + clarificada; usuário autorizou o pipeline completo. | ✅ |
| **III. Tesouro precisa impactar** | N/A. | ✅ |
| **IV. Catch-up é discreto** | N/A (ticket não é catch-up). O crédito de GO ao cruzar reusa a regra do 007 sem rótulo. | ✅ |
| **V. Sem dependência de cooperação** | N/A. | ✅ |
| **VI. Privacidade de cartas** | Mantém `busTickets` como contador **separado**, **privado**, **não-negociável** (D-012). Nada introduz negociação. | ✅ |
| **VII. Resiliência de sessão** | Sem estado novo; `busTickets` já é serializável. Comando bloqueado sob `paused`. Nenhum timer/closure. | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/009-bus-tickets/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/bus-ticket.md
├── checklists/requirements.md
└── tasks.md   # /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/turn/turnMachine.ts   # MODIFICADO — novo useBusTicket + helper sideOf/sameSide
src/game/turn/resolution.ts    # MODIFICADO — handler 'bus-ticket' deixa de ser stub: +1 ticket
src/game/store.ts              # MODIFICADO — comando useBusTicket(dest)
src/game/ui/GameHUD.tsx         # MODIFICADO — controle "Usar Bus Ticket" + seletor de destino

tests/game/busticket/
└── busticket.test.ts          # SC-001..005 — uso válido/inválido, no-reroll, GO ao cruzar, espaço +1
```

**Structure Decision**: o uso do ticket é um **comando de movimento** (irmão de `rollDice`/`chooseBusMove`/`chooseTripleDest`), por isso mora em `turnMachine.ts` e reusa `advance`/`land`/`finishIfEnded`. A escolha do destino é parâmetro do comando (a UI seleciona antes de chamar, como `chooseTripleDest(pos)`) — **não** cria um slice de `resolution`, mantendo o estado enxuto. O ganho de ticket pelo espaço é só preencher o handler `'bus-ticket'` já roteado pelo registry de resolução.

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
