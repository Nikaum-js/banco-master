# Quickstart: Empréstimos entre jogadores

## Verificar

```bash
npx vitest run tests/game/emprestimos   # testes desta feature
npx vitest run tests/game               # suíte completa do motor (não pode regredir)
npm run build                           # tsc -b + vite, exit 0
npm run dev                             # HUD: na dívida, "Pedir empréstimo"; "Quitar"; status de empréstimos
```

## Fluxo (motor)

```ts
// devedor ativo caiu numa dívida que não cobre (resolution.kind === 'debt')
let g = grantLoan(state, devedorId, credorId, principal, ratePct) // credor→devedor; registra loan
g = payDebt(g)                  // 008: quita a dívida com o caixa recém-emprestado
// ... voltas depois, ao passar pelo GO:
//   advance credita o bônus e chama afterPassGo → chargeLoanInterest (juros simples ao credor)
g = payOffLoan(g, devedorId)    // paga só o principal; remove o loan
```

## Cenários-chave (SC-001..005)

- **Conceder válido**: dívida ativa, taxa 10–50%, credor com caixa, devedor sem loan → principal transferido, loan registrado. (SC-001)
- **Rejeições**: devedor já tem loan; taxa fora de 10–50; credor sem caixa; principal < déficit; fora da janela `debt`; pausado. (SC-001/SC-005)
- **Juros no GO**: principal $500 @20% → ao passar pelo GO, −$100 do devedor / +$100 ao credor. (SC-002)
- **Juros sem caixa**: pós-bônus insuficiente → debita até $0 e abre `debt` ao credor. (SC-002)
- **Quitar**: paga só o principal, remove o loan, libera novo. (SC-003)
- **Falência §9.3**: devedor com loan ativo fale → credor do empréstimo herda propriedades (construções→banco) + caixa; loan removido. Sem loan → §9.2 inalterado. (SC-004)
- **Limite 1**: nunca há 2 loans com o mesmo devedor. (SC-005)

## Arquivos tocados

- `src/game/emprestimos/emprestimos.ts` — `activeLoanFor`, `grantLoan`, `payOffLoan`, `chargeLoanInterest`
- `src/game/economy/types.ts` — `interface Loan`
- `src/game/turn/types.ts` — `GameState.loans`
- `src/game/turn/resolution.ts` — porta `afterPassGo`
- `src/game/turn/turnMachine.ts` — `advance` chama `afterPassGo`
- `src/game/falencia/falencia.ts` — ramo §9.3 em `declareBankruptcy`
- `src/game/store.ts` — seed `loans`, porta, comandos
- `src/game/ui/GameHUD.tsx` — pedir/quitar/status
- `tests/game/emprestimos/emprestimos.test.ts`
