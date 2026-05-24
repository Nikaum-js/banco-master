# Contract — Falência & Fim de jogo (Fase 1)

Funções puras + comandos + os pontos que abrem a dívida.

---

## 1. `falencia.ts` (puro)

```ts
liquidationValue(state, playerId): number    // cash + construções/2 + hipoteca das livres
isBankrupt(state, playerId, debt): boolean    // liquidationValue < debt

// Paga a dívida pendente (resolution 'debt') se o caixa cobrir. No-op senão.
payDebt(state): GameState                      // credita credor (jogador) ou pote (banco); completeResolution

// Falência: destina ativos (§9.2), elimina, checa fim de jogo, passa a vez.
declareBankruptcy(state, ctx): GameState

checkEndGame(state): GameState                 // 1 não-eliminado → phase='ended'
```

`declareBankruptcy` (sem empréstimo):
- construções do devedor → banco (estoque += casas/hotéis); `houses=0, hotel=false`.
- credor = jogador → cada propriedade do devedor `ownerId = credor`; `credor.cash += devedor.cash`; `devedor.cash = 0`.
- credor = banco → cada propriedade `ownerId = null`; `devedor.cash = 0` (leilão = refinamento).
- `devedor.eliminated = true`; limpa `resolution`; `checkEndGame`; `advanceSeat` (002) para o próximo.

## 2. Abertura da dívida (call-sites)

| Local | Mudança |
|---|---|
| `resolveRentable` (003) | aluguel com `payer.cash < amount` → `state.resolution = { kind:'debt', amount, creditorId: owner }`, `{ done:false }` (em vez de `onInsolvency`) |
| handler `tax` (002/007) | `cash < amount` → `state.resolution = { kind:'debt', amount, creditorId: null }`, sem debitar ainda; `{ done:false }` |

## 3. Comandos (store)

| Comando | Pré-condição | Efeito |
|---|---|---|
| `payDebt()` | `resolution.kind==='debt'` e `cash ≥ amount` | paga (credor/pote), limpa a dívida, libera o turno |
| `declareBankruptcy()` | `resolution.kind==='debt'` | resolve §9.2, elimina, fim de jogo, passa a vez |

> Para liquidar, o jogador usa `sellBuilding` (004) / `mortgageProperty` (005) — já existentes — e então `payDebt`.

## 4. Conformidade

- **Determinismo:** funções puras; `declareBankruptcy` reusa `advanceSeat`.
- **Serialização:** só a variante `debt` e `phase='ended'`.
- **Fronteira:** §9.3 (empréstimo) e imunidades fora/no-op; leilão dos bens da dívida-ao-banco simplificado para retorno ao banco.
- **Integração:** a dívida bloqueia o turno via o gating de resolução já existente (não finaliza com `resolution !== null`).
