# Quickstart: Log de eventos real (M2)

## Verificar

```bash
bunx vitest run tests/game/log.test.ts   # emissões + bound
bunx vitest run tests/game               # suíte (campo log novo não regride)
bun run build                            # exit 0
bun run dev                              # VISUAL: Histórico mostra eventos reais (newest-first)
```

## O que muda

- `GameState.log` + `logEvent` (bounded 50).
- Núcleo do turno emite eventos (rolagem/GO/compra/aluguel/imposto/dívida/falência/saque).
- Painel **Histórico** consome `game.log` (substitui MOCK).

## Arquivos tocados

- `economy/types.ts` · `turn/types.ts` · `log.ts` (novo) · `turnMachine.ts` · `economy/purchase.ts` · `economy/resolveRentable.ts` · `turn/resolution.ts` · `falencia/falencia.ts` · `cards/draw.ts` · `store.ts` · `boards/shared.tsx`
- `tests/game/log.test.ts` (novo)
