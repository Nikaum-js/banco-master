# Quickstart: Cartas ofensivas com alvo

## Verificar

```bash
bunx vitest run tests/game/cards   # testes de cartas (inclui ofensivas)
bunx vitest run tests/game         # suíte completa do motor (não pode regredir)
bun run build                      # tsc -b + vite, exit 0
```

## Fluxo (motor)

```ts
// Aquisição Hostil (alvo = propriedade de outro, sem construção)
playHandCard(state, 'p1', 'aquisicao-hostil-1', ports, posDoAlvo)
//   → posDoAlvo passa a ser de p1; p1 paga o preço (×1.5 aeroporto/utilidade) ao dono
// Despejo (alvo = cidade de outro com casas)
playHandCard(state, 'p1', 'despejo-1', ports, posCidade) // −1 casa ao banco; dono não recebe
// Auditoria Fiscal (alvo = jogador)
playHandCard(state, 'p1', 'auditoria-fiscal-1', ports, undefined, 'p2') // p2 paga 10% do patrimônio ao pote
```

## Cenários-chave (SC-001..005)

- **Aquisição**: transfere posse + paga preço ao dono; ×1,5 aeroporto/utilidade; +10% ao banco se hipotecada; gates (própria/construção/<2 não-hipotecadas/imune/sem caixa) → no-op. (SC-001/SC-004)
- **Despejo**: −1 casa ao banco, dono não recebe; sem casa/hotel/próprio/imune → no-op. (SC-002/SC-004)
- **Auditoria**: alvo paga 10% do patrimônio (ou o caixa) ao pote; self → no-op. (SC-003)
- **Imunidade Temporária (015)** bloqueia Aquisição/Despejo, não Auditoria. (SC-004)
- 3 cartas saem de no-op (catálogo `implementado`); round-trip JSON. (SC-005)

## Arquivos tocados

- `src/game/cards/ofensivas.ts` (novo) · `src/game/cards/draw.ts` · `src/game/cards/catalog.ts` · `src/game/store.ts`
- `tests/game/cards/ofensivas.test.ts`
