# Quickstart: Tax Man (Fiscal)

## Verificar

```bash
bunx vitest run tests/game/balancing   # testes de balanceamento (inclui o Fiscal)
bunx vitest run tests/game             # suíte completa do motor (não pode regredir)
bun run build                          # tsc -b + vite, exit 0
```

## Fluxo (motor)

```ts
// O Fiscal é automático: dispara em advanceSeat (fim de cada turno) via porta taxMan.
// Unitário:
rollTaxMan(state, rng)   // move o token 2 dados; se parar em propriedade c/ dono → debita o aluguel (banco)

// Integração (turno): com ctx cujo ports inclui taxMan, finalizeTurn → advanceSeat → Fiscal move 1×.
```

## Cenários-chave (SC-001..005)

- **Cobra o dono**: Fiscal para em cidade com dono não hipotecada → dono debitado do aluguel (mesmo cálculo do aluguel normal: construção/grupo/×3/Hangar). (SC-001)
- **Sem efeito**: para em casa sem dono, hipotecada, canto/imposto/carta/Bus Ticket → nada. (SC-002)
- **1×/turno**: move uma vez por turno (não na re-rolagem de dupla). (SC-003)
- **Própria propriedade**: cobra o dono mesmo se for o jogador cujo turno acabou. (SC-004)
- **Determinístico**: mesmo RNG → mesmo movimento/cobrança; round-trip JSON do `taxManPos`. (SC-005)
- **Dono sem caixa**: debita o que houver (sem negativo; sem falir nesta versão).

## Arquivos tocados

- `src/game/balancing/taxMan.ts` (novo) · `src/game/turn/types.ts` · `src/game/turn/resolution.ts` · `src/game/turn/turnMachine.ts` · `src/game/store.ts`
- `tests/game/balancing/taxMan.test.ts`
