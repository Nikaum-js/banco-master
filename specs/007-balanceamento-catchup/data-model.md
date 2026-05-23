# Data Model — Balanceamento: GO Progressivo & Free Parking (Fase 1)

Estende o estado do 006 com um único campo. Serializável.

---

## Extensão de `GameState`

| Campo | Tipo | Notas |
|---|---|---|
| `centerPot` | number | **NOVO** — pote do Free Parking; semente **500**; reabastece **500** ao ser coletado |

## Derivados (puros, sem estado novo)

| Derivado | Fórmula | Origem |
|---|---|---|
| Ranking de patrimônio | jogadores ativos ordenados por `netWorth` desc; desempate por `turnOrder` | §13.5 + 006 |
| Bônus do GO | `round(100 + posição/(N−1) × 300)` (0 = mais rico → $100; N−1 → $400); N=1 → 100 | §13.5 (tunável) |

## Portas (assinatura nova — recebem `state`)

| Porta | Antes | Agora | Efeito |
|---|---|---|---|
| `onPassGo` | `(playerId) → number` | `(state, playerId) → number` | retorna `goBonus`; `advance` credita |
| `onPayToCenter` | `(amount) → void` | `(state, amount) → void` | `state.centerPot += amount` |
| `onCollectCenter` | `(playerId) → number` | `(state, playerId) → void` | credita o pote ao jogador e reseta para 500 |

---

## Invariantes validáveis (viram testes)

1. `goBonus`: último (mais pobre) = **400**; primeiro (mais rico) = **100**; meio entre os dois; usa `netWorth`.
2. `advance` ao cruzar/parar no GO credita `goBonus` **uma vez**.
3. Pagar imposto: `payer.cash -= amount` **e** `centerPot += amount`.
4. Pagar multa de prisão ($50): `cash -= 50` **e** `centerPot += 50`.
5. Multas de carta ao centro (Honorários/Crise/Conserto) somam ao `centerPot`.
6. Parar em Férias (índice 24): `cash += centerPot` e `centerPot = 500`.
7. `centerPot` nunca fica negativo; round-trip JSON preserva.
