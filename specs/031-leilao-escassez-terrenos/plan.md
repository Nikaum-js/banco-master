# Implementation Plan: Leilão de escassez de terrenos (pregão simultâneo)

**Branch**: `main` (projeto trabalha em `main`) | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-leilao-escassez-terrenos/spec.md`

## Summary

Quando restam **≤3 terrenos sem dono** e há **≥2 jogadores vivos**, abrir automaticamente um **pregão simultâneo** por esses terrenos: cada lote é um leilão inglês próprio (lance/maior-licitante independentes), todos compartilham um **prazo** (`deadline`) que reinicia a cada lance (soft-close); ao expirar, cada lote com licitante é transferido ao maior lance (paga ao banco) e lotes sem lance ficam livres. Um jogador pode arrematar vários, limitado por uma **trava de solvência** (soma dos lances líderes ≤ caixa).

**Abordagem técnica:** novo evento **autônomo** no estado (`GameState.landAuction`), seguindo o padrão `pendingTrade`/`notice` (fora da `resolution`/turno) — **não** o leilão de `resolution` (003), que é atado ao turno e single-lote. Reusa o *padrão* do 003 (deadline serializável + timer no store reconstruído por `Date.now()`, knob de janela), generalizado para N lotes. Módulo puro novo `economy/landAuction.ts` + gatilho `maybeOpenLandAuction` chamado no store após eventos que mudam posse (compra, fechamento de leilão 003) e após falência (re-arma episódio). UI: `LandAuctionLayer` autônomo (como `TradeLayer`), montado no `App`.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18

**Primary Dependencies**: React + Vite + Tailwind + Zustand (estado). Sem libs novas.

**Storage**: Estado em memória (Zustand); `GameState` 100% serializável (JSON) para futura persistência Supabase (M3). Nenhuma persistência nova nesta feature.

**Testing**: Vitest (`bunx vitest run tests/game`) — reducers puros. UI validada manualmente no `bun run dev` (projeto não testa UI).

**Target Platform**: Web (SPA). Single-client hoje; multiplayer = M3.

**Project Type**: Single project (web app) — motor puro em `src/game/`, UI em `src/game/ui/` + `src/boards/`.

**Performance Goals**: Reducers O(nº lotes × nº jogadores) — trivial (≤3 lotes, ≤8 jogadores). UI 60fps; cronômetro via 1 `setTimeout` no store (igual 003).

**Constraints**: Estado serializável e reducers puros (clone via `structuredClone`); único efeito no store (Princípio VII). Texto pt-BR. **Não** reintroduzir `bank`/`houseAuction` (removidos na D-022).

**Scale/Scope**: ≤3 lotes por pregão, 2–8 jogadores, 1 pregão por vez.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
|---|---|
| **I. SRS é verdade** | A feature **adiciona** regra nova (gatilho de escassez de terrenos + pregão simultâneo) ao **SRS §7** e registra um **ADR** em DECISIONS — feito como parte da implementação **antes/junto** do código, mantendo o SRS como fonte. A spec apenas operacionaliza. ✅ |
| **II. Discovery antes de código** | Spec 031 aprovada; plano agora; `/speckit-implement` só após aprovação. ✅ |
| **III. Tesouro impacta** | N/A (não mexe em cartas). ✅ |
| **IV. Catch-up discreto** | O pregão é **neutro**, não é mecânica de catch-up; tende a favorecer quem tem caixa, mas **não** se rotula nem se disfarça como ajuda a quem perde. Sem violação. ✅ |
| **V. Sem cooperação obrigatória** | Lote sem lance **fica livre** (sem compra forçada); ninguém é obrigado a participar. ✅ |
| **VI. Privacidade de cartas** | N/A. ✅ |
| **VII. Resiliência de sessão** | `landAuction` (lotes, lances, líderes, `deadline`, participantes) é serializável; cronômetro reconstruído pelo `deadline` (mesmo padrão do 003). ✅ |

**Resultado:** sem violações. `Complexity Tracking` vazio.

## Project Structure

### Documentation (this feature)

```text
specs/031-leilao-escassez-terrenos/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas
├── data-model.md        # Phase 1 — entidades/estado
├── quickstart.md        # Phase 1 — como rodar/validar
├── contracts/
│   └── landAuction.md   # Phase 1 — contrato dos reducers + gatilho
└── tasks.md             # Phase 2 — gerado por /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/
├── economy/
│   ├── types.ts             # + interface LandAuction (e LandLot)
│   ├── landAuction.ts       # NOVO — reducers puros: open/placeLandBid/close + maybeOpenLandAuction + trava de solvência
│   ├── auction.ts           # (003) inalterado — referência de padrão
│   └── purchase.ts          # AUCTION_WINDOW reusado como janela do cronômetro
├── turn/
│   └── types.ts             # GameState += landAuction: LandAuction | null  (+ flag de episódio)
├── store.ts                 # init landAuction:null; comandos placeLandBid/closeLandAuction;
│                            #   chama maybeOpenLandAuction(now) após buy/closeAuction/finalize;
│                            #   agenda timer de fechamento pelo deadline (igual ao 003)
└── ui/
    ├── landAuction/
    │   └── LandAuctionLayer.tsx   # NOVO — modal autônomo: lotes + lance/maior-licitante + cronômetro + seletor de licitante (single-client)
    └── ... (App.tsx monta <LandAuctionLayer/>)

tests/game/economy/
└── landAuction.test.ts      # NOVO — abrir/lance/solvência/fechar/episódio (SC-001..007)

docs/
├── SRS.md                   # + §7.x: gatilho "escassez de terrenos" + subseção do pregão simultâneo
└── DECISIONS.md             # + ADR novo (D-023) — leilão de escassez de terrenos
```

**Structure Decision**: Single project, padrão consolidado do `src/game/` (motor puro + store + UI layer autônomo). O pregão segue o **padrão de evento autônomo** (`pendingTrade`/`notice`), não o de `resolution` (turno). Reuso do timer/`deadline` do 003 generalizado para N lotes via um módulo novo.

## Complexity Tracking

> Sem violações de constituição — seção vazia.
