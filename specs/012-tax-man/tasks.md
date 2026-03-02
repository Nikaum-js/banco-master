---
description: "Task list — Tax Man (Fiscal)"
---

# Tasks: Tax Man (Fiscal)

**Input**: Design documents from `/specs/012-tax-man/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tax-man.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; `rollTaxMan` puro/determinístico (RNG injetável). SC-001…005 como asserções.

**Organization**: 1 user story (P1) + polish. Mecânica automática; gancho em `advanceSeat` via porta. **Sem UI**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1 (foundational/polish sem label)

## Path Conventions

Novo `balancing/taxMan.ts`; `taxManPos` em `turn/types.ts`; porta `taxMan` em `turn/resolution.ts`; chamada em `turn/turnMachine.ts` (`advanceSeat`); seed/wiring no `store.ts`. Testes em `tests/game/balancing/taxMan.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 [P] Em `src/game/turn/types.ts`: `GameState += taxManPos: number`
- [X] T002 [P] Em `src/game/turn/resolution.ts`: `TurnPorts += taxMan?(state: GameState, rng: RNG): void` (import `type { RNG }` de `./dice`)
- [X] T003 Em `src/game/store.ts`: `createSeedState` define `taxManPos: 0`

**Checkpoint**: estado e porta prontos (Fiscal ainda inerte).

---

## Phase 3: User Story 1 - O Fiscal pune quem domina o tabuleiro (Priority: P1) 🎯 MVP

**Goal**: a cada turno o Fiscal move (2 dados, puro) e, se parar em propriedade com dono não hipotecada, debita do dono o aluguel (removido da economia); demais casas, sem efeito.

**Independent Test**: posicionar o Fiscal para cair numa propriedade com dono e verificar o débito do aluguel; casas sem dono/hipotecada/não-propriedade → sem cobrança; 1×/turno.

### Tests for User Story 1 ⚠️

- [X] T004 [P] [US1] Vitest em `tests/game/balancing/taxMan.test.ts`: `rollTaxMan` move o token (RNG determinístico); para em cidade com dono → debita o aluguel correto (incl. construção/grupo); própria propriedade do dono também cobra; sem dono/hipotecada/canto → sem efeito; valor **removido** (nenhum crédito); dono sem caixa → debita o que houver (SC-001/SC-002/SC-004)
- [X] T005 [P] [US1] Vitest no mesmo arquivo: aeroporto com Hangar (×2) e utilidade (valor dos dados do Fiscal) cobram corretamente; integração — `finalizeTurn`→`advanceSeat` com `ctx` que inclui `taxMan` move o Fiscal **1×/turno** (não na re-rolagem de dupla); no-op com `phase==='ended'` (SC-003/SC-005)

### Implementation for User Story 1

- [X] T006 [US1] Em `src/game/balancing/taxMan.ts`: `rollTaxMan(state, rng)` — guard (`phase==='playing'`, ≥2 não-eliminados); `roll(rng,{speedDie:false})`; move `taxManPos` (puro, `% BOARD.length`); se property/airport/utility com dono e não hipotecada → debita `min(cash, aluguel)` (cidade `rentCity`+`groupHasSkyscraper`; aeroporto `rentAirport×Hangar`; utilidade `rentUtility×diceValue(r)`); sem crédito a ninguém
- [X] T007 [US1] Em `src/game/turn/turnMachine.ts`: em `advanceSeat`, antes do loop de assento, `ctx.ports.taxMan?.(s, ctx.rng)`
- [X] T008 [US1] Em `src/game/store.ts`: `ctx.ports` = `{ ...defaultPorts, taxMan: (s, rng) => rollTaxMan(s, rng) }` (defaultPorts **permanece sem** o Fiscal — zero regressão)

**Checkpoint**: o Fiscal opera a cada turno no jogo real (store) e nos testes com `taxMan` no ctx.

---

## Phase 4: Integração & Polish

- [X] T009 [P] Rodar `bunx vitest run tests/game`: SC-001…005 verdes **e** zero regressão em 002–011 (atenção: `defaultPorts` segue sem Fiscal; `taxManPos` novo no seed); round-trip JSON com `taxManPos`
- [X] T010 [P] `bun run build` verde (tsc -b + vite)

---

## Dependencies & Execution Order

- **Foundational (T001–T003)** bloqueia tudo (estado + porta).
- **US1**: `rollTaxMan` (T006) → gancho em `advanceSeat` (T007) → wiring no store (T008). Testes T004/T005 em paralelo.
- **Polish (P4)**: suíte + build.

### Parallel Opportunities

- T001/T002 [P] (arquivos distintos). T004/T005 [P] (mesmo arquivo de teste, blocos distintos).
- ⚠️ Sequenciais por arquivo: `turnMachine.ts` (T007), `store.ts` (T003/T008).

---

## Implementation Strategy

1. Foundational → US1 (rollTaxMan + gancho + wiring) → **VALIDAR** (SC-001…005) → suíte + build.

---

## Notes

- Gancho em `advanceSeat` = "a cada turno" (cobre finais normais/forçados/falência); 1×/turno (re-rolagem de dupla não passa por lá).
- `defaultPorts` **sem** o Fiscal de propósito (testes determinísticos); só o store injeta.
- Movimento **puro** (sem GO/prisão/carta); dinheiro **removido** (banco), não ao pote.
- Simplificação: Fiscal não fale jogador não-ativo (debita o que houver) — research R7.
- **`/speckit-implement` autorizado** para o pipeline desta feature.
