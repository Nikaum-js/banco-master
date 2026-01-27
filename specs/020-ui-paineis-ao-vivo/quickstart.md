# Quickstart: UI painéis ao vivo (M2 fatia 1)

## Verificar

```bash
bunx vitest run tests/game     # playersView (puro) + motor sem regressão
bun run build                  # tsc -b + vite, exit 0
bun run dev                    # VISUAL: agir pelo HUD e ver os painéis refletirem caixa/vez/mão/pote ao vivo
```

## O que muda

- `PlayersPanel` lista os jogadores **reais** (caixa/token/mão/Bus Tickets/vez/eliminado + marcadores de empréstimo/imunidade).
- Seção "Turno" do `ActionsPanel`: ativo real + Próx. GO (`goBonus`) + pote (`centerPot`) + cartas/Bus Tickets do ativo.
- Reusa os componentes visuais (sem novo design). Log/Trades seguem MOCK.

## Arquivos tocados

- `src/boards/shared.tsx` (`playersView`/`useLivePlayers`/`PLAYER_COLORS`; rewire `PlayersPanel` e `ActionsPanel`)
- `tests/game/ui/playersView.test.ts` (novo)
