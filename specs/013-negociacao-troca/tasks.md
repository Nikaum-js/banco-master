---
description: "Task list — Negociação (troca de propriedades e caixa)"
---

# Tasks: Negociação — troca de propriedades e caixa

**Input**: Design documents from `/specs/013-negociacao-troca/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/trade.md, quickstart.md

**Tests**: INCLUÍDOS — Vitest; `executeTrade` puro (sem RNG). SC-001…005 como asserções.

**Organization**: por user story (P1 troca / P2 hipoteca) + polish. Novo módulo `economy/trade.ts`. **Sem UI** (M2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável · **[Story]**: US1/US2 (foundational/polish sem label)

## Path Conventions

Novo `src/game/economy/trade.ts`; comando no `src/game/store.ts`. Testes em `tests/game/economy/negociacao.test.ts`. Reusa `ownerOf` (003), `cityLevel` (011), `transferKeepFee`/`mortgageValue` (005).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T001 Em `src/game/economy/trade.ts`: tipo `Trade { fromId, toId, fromProps[], fromCash, toProps[], toCash }` + `executeTrade(state, trade)` — validação atômica (paused; fromId≠toId; ambos não-eliminados; cash≥0; posse via `ownerOf`; sem cidade com construção via `cityLevel>0`; `from.cash≥fromCash`/`to.cash≥toCash`; `finalFrom/finalTo≥0` após `transferKeepFee` das hipotecadas) e aplicação (troca `ownerId`, transfere `cash`, taxas ao banco)

**Checkpoint**: a lógica pura da troca existe e é testável.

---

## Phase 3: User Story 1 - Trocar propriedades e dinheiro (Priority: P1) 🎯 MVP

**Goal**: troca acordada entre dois jogadores (propriedades + caixa), atômica, não gated por turno; inválidas rejeitadas.

**Independent Test**: dar props/caixa a p1/p2; trocar e verificar donos/caixas; inválidas (não possui, construção, sem caixa, mesmo jogador, pausado) → no-op.

### Tests for User Story 1 ⚠️

- [X] T002 [P] [US1] Vitest em `tests/game/economy/negociacao.test.ts`: troca válida (props trocam de dono, caixa transferido); unilateral (só caixa / só prop); rejeições (não possui; cidade com construção `cityLevel>0`; oferece mais caixa do que tem; fromId===toId; eliminado; pausado) deixam o estado inalterado (SC-001/SC-002)

### Implementation for User Story 1

- [X] T003 [US1] Em `src/game/store.ts`: comando `executeTrade(trade: Trade): void` (interface `GameStore` + impl; **não** gated por turno) — `set((st) => ({ game: executeTrade(st.game, trade) }))`

**Checkpoint**: troca de propriedades + caixa funcional pelo store.

---

## Phase 4: User Story 2 - Transferir propriedade hipotecada (Priority: P2)

**Goal**: hipotecada trocada chega hipotecada e cobra 10% (`transferKeepFee`) do recebedor ao banco; sem caixa p/ a taxa → rejeita.

**Independent Test**: trocar uma hipotecada → recebedor debitado de 10% do valor da hipoteca; `mortgaged` preservado; Hangar acompanha o aeroporto.

### Tests for User Story 2 ⚠️

- [X] T004 [P] [US2] Vitest em `tests/game/economy/negociacao.test.ts`: hipotecada trocada → recebedor paga `transferKeepFee` (10% do `mortgageValue`) ao banco, `mortgaged` preservado; recebedor sem caixa p/ a taxa → no-op; aeroporto com Hangar trocado mantém `hangar=true` no novo dono (SC-003/SC-004)

### Implementation for User Story 2

> Coberto pela `executeTrade` da T001 (fees + flags acompanham); esta story valida o ramo de hipoteca/Hangar.

**Checkpoint**: regra §6.3 aplicada na troca; Hangar acompanha.

---

## Phase 5: Integração & Polish

- [X] T005 [P] Rodar `bunx vitest run tests/game`: SC-001…005 verdes **e** zero regressão em 002–012; round-trip JSON após troca
- [X] T006 [P] `bun run build` verde (tsc -b + vite)

---

## Dependencies & Execution Order

- **Foundational (T001)** contém quase toda a lógica (troca + hipoteca + Hangar). T003 expõe no store.
- **US1**: T001 → T003. **US2**: validada por T004 (lógica já em T001).
- **Polish (P5)**: suíte + build.

### Parallel Opportunities

- T002/T004 (testes) em paralelo. T001 e store (T003) sequenciais (T003 importa de T001).

---

## Implementation Strategy

1. Foundational (`executeTrade`) → US1 (store) → **VALIDAR** (SC-001/002) → US2 (hipoteca/Hangar) → suíte + build.

---

## Notes

- `executeTrade` = acordo **aceito** (UX propor/aceitar/recusar é M2/M3; recusar = não chamar) — espelha `grantLoan` (010).
- Cartas/Bus Tickets/empréstimos **não** estão no `Trade` (não-negociáveis, D-011/D-012).
- Construções de cidade bloqueiam a troca da propriedade (§8.2); Hangar acompanha o aeroporto (§13.6).
- Sem estado novo no `GameState`; sem UI (M2). Imunidade §8.4 → spec 014.
- **`/speckit-implement` autorizado** para o pipeline desta feature.
