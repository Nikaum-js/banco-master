# Contract — Hipoteca (Fase 1)

Funções puras e comandos. Sem novo estado — escreve `Title.mortgaged` (003).

---

## 1. Funções puras (`mortgage.ts`)

```ts
// Valor da hipoteca e derivados (regra; clarificação 2026-05-23).
mortgageValue(square): number      // round(price / 2)
unmortgageCost(square): number     // round(mortgageValue × 1.10)
transferKeepFee(square): number    // round(mortgageValue × 0.10)

// Há construção em alguma propriedade do grupo possuída pelo jogador? (bloqueio §6.1)
groupHasConstruction(state, group, ownerId): boolean

// Hipoteca a propriedade do jogador ativo. No-op se inválido.
mortgageProperty(state, pos): GameState

// Deshipoteca. No-op se inválido (sem caixa / não-hipotecada / não é dono).
unmortgageProperty(state, pos): GameState
```

**Guardas de `mortgageProperty`** (FR-001/002):
- `title.ownerId === ativo` · `!title.mortgaged` · **sem construção no grupo** (`groupHasConstruction === false`).
- Efeito: `cash += mortgageValue`; `title.mortgaged = true`.

**Guardas de `unmortgageProperty`** (FR-004/005):
- `title.ownerId === ativo` · `title.mortgaged` · `cash ≥ unmortgageCost`.
- Efeito: `cash -= unmortgageCost`; `title.mortgaged = false`.

## 2. Comandos (store)

| Comando | Pré-condição | Efeito |
|---|---|---|
| `mortgageProperty(pos)` | turno do ativo | aplica `mortgageProperty` (no-op se inválido); respeita `paused` |
| `unmortgageProperty(pos)` | turno do ativo | aplica `unmortgageProperty`; respeita `paused` |

## 3. Regra de transferência (helpers; gatilho deferido)

`unmortgageCost` e `transferKeepFee` ficam disponíveis para as specs que **disparam** a transferência (Negociação/Falência): ao mudar o dono de uma hipotecada, o novo dono ou paga `transferKeepFee` (mantém) ou `unmortgageCost` (deshipoteca). Esta spec **não** implementa o fluxo de transferência.

## 4. Conformidade

- **Determinismo:** funções puras; sem timers, sem RNG.
- **Serialização:** nenhum campo novo; estado intacto.
- **Não-reabertura:** 002 (FSM), 003 (aluguel) e 004 (construção) **não** são alterados — esta feature só **escreve** a flag que eles já leem.
- **Fronteira:** trade (Negociação) e redistribuição por falência (Falência) ficam fora.
