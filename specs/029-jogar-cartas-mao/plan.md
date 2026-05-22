# Implementation Plan: Painel "Minhas Cartas" e jogar cartas da mão (§12.4)

**Branch**: `main` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-jogar-cartas-mao/spec.md`

**Depende de**: 006 (cartas/mão/timing) · 015 (Boicote/Imunidade Temp) · 016 (Aquisição/Despejo/Auditoria + gates `canAcquire`/`canEvict`/`canAudit`) · 017 (`reactorFor`/reação) · 022 (ModalLayer/activeModal + mapas de rótulo/cor) · 020 (padrão de painel ao vivo)

## Summary

Expor a mão do jogador na tela (§12.4) e permitir **jogar** cada carta, escolhendo alvo quando preciso. **Zero mudança de motor**: consome `playHandCard(cardId, target?, targetPlayer?)` (store, aplica ao jogador ativo) e os critérios de validade já existentes (`reactorFor` para aquisição/despejo/boicote; `canAudit`; dono-próprio para imunidade). Duas peças puras testáveis: `handCardsView(game, playerId)` (lista da mão + `playable`/`reason` por timing) e `cardTargets(game, playerId, cardId)` (alvos válidos por carta, reusando os gates). UI: painel "Minhas Cartas" (aba no painel lateral) + seletor de alvo (`HandCardLayer`) + store de UI `useHandCardUI`. Os mapas `RARITY_COLOR`/`CARD_LABEL`/`CARD_DESC`, hoje privados do `ModalLayer`, são extraídos para um módulo compartilhado e reaproveitados (sem mudança de comportamento). Cartas de reação (Diplomacia/Bunker) aparecem com "Usar" desabilitado — disparam pelo prompt do HUD (017).

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19

**Primary Dependencies**: Zustand, Tailwind, Vite 8, Vitest. Sem novas deps.

**Storage**: N/A — lê `GameState` (mão = `player.hand: string[]`), serializável.

**Testing**: Vitest sobre `handCardsView` (jogável/não-jogável + motivo por timing) e `cardTargets` (alvos válidos por carta). Painel/seletor validados no `bun run dev`.

**Target Platform**: Web (SPA), desktop.

**Project Type**: Single project (web SPA).

**Performance Goals**: 60 fps; seletores O(mão) e O(casas).

**Constraints**: Não mudar regra nem estado do motor. Privacidade (VI): só a mão do próprio jogador. Texto pt-BR.

**Scale/Scope**: 2 seletores puros + extração de 1 módulo de metadados + painel + seletor de alvo + store de UI + mount.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SRS é fonte de verdade**: ✅ §12.4 (painel "Minhas Cartas") + §10.6 (efeitos). Operacionaliza, não inventa.
- **II. Discovery antes de código**: ✅ spec 029 aprovada.
- **III. Tesouro impacta**: ✅ n/a (UI).
- **IV. Catch-up discreto**: ✅ n/a.
- **V. Sem cooperação obrigatória**: ✅ n/a.
- **VI. Privacidade de cartas**: ✅ **central** — painel mostra só a mão do próprio jogador; demais veem só a quantidade (já hoje). Reação privada (017) preservada.
- **VII. Resiliência de sessão**: ✅ nenhum estado novo no `GameState`; UI deriva de estado serializável; `useHandCardUI` é efêmero (qual carta está escolhendo).

**Resultado**: PASS. Sem mudança de motor → suíte de cartas (006/015/016/017) intacta. Sem Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/029-jogar-cartas-mao/
├── plan.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── hand-ui.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── game/ui/cards/cardMeta.ts        # NOVO — RARITY_COLOR/CARD_LABEL/cardLabel/CARD_DESC (extraídos do ModalLayer)
├── game/ui/cards/handView.ts        # NOVO — handCardsView(game, playerId) + cardTargets(game, playerId, cardId) (puro)
├── game/ui/cards/HandPanel.tsx      # NOVO — painel "Minhas Cartas" (consome handCardsView)
├── game/ui/cards/HandCardLayer.tsx  # NOVO — overlay seletor de alvo (consome cardTargets) + useHandCardUI
├── game/ui/modals/ModalLayer.tsx    # importa os mapas de cardMeta (sem duplicação; mesmo comportamento)
├── boards/shared.tsx                # aba/botão "Minhas Cartas" no painel lateral
└── App.tsx                          # monta HandCardLayer

tests/
└── game/ui/handView.test.ts         # handCardsView + cardTargets (puro, sem RTL)
```

**Structure Decision**: Single project. As peças puras vivem em `game/ui/cards/` (espelha `game/ui/deed/` do 023 e `game/ui/trade/` do 024). A UI reusa o vocabulário visual (cartão coffee, raridade) dos modais.

## Notas de design (resolvidas na Fase 0)

- **Quem é o "eu" do painel**: o store aplica `playHandCard` ao **jogador ativo**; o painel mostra a mão do **jogador ativo** (`game.players[game.turnOrder[game.activeSeat]]`) — coerente com timing `proprio-turno`/`preso`. `handCardsView(game, playerId)` recebe o id para ser puro/testável e à prova de MP futuro.
- **`playable` + `reason`** por timing: `reacao` → desabilitado ("usada automaticamente"); `proprio-turno` e não é a vez → "Só no seu turno"; `preso` e não preso → "Só quando preso"; carta de alvo sem alvo válido → "Sem alvo válido". Caso contrário, habilitada.
- **`cardTargets`** (reusa o motor, sem novo gate): aquisição/despejo/boicote → posições onde `reactorFor(game, effect, playerId, pos, null) !== null` (encapsula `canAcquire`/`canEvict` + dono/temp-imune do boicote); auditoria → jogadores onde `canAudit(game, playerId, id)`; imunidade → propriedades onde `ownerOf(game, pos) === playerId`. Cartas sem alvo → `null`. Diplomacia já é interceptada pelo motor ao chamar `playHandCard` — a UI não trata.
- **Extração dos mapas**: mover `RARITY_COLOR`/`CARD_LABEL`/`cardLabel`/`CARD_DESC` para `cardMeta.ts`; `ModalLayer` passa a importar de lá (mesmos valores → modais 022/025 inalterados).
- **Fluxo de "Usar"**: sem alvo → chama `playHandCard(id)` direto. Com alvo → `useHandCardUI.open(id)`; o `HandCardLayer` lista os alvos válidos (`cardTargets`), e ao escolher chama `playHandCard(id, target?, targetPlayer?)` e fecha.
- **Reação** (Diplomacia/Bunker): continuam no prompt do `GameHUD` (017); no painel só aparecem desabilitadas.

## Complexity Tracking

> Sem violações de constitution — seção vazia.
