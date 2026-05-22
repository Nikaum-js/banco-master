---
description: "Task list — Painel 'Minhas Cartas' e jogar cartas da mão (§12.4)"
---

# Tasks: Painel "Minhas Cartas" e jogar cartas da mão (§12.4)

**Input**: Design documents from `/specs/029-jogar-cartas-mao/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/hand-ui.md, quickstart.md

**Tests**: seletores puros por Vitest; painel/seletor de alvo validados por build + `bun run dev`.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Peças puras + UI em `src/game/ui/cards/`; testes em `tests/game/ui/handView.test.ts`. Sem mudança de motor.

---

## Phase 1: Setup

- [X] T001 Criar `src/game/ui/cards/cardMeta.ts` extraindo `RARITY_COLOR`, `CARD_LABEL`, `cardLabel(effect)` e `CARD_DESC` de `src/game/ui/modals/ModalLayer.tsx`; `ModalLayer` passa a importar de `cardMeta` (mesmos valores → modais 022/025 inalterados).

---

## Phase 2: Foundational (peças puras — bloqueiam a UI)

- [X] T002 [P] Criar `src/game/ui/cards/handView.ts` com `cardTargets(game, playerId, cardId): CardTargets | null` — aquisição/despejo/boicote via `reactorFor` (017); auditoria via `canAudit`; imunidade via `ownerOf === playerId`; sem alvo → `null`.
- [X] T003 Em `src/game/ui/cards/handView.ts`: `handCardsView(game, playerId): HandCardView[]` — por carta da mão: `{ id, effect, label, desc, rarityColor, timing, needsTarget, playable, reason? }`; regra de `playable`/`reason` por timing + alvo (contrato). Usa `cardTargets` (T002) p/ `needsTarget`/"Sem alvo válido".

---

## Phase 3: User Story 1 - Ver a mão e usar cartas sem alvo (Priority: P1) 🎯 MVP

### Tests for User Story 1 ⚠️

- [X] T004 [P] [US1] Em `tests/game/ui/handView.test.ts`: `handCardsView` — reação → `playable false` (motivo reação); `proprio-turno` fora da vez → false "Só no seu turno"; "Saia da Prisão" preso/não-preso → true/false "Só quando preso"; campos `label`/`desc`/`rarityColor`/contador derivados (SC-002).

### Implementation for User Story 1

- [X] T005 [US1] Criar `src/game/ui/cards/HandPanel.tsx` — consome `handCardsView(game, ativo)`; cartão por carta (cor de raridade + nome + efeito), contador "X / 3", botão "Usar" (`disabled=!playable`, `title=reason`); sem alvo → `playHandCard(id)`.
- [X] T006 [US1] Em `src/boards/shared.tsx`: expor "Minhas Cartas" (aba/seção no painel lateral) montando `HandPanel` para o jogador da vez.

**Checkpoint**: painel lista a mão; "Usar" gated por timing; cartas sem alvo jogáveis; suíte de cartas verde.

---

## Phase 4: User Story 2 - Usar cartas que exigem alvo (Priority: P2)

### Tests for User Story 2 ⚠️

- [X] T007 [P] [US2] Em `tests/game/ui/handView.test.ts` (+casos): `cardTargets` — Aquisição só propriedades elegíveis; Despejo só cidades de outro com ≥1 casa; Boicote propriedades de outro; Auditoria adversários não eliminados; Imunidade só próprias; carta sem alvo → `null`; carta de alvo sem alvo → `handCardsView.playable false` "Sem alvo válido" (SC-003).

### Implementation for User Story 2

- [X] T008 [US2] Criar `src/game/ui/cards/HandCardLayer.tsx` + `useHandCardUI` (store efêmero `{cardId, open, close}`); lê `cardTargets`, lista posições (nome+dono) e/ou jogadores; escolher → `playHandCard(id, target?, targetPlayer?)` + fecha; cancelar fecha. `HandPanel`: carta de alvo → `useHandCardUI.open(id)`.
- [X] T009 [US2] Em `src/App.tsx`: montar `HandCardLayer`.

**Checkpoint**: cartas de alvo jogáveis; só alvos válidos oferecidos; Diplomacia abre reação (motor).

---

## Phase 5: Polish

- [X] T010 [P] `bunx vitest run tests/game` (verde, inclui handView; 006/015/016/017 intactos) + `bun run build` (exit 0).
- [ ] T011 Validação visual no `bun run dev` (roteiro do quickstart): sacar → painel; timing; sem-alvo (Saia da Prisão); com-alvo (Imunidade/Boicote/Aquisição); privacidade.

---

## Dependencies & Execution Order

- T001 (setup) → T002 → T003 (puras) → T004 (teste US1) → T005/T006 (UI US1) → T007 (teste US2) → T008/T009 (UI US2) → T010/T011 (polish).
- `handView.ts` tocado por T002/T003 (sequencial). Componentes em arquivos próprios.

### Parallel Opportunities

- T002 e T004 marcadas [P] (arquivos distintos). US1 (painel + sem-alvo) é o MVP; US2 (alvos) soma em cima.

---

## Notes

- **Zero mudança de motor**: só consome `playHandCard` + `reactorFor`/`canAudit`/`ownerOf`. Suíte de cartas garante não-regressão.
- **Privacidade (VI)**: painel só do jogador da vez; demais seguem só com a quantidade.
- **`/speckit-implement` autorizado**, exceto acabamento visual (T011).
- **Deferido (M3 / fatia futura)**: notificação "Aquisição Hostil sofrida" e modal "Free Parking coletado" (ver spec §Out of Scope).
