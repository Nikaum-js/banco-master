# Quickstart: Cartas de reação (Diplomacia, Bunker Fiscal)

## Verificar

```bash
bunx vitest run tests/game/cards   # testes de cartas (inclui reação)
bunx vitest run tests/game         # suíte completa do motor (não pode regredir)
bun run build                      # tsc -b + vite, exit 0
```

## Fluxo (motor)

```ts
// Diplomacia: alvo tem 'diplomacia' na mão
playHandCard(state, 'p1', 'aquisicao-hostil-1', ports, posDoP2) // p2 tem Diplomacia
//   → resolution = reaction-diplomacia (não aplicou ainda)
respondReaction(state, true,  ports) // p2 usa Diplomacia → Aquisição cancelada (ambas recicladas)
respondReaction(state, false, ports) // p2 recusa → Aquisição aplicada

// Bunker: jogador para em casa de imposto com 'bunker-fiscal' na mão
resolvePending(state, ctx) // ctx.resolve → taxBunkerResolve → reaction-bunker
respondReaction(state, true,  ports) // usa Bunker → não paga
respondReaction(state, false, ports) // recusa → paga (ou dívida)
```

## Cenários-chave (SC-001..005)

- **Diplomacia abre/usa/recusa**: alvo com Diplomacia → reação; usar cancela (recicla ambas); recusar aplica. Alvo sem Diplomacia → ofensiva direto. (SC-001/SC-002)
- **Bunker**: imposto com Bunker → reação; usar cancela; recusar paga (ou dívida). Sem Bunker → cobra direto. (SC-003)
- **Desbloqueio**: após responder, o turno finaliza. (SC-004)
- **0 cartas deferidas** (catálogo `implementado`); round-trip JSON. (SC-005)

## Arquivos tocados

- `economy/types.ts` · `cards/ofensivas.ts` · `cards/reacao.ts` (novo) · `cards/draw.ts` · `cards/catalog.ts` · `store.ts` · `ui/GameHUD.tsx`
- `tests/game/cards/reacao.test.ts`
