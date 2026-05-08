# Implementation Plan: Leilão de casas em escassez (M2)

**Branch**: `main` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-leilao-casas-escassez/spec.md`

**Depende de**: 004 (construção / estoque do banco / tipo `HouseAuction`) · 024 (padrão de evento autônomo no estado)

## Summary

Transformar o leilão de casas em **evento autônomo** no estado, fora da resolução de turno: novo campo `GameState.houseAuction: HouseAuction | null`. Refatorar `economy/houseAuction.ts` para operar nesse campo — `openHouseAuction(state, housesAvailable, bidders)` seta o campo; `placeHouseBid(state, playerId, amount)` valida (> atual, ≤ caixa, participante) e atualiza; `closeHouseAuction(state)` transfere as casas ao vencedor (debita lance, `bank.houses -= housesAvailable`) e **limpa o campo sem tocar no turno**. Remover o `house-auction` da `ResolutionSlice`/`activeModal`/`AuctionCard` (código morto/bugado — usava `placeBid`) e `declareBuildInterest` (abrimos já com todos). UI: botão "Leilão de casas" no `PlayersPanel` (habilitado: banco com casas + ≥2 não-eliminados + sem leilão aberto) + `HouseAuctionLayer` (modal dedicado, padrão do `TradeLayer`, lê `game.houseAuction`): casas/lance/maior licitante + seletor de licitante + valor + "Dar lance" + "Encerrar". Sem timer.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19

**Primary Dependencies**: Zustand, Tailwind, Vite 8, Vitest, `motion/react`. Sem novas deps.

**Storage**: N/A — `houseAuction` no `GameState` serializável (VII).

**Testing**: Vitest sobre os reducers do campo (`openHouseAuction`/`placeHouseBid`/`closeHouseAuction`). Modal validado no `bun run dev`.

**Target Platform**: Web (SPA), desktop.

**Project Type**: Single project (web SPA).

**Performance Goals**: 60 fps; reducers O(jogadores).

**Constraints**: Não tocar no estado do turno ao abrir/fechar. Reusar o tipo `HouseAuction` (`deadline` ignorado — sem timer). Texto pt-BR.

**Scale/Scope**: 1 campo novo + refactor de 3 reducers (de resolução → campo) + remoção de código morto + 1 modal + 1 botão.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SRS é fonte de verdade**: ✅ §5.4 (leilão de casas em escassez). Regras gerais de leilão (§7) reaproveitadas.
- **II. Discovery antes de código**: ✅ spec 026 aprovada (gatilho manual decidido com o usuário) antes do plano.
- **III. Tesouro impacta**: ✅ n/a.
- **IV. Catch-up discreto**: ✅ n/a.
- **V. Sem cooperação obrigatória**: ✅ leilão é opcional; não cria gate de cooperação.
- **VI. Privacidade de cartas**: ✅ n/a.
- **VII. Resiliência de sessão**: ✅ `houseAuction` no estado serializável; reabrir reabre o leilão. Sem estado efêmero (sem timer).

**Resultado**: PASS. Refactor remove código morto (house-auction de resolução) — comportamento de jogo não regride (não era acionado). Sem Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/026-leilao-casas-escassez/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── houseAuction.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── game/
│   ├── economy/types.ts        # ResolutionSlice -house-auction (HouseAuction type fica)
│   ├── economy/houseAuction.ts # reducers operam em state.houseAuction; -declareBuildInterest; close não mexe no turno
│   ├── turn/types.ts           # GameState += houseAuction: HouseAuction | null
│   ├── store.ts                # seed null; comandos (assinaturas s/ `now`); -declareBuildInterest; rearmAuction só property
│   └── ui/
│       ├── modals/activeModal.ts   # -variante house-auction
│       ├── modals/ModalLayer.tsx   # AuctionCard só 'auction'
│       └── houseAuction/HouseAuctionLayer.tsx  # NOVO — modal do leilão de casas (lê game.houseAuction)
├── boards/shared.tsx           # botão "Leilão de casas" no PlayersPanel
└── App.tsx                     # monta <HouseAuctionLayer/>

tests/
└── game/
    ├── economy/houseAuction.test.ts  # refatorado p/ a API de campo
    └── ui/activeModal.test.ts        # remove o caso house-auction
```

**Structure Decision**: Single project. Evento autônomo no estado (espelha `pendingTrade` do 024). Modal próprio (`HouseAuctionLayer`, padrão do `TradeLayer`) lendo `game.houseAuction` — não passa pelo `activeModal` (que é de resolução de turno).

## Notas de design (resolvidas na Fase 0)

- **Campo separado, não resolução**: `game.houseAuction` é independente de `turn`/`resolution`. Abrir/fechar não chamam `completeResolution` → o turno em andamento fica intacto (corrige o acoplamento que perderia a rolagem).
- **Sem timer**: fecho manual (botão "Encerrar"). O `deadline` do tipo `HouseAuction` fica setado mas ignorado (ou 0). `rearmAuction` no store deixa de tratar `house-auction` (só `auction` de propriedade).
- **Abre com todos os licitantes**: `openHouseAuction` recebe os ids não-eliminados; `declareBuildInterest` removido (sem interesse dinâmico no MVP).
- **`placeHouseBid` no single-client**: o modal escolhe QUAL jogador dá o lance (o usuário controla todos); o reducer valida participante + > atual + ≤ caixa.
- **Remoção de código morto**: o `house-auction` da `ResolutionSlice` + caso no `activeModal`/`AuctionCard` + caso no `activeModal.test` são removidos (nunca acionados em jogo). `houseAuction.test.ts` é reescrito para a API de campo.

## Complexity Tracking

> Sem violações de constitution — seção vazia.
