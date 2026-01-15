# Quickstart: Cartas — efeitos temporários de N voltas

## Verificar

```bash
bunx vitest run tests/game/cards   # testes de cartas (inclui efeitos temporários)
bunx vitest run tests/game         # suíte completa do motor (não pode regredir)
bun run build                      # tsc -b + vite, exit 0
```

## Fluxo (motor)

```ts
// Apagão/Greve: imediatas (efeito no saque) — registram tempEffect lapsRemaining 1
// Boicote (mão, alvo de outro): playHandCard(state, 'p1', 'boicote-1', ports, alvoPos)
//   → quem parar em alvoPos não paga (2 voltas)
// Imunidade Temporária (mão, alvo próprio): playHandCard(state, 'p1', 'imunidade-1', ports, minhaPos)
//   → minhaPos não pode ser alvo de Boicote (2 voltas)
// Expiração: ao originador passar pelo GO → tickTempEffects decrementa; remove em 0
```

## Cenários-chave (SC-001..005)

- **Apagão**: aeroporto com Hangar cobra base (sem ×2) enquanto ativo. (SC-001)
- **Greve**: utilidade cobra $0 enquanto ativa. (SC-001)
- **Boicote**: propriedade alvo não cobra aluguel; alvo próprio/sem dono/imune → rejeitado. (SC-002)
- **Imunidade Temporária**: bloqueia Boicote naquela propriedade; alvo não-próprio → rejeitado. (SC-003)
- **Expiração**: Apagão/Greve em 1 volta, Boicote/Imunidade em 2 (GO do originador). (SC-004)
- **Tax Man**: respeita boicote/greve/apagão; round-trip JSON de `tempEffects`. (SC-005)

## Arquivos tocados

- `economy/types.ts` · `turn/types.ts` · `economy/tempEffects.ts` (novo) · `cards/effects.ts` · `cards/draw.ts` · `economy/resolveRentable.ts` · `balancing/taxMan.ts` · `cards/catalog.ts` · `store.ts` · `ui/GameHUD.tsx`
- `tests/game/cards/tempEffects.test.ts`
