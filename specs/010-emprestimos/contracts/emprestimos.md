# Contract: Empréstimos entre jogadores

Funções puras (`emprestimos.ts`), porta e comandos de store. Assinaturas e comportamento observável.

## `emprestimos/emprestimos.ts`

### `activeLoanFor(state: GameState, debtorId: string): Loan | undefined`

Retorna o empréstimo ativo em que `debtorId` é o **devedor**, ou `undefined`.

### `grantLoan(state, debtorId, creditorId, principal, ratePct): GameState`

Concede um empréstimo (representa a proposta já **aceita** pelo credor com taxa).

**Pré-condições (todas, senão retorna `state` inalterado):**

- `state.paused === false`
- `state.resolution?.kind === 'debt'` e `debtorId === activePlayer(state).id`
- `activeLoanFor(state, debtorId) === undefined` (§15.3)
- `Number.isInteger(ratePct)` e `10 ≤ ratePct ≤ 50`
- `creditorId !== debtorId` e o credor existe e não eliminado
- `principal ≥ (state.resolution.amount − debtor.cash)` (cobre o déficit) e `principal ≤ creditor.cash`

**Efeitos (clone):** `creditor.cash -= principal`; `debtor.cash += principal`; `loans.push({ debtorId, creditorId, principal, ratePct })`. **Não** quita a dívida (o devedor chama `payDebt` em seguida).

### `payOffLoan(state, debtorId): GameState`

**Pré:** `!paused`; existe `loan = activeLoanFor(debtorId)`; `debtor.cash ≥ loan.principal`.
**Efeitos:** `debtor.cash -= principal`; `creditor.cash += principal`; remove o loan. (Quitação = **só principal**, R1.)

### `chargeLoanInterest(state: GameState, debtorId: string): void`

Muta `state` (chamada pela porta `afterPassGo`, dentro de `advance`). Para o `loan` onde `debtorId` é devedor:

- `interest = Math.round(loan.principal * loan.ratePct / 100)`
- `debtor.cash ≥ interest` → `debtor.cash -= interest`; `creditor.cash += interest`
- senão → `creditor.cash += debtor.cash`; `resto = interest - debtor.cash`; `debtor.cash = 0`; `state.resolution = { kind:'debt', amount: resto, creditorId }`

No-op se não houver loan para `debtorId`.

## `economy/types.ts`

```ts
export interface Loan { debtorId: string; creditorId: string; principal: number; ratePct: number }
```

## `turn/types.ts`

`GameState += loans: Loan[]`.

## `turn/resolution.ts` (TurnPorts)

```ts
afterPassGo?(state: GameState, playerId: string): void
```

## `turn/turnMachine.ts` (advance)

Após `player.cash += ports.onPassGo(state, player.id)` e `player.completouPrimeiraVolta = true`:

```ts
ports.afterPassGo?.(state, player.id)
```

## `falencia/falencia.ts` (declareBankruptcy — estendido)

Antes de destinar ativos: `const loan = activeLoanFor(s, debtor.id)`. Se `loan`, destino = `loan.creditorId` (ramo §9.3, hipotecas preservadas, caixa ao credor, `loans` sem esse empréstimo). Senão, §9.2 atual. Em ambos: remover `loans` onde o devedor era **credor** (R8) antes de `checkEndGame`/`advanceSeat`.

## `store.ts`

- Seed: `loans: []`.
- Porta: `afterPassGo: (state, id) => chargeLoanInterest(state, id)` em `defaultPorts`.
- Comandos: `grantLoan(creditorId, principal, ratePct)` (devedor = ativo) e `payOffLoan()` (devedor = ativo).

```ts
grantLoan: (creditorId, principal, ratePct) =>
  set((st) => ({ game: grantLoan(st.game, activePlayer(st.game).id, creditorId, principal, ratePct) })),
payOffLoan: () => set((st) => ({ game: payOffLoan(st.game, activePlayer(st.game).id) })),
```

## `ui/GameHUD.tsx`

- Na resolução `debt`: além de Pagar/Falir, **Pedir empréstimo** → escolhe credor (outros jogadores não-eliminados), valor e taxa (demo local: principal = déficit; taxa default 20% — ajustáveis), chama `grantLoan`.
- Quando o jogador ativo é devedor de um loan e `cash ≥ principal`: botão **Quitar empréstimo** → `payOffLoan`.
- Linha de status: empréstimos ativos `devedor→credor $principal @taxa%` (visível a todos, §12.3).
