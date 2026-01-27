# Implementation Plan: Log de eventos real (M2)

**Branch**: `main` (feature dir `021-log-eventos`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/021-log-eventos/spec.md`

## Summary

`GameState.log: LogEntry[]` (`{who,what}`, bounded 50) + helper puro `logEvent` (`src/game/log.ts`). Reducers do núcleo do turno emitem eventos: `rollDice` (rolagem), `advance` (GO), `buyProperty` (compra), `resolveRentable` (aluguel), handler `tax` (imposto), `payDebt`/`declareBankruptcy` (dívida/falência), `cardResolve` (saque — só o deck). O painel **Histórico** (`boards/shared.tsx`) consome `game.log` newest-first (substitui `MOCK_LOG`). Emissor 100% testável (engine); painel validado no `bun run dev`.

## Technical Context

**Language/Version**: TS ~6.0 (React 19 + Vite 8 + Zustand). **Dependencies**: nenhuma. **Storage**: `GameState.log` (serializável; bounded). **Testing**: Vitest no emissor (engine). UI sem RTL → visual. **Constraints**: puro; sem relógio (recência=ordem); privacidade no saque.

**Scale/Scope**: `LogEntry` em `economy/types.ts`; `log` em `turn/types.ts`; novo `src/game/log.ts` (`logEvent`); emissão em `turnMachine`, `economy/purchase`, `economy/resolveRentable`, `turn/resolution` (tax), `falencia`, `cards/draw`; seed no `store`; `PlayersPanel` Histórico. Teste `tests/game/log.test.ts`.

## Constitution Check

| Princípio | Avaliação | Status |
|---|---|---|
| I. SRS verdade | §12.3 (log das últimas ações). | ✅ |
| II. Discovery antes de código | Spec + fatia escolhidas. | ✅ |
| VI. Privacidade de cartas | Saque loga só o **deck**, nunca a carta. | ✅ |
| VII. Resiliência | `log` é JSON puro, bounded; determinístico (sem relógio). | ✅ |

(III/IV/V N/A.) **Sem violações.**

## Project Structure

```text
specs/021-log-eventos/{plan,research,data-model,quickstart}.md · contracts/log.md · checklists/

src/game/economy/types.ts     # MOD — LogEntry
src/game/turn/types.ts        # MOD — GameState.log: LogEntry[]
src/game/log.ts               # NOVO — logEvent(state, who, what) (bounded 50)
src/game/turn/turnMachine.ts  # MOD — rollDice (rolagem) + advance (GO)
src/game/economy/purchase.ts  # MOD — buyProperty (compra)
src/game/economy/resolveRentable.ts # MOD — aluguel pago
src/game/turn/resolution.ts   # MOD — tax pago
src/game/falencia/falencia.ts # MOD — payDebt + declareBankruptcy
src/game/cards/draw.ts        # MOD — cardResolve (saque: só o deck)
src/game/store.ts             # MOD — seed log: []
src/boards/shared.tsx         # MOD — Histórico consome game.log (newest-first)
tests/game/log.test.ts        # NOVO — emissão dos eventos do núcleo
```

**Structure Decision**: `log.ts` é leaf (importa só `GameState`/`LogEntry` de types). Os reducers chamam `logEvent` (one-liner) nos pontos locais onde a info do evento existe. O painel troca a fonte (MOCK → store). O campo `log` é aditivo → asserções existentes (field-level) não quebram.

## Complexity Tracking

> Sem violações. Vazio.
