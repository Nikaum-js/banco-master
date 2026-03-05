# Implementation Plan: Modais centrais (M2) — interações dirigidas por resolução

**Branch**: `main` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-modais-centrais/spec.md`

**Depende de**: 002 (FSM/`resolution`) · 003 (compra/leilão/leilão de casas) · 006 (descarte/Atalho) · 020 (seletor puro + store na UI) · 021 (Histórico ao vivo)

## Summary

Trazer para o **centro do tabuleiro** as decisões hoje espremidas na barra do `GameHUD`, para os cinco estados de resolução que o motor **já pausa**: compra de propriedade, leilão de propriedade, leilão de casas, descarte por mão cheia e Atalho ±3. É **puramente UI** — nenhuma regra do motor muda. O coração é uma função pura `activeModal(game) → ModalView | null` (mesmo padrão de `playersView` do 020), testável sem render; um componente `ModalLayer` consome esse descritor e renderiza o cartão central apropriado, disparando os comandos já existentes do store (`buyProperty`/`declineProperty`/`placeBid`/`passBid`/`discardCard`/`chooseCardShortcut`). O `GameHUD` deixa de exibir esses cinco ramos (delega ao `ModalLayer`), evitando duplicação.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19

**Primary Dependencies**: Zustand (store), Tailwind (estilo), Vite 8 (build), Vitest (testes). Sem novas dependências.

**Storage**: N/A (estado em memória no store; `GameState` serializável já existente)

**Testing**: Vitest sobre a função pura `activeModal` (sem RTL no projeto). Render validado manualmente em `bun run dev`.

**Target Platform**: Web (SPA), navegador desktop.

**Project Type**: Single project (web SPA) — `src/` único, sem backend nesta fatia.

**Performance Goals**: 60 fps; o seletor é O(1) sobre o estado; nenhum custo perceptível.

**Constraints**: Não alterar `src/game/` (motor). Reaproveitar o vocabulário visual existente (`PropertyPopover`/`AirportPopover`/`UtilityPopover`, cartas). Texto em pt-BR.

**Scale/Scope**: 5 estados de modal + caso vazio; 1 função pura + 1 camada de modais (com 4–5 subcomponentes de conteúdo); ~1 arquivo novo de UI + ajustes no `GameHUD` e no `App`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SRS é fonte de verdade**: ✅ opera os modais obrigatórios do SRS §12.1/§12.2; não inventa regra.
- **II. Discovery antes de código**: ✅ spec 022 aprovada (escopo decidido com o usuário) antes do plano.
- **III. Tesouro impacta**: ✅ n/a (sem cartas novas; só revela a mão do próprio jogador no descarte).
- **IV. Catch-up discreto**: ✅ n/a (modais não expõem mecânicas de catch-up).
- **V. Sem cooperação obrigatória**: ✅ n/a.
- **VI. Privacidade de cartas**: ✅ **relevante** — o modal de descarte exibe **apenas** a mão do jogador da vez; nenhum modal revela cartas alheias (FR-006/SC-003). Contadores de adversários seguem no painel (021/020).
- **VII. Resiliência de sessão**: ✅ o descritor é derivado do estado serializável; reabrir/reconstruir o estado reabre o mesmo modal. Sem estado efêmero crítico (o campo de lance é local e descartável).

**Resultado**: PASS, sem violações. Nenhuma entrada em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/022-modais-centrais/
├── plan.md              # Este arquivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1 (ModalView)
├── quickstart.md        # Fase 1 (como validar)
├── contracts/
│   └── activeModal.md   # Contrato da função pura estado→descritor
├── checklists/
│   └── requirements.md  # (do /speckit-specify)
└── tasks.md             # (/speckit-tasks — depois)
```

### Source Code (repository root)

```text
src/
├── game/
│   ├── store.ts                # (sem mudança) — comandos já expostos
│   └── ui/
│       ├── GameHUD.tsx         # AJUSTE: remover os 5 ramos dirigidos por resolução cobertos pelos modais
│       └── modals/
│           ├── activeModal.ts  # NOVO — função pura activeModal(game): ModalView | null
│           └── ModalLayer.tsx  # NOVO — consome activeModal + store; renderiza o cartão central
├── boards/
│   └── shared.tsx              # REUSO: PropertyPopover/AirportPopover/UtilityPopover, vocabulário de carta
└── App.tsx                     # AJUSTE: montar <ModalLayer/> sobre o tabuleiro

tests/
└── game/
    └── ui/
        └── activeModal.test.ts # NOVO — cobre os 5 estados + caso "nenhum"
```

**Structure Decision**: Single project. A lógica testável (`activeModal`) vai para `src/game/ui/modals/` (perto do `GameHUD`, fora de `src/game/` puro do motor para deixar claro que é camada de apresentação). O teste acompanha o padrão de `tests/game/ui/playersView.test.ts` (020). `ModalLayer` é o único ponto com efeito (chama comandos do store), análogo ao `GameHUD`.

## Notas de design (resolvidas na Fase 0)

- **`activeModal` é a fonte única de verdade da UI de modais**: tanto o `ModalLayer` (o que renderizar) quanto o `GameHUD` (o que **esconder**) consultam o mesmo predicado, evitando divergência (FR-009). Prático: `GameHUD` faz `if (activeModal(game)) return null /* nos ramos cobertos */` ou simplesmente não trata esses `res.kind`.
- **Leilão de casas vs. propriedade**: ambos `kind` distintos no `ModalView`; o de casas não tem "Passar" (regra do `houseAuction`).
- **Campo de valor no lance**: estado **local** do `ModalLayer` (não vai pro `GameState`), default = `currentBid + 50`. Princípio VII preservado (nada essencial fora do estado serializável).
- **Cronômetro do leilão**: o `ModalLayer` apenas **exibe** o deadline; o fechamento automático já é do store (`rearmAuction`/timer). Não duplicar timer.

## Complexity Tracking

> Sem violações de constitution — seção vazia.
