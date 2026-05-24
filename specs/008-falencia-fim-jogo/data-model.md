# Data Model — Falência & Fim de jogo (Fase 1)

Estende o estado com uma variante de resolução. Serializável.

---

## Extensão de `ResolutionSlice`

```
| { kind: 'debt'; amount: number; creditorId: string | null }  // NOVO — pendência de dívida
```

`creditorId = null` → dívida com o **banco** (imposto); string → dívida com **outro jogador** (aluguel).

## Estado tocado (existente)

| Campo | Origem | Uso aqui |
|---|---|---|
| `Player.eliminated` | 002 | **escrito** na falência; o turno já pula eliminados |
| `Player.cash`, `titles`, `houses/hotel/mortgaged` | 003/004/005 | lidos/zerados na liquidação/transferência |
| `GameState.phase` | 002 | `'playing' → 'ended'` no fim de jogo |
| `GameState.bank` | 004 | construções do falido retornam ao estoque |
| `GameState.centerPot` | 007 | imposto pago via `payDebt` (dívida ao banco) alimenta o pote |

## Derivados (puros)

| Derivado | Fórmula |
|---|---|
| `liquidationValue(state, id)` | `cash + Σ(construções × buildCost/2) + Σ(preço/2 das propriedades não-hipotecadas)` |
| `isBankrupt(state, id, debt)` | `liquidationValue(state, id) < debt` |
| Vencedor | único `!eliminated` quando `checkEndGame` dispara |

---

## Invariantes validáveis (viram testes)

1. Aluguel/imposto sem caixa → abre `resolution.kind === 'debt'` (turno bloqueado).
2. `payDebt` só conclui se `cash ≥ amount`; transfere ao credor (jogador) ou ao pote (banco) e libera o turno.
3. `declareBankruptcy` devendo a **jogador**: propriedades (sem construção) e caixa restante → credor; devedor `eliminated`.
4. `declareBankruptcy` devendo ao **banco**: propriedades → banco (`ownerId=null`), construções → estoque; devedor `eliminated`.
5. Construções do falido sempre retornam ao banco (estoque +).
6. `isBankrupt` true só quando `liquidationValue < debt`; quem cobre liquidando não é falido.
7. `checkEndGame`: 1 não-eliminado → `phase='ended'` (vencedor); ≥2 → `'playing'`.
8. Round-trip JSON com a variante `debt` e `phase='ended'`.
