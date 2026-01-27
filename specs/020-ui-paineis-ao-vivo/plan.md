# Implementation Plan: UI jogável (M2) — painéis laterais ao vivo

**Branch**: `main` (feature dir `020-ui-paineis-ao-vivo`) | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/020-ui-paineis-ao-vivo/spec.md`

## Summary

1ª fatia do M2: os painéis laterais deixam de usar MOCK e passam a refletir o `GameState` real. Função pura **`playersView(game): Player[]`** (mapeia jogadores reais → o view-model `Player` do `shared.tsx`; cor por assento via paleta) + hook fino `useLivePlayers()`. O `PlayersPanel` lista os jogadores reais; a seção **"Turno"** do `ActionsPanel` usa o ativo real + `goBonus` (Próx. GO) + `centerPot` (pote). **Reusa os componentes visuais existentes** (`PlayerRow`/`PlayerFace`/blocos). Log e Trades seguem MOCK (próximas fatias). Sem mudança de motor → suíte verde; parte testável = `playersView` (pura).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8 + Zustand + motion/react). **Dependencies**: nenhuma nova. **Storage**: N/A (UI lê o store). **Testing**: Vitest no `playersView` (puro); UI sem RTL → validação visual (`bun run dev`) + `bun run build`. **Constraints**: só leitura reativa; reuso visual total; sem regra nova.

**Scale/Scope**: `boards/shared.tsx` — `playersView`/`useLivePlayers` + paleta; rewire `PlayersPanel` (lista) e `ActionsPanel` (seção Turno: ativo/GO/pote/cartas/tickets). Teste `tests/game/ui/playersView.test.ts`.

## Constitution Check

| Princípio | Avaliação | Status |
|---|---|---|
| I. SRS verdade | §12.3 (HUD reflete estado: caixa/vez/mão/Bus Tickets/efeitos). | ✅ |
| II. Discovery antes de código | Spec + fatia escolhidas pelo usuário; reuso visual confirmado. | ✅ |
| IV. Catch-up discreto | "Próx. GO" já era exibido; valor real sem rótulo de catch-up. | ✅ |
| VI. Privacidade de cartas | Painel mostra só **contador** de mão (não as cartas) — preservado. | ✅ |
| VII. Resiliência | UI deriva do snapshot; nada novo no estado. | ✅ |

(III/V N/A.) **Sem violações.**

## Project Structure

```text
specs/020-ui-paineis-ao-vivo/{plan,research,data-model,quickstart}.md · contracts/ui.md · checklists/

src/boards/shared.tsx   # MOD — playersView(game)+useLivePlayers()+PLAYER_COLORS; PlayersPanel e ActionsPanel(Turno) ao vivo
tests/game/ui/playersView.test.ts # NOVO — mapeamento puro GameState→Player[]
```

**Structure Decision**: a lógica de mapeamento é **pura** (`playersView`) → testável sem React; o hook `useLivePlayers` só liga ao `useGameStore`. Os painéis reusam os componentes desenhados, trocando a **fonte** (MOCK → store). Log/Trades intactos (MOCK) nesta fatia.

## Complexity Tracking

> Sem violações. Vazio.
