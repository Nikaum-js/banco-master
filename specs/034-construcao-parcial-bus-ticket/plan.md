# Plano de Implementação: Construção com país parcial + timing do Bus Ticket

**Spec**: [spec.md](./spec.md) · **Branch/dir**: `034-construcao-parcial-bus-ticket` · **Status**: aprovado p/ implementar

## Stack
Sem dependências novas. React + TS + Zustand existentes. Mudanças em funções puras do motor (`src/game/economy`, `src/game/turn`) + UI (`shared.tsx`/`GameHUD`/`ModalLayer`) + docs (SRS/DECISIONS) + testes (vitest).

## Design técnico

### A. Construção com país parcial + aluguel escalonado

1. **`src/game/economy/rent.ts` — `rentCity`**: no ramo COM construção, trocar `triple(complete ? table : Math.round(table*0.7))` por `triple(Math.round(table * posseFactor(ownedInGroup, size)))`, onde
   `posseFactor = clamp(0.5 + 0.5*(owned-1)/(size-1), 0.5, 1)`.
   Mantém: `build?.skyscraper → ladder.skyscraper` (sempre 100%, exige país completo); ramo SEM construção inalterado (base/150%/200%); `triple` (×3 do arranha-céu no grupo).
2. **`src/game/economy/construction.ts` — `canBuild`**: remover a linha `if (cities.length < majority(...)) return false`. Manter dono + nenhuma hipotecada. `majority` fica só onde ainda é usado (não é mais aqui) → remover import/fn se órfã. `canBuildHouse` inalterado (uniformidade, caixa, arranha-céu exige país completo via `cur===6 → cities.length===groupSize`).
3. **`src/game/ui/deed/deedView.ts` — `buildBlock`**: remover o ramo `'maioria'`; remover `'maioria'` do tipo `BuildBlock`.
4. **`src/boards/shared.tsx` — `BUILD_BLOCK_MSG`**: remover a chave `maioria` (já não é retornada).

### B. Timing do Bus Ticket

5. **`src/game/turn/turnMachine.ts` — `useBusTicket`**: trocar a guarda `state.turn.state !== 'aguardando-rolagem'` por aceitar **também** `'aguardando-finalizacao'`. Resto do salto inalterado (mesmo lado, sem GO, gasta 1, `land(...,null)`).
6. **`src/game/ui/GameHUD.tsx` — pílula pré-rolagem**: mostrar o botão "Usar Bus Ticket" também no estado `aguardando-finalizacao`; "Quitar empréstimo" segue só em `aguardando-rolagem`.
7. **`src/game/ui/modals/ModalLayer.tsx` — `showBusArmed`**: aceitar `aguardando-finalizacao` além de `aguardando-rolagem`.

## Estratégia de testes
- `tests/game/economy/rent.test.ts`: atualizar asserts do ramo construído (70%→fator) e adicionar 1/3=50%, 2/3=75%, 3/3=100%, duo 1/2=50%; monotonicidade.
- `tests/game/economy/construction.test.ts` + `construcao-avancada.test.ts`: remover/atualizar o que exigia maioria pra construir; manter arranha-céu exige país completo.
- `tests/game/ui/deedView.test.ts`: ajustar/retirar asserts de `buildBlock==='maioria'`.
- `tests/game/busticket/busticket.test.ts`: adicionar caso de `useBusTicket` em `aguardando-finalizacao` (permite); manter no-op em `casa-a-resolver`.
- Rodar `bunx vitest run tests/game` e corrigir quebras (revelam o que dependia do velho 70%/maioria).

## Docs
- **SRS**: §5.1/§13.3 (curva de aluguel construído por posse; construir com qualquer nº) e §10.7 (Bus Ticket usável também no fim do turno).
- **DECISIONS**: revisar **D-004** (maioria + 70%) registrando o novo modelo (construir com ≥1, aluguel `0,5+0,5×…`); nova decisão para a janela extra do Bus Ticket.

## Gate
type-check (`bunx tsc --noEmit`) + `bunx vitest run tests/game` + `bun run build`, e verificação visual (popover de aluguel e pílula pós-jogada).
