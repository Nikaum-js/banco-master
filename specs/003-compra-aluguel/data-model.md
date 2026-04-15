# Data Model — Compra & Aluguel (Fase 1)

Estende o estado de runtime do 002. Tudo **serializável**. O board (001) é só lido (preço, grupo, kind).

---

## Extensão de `Player` (002)

| Campo | Tipo | Notas |
|---|---|---|
| `cash` | number | **NOVO** — saldo; semente **$2.000** (SRS §3.1) |

Demais campos do 002 (`pos`, `jail`, `completouPrimeiraVolta`, `eliminated`) inalterados.

## Entidade: Title (título de propriedade)

`GameState.titles: Record<number, Title>` — chave = `pos` (0–47) das casas compráveis.

| Campo | Tipo | Dono | Notas |
|---|---|---|---|
| `ownerId` | `string \| null` | **Compra & Aluguel** | `null` = banco (livre) |
| `mortgaged` | boolean | Hipoteca (lido aqui) | `true` isenta aluguel (FR-010) |

> Casas não-compráveis (cantos, acaso, tesouro, tax, bus-ticket) **não** têm título.

## Extensão de `GameState` (002)

| Campo | Tipo | Notas |
|---|---|---|
| `titles` | `Record<number, Title>` | **NOVO** — posse; semente: todas `{ ownerId: null, mortgaged: false }` |
| `resolution` | `ResolutionSlice \| null` | **NOVO** — interação transitória de resolução de propriedade |

## Entidade: ResolutionSlice (transitória)

Existe só enquanto uma casa de propriedade está sendo resolvida de forma interativa.

```
type ResolutionSlice =
  | { kind: 'purchase'; pos: number }                 // modal compra/recusa
  | { kind: 'auction'; auction: Auction }             // leilão em curso
```

### Entidade: Auction

| Campo | Tipo | Notas |
|---|---|---|
| `pos` | number | propriedade em disputa |
| `currentBid` | number | lance atual (0 = ainda sem lance) |
| `highBidder` | `string \| null` | maior licitante |
| `activeBidders` | `string[]` | quem ainda pode licitar |
| `deadline` | number | epoch ms — quando fecha se não houver lance (serializável; timer reconstruível) |

---

## Cálculo de aluguel (derivado, puro)

| Tipo | Fórmula | Fonte |
|---|---|---|
| Cidade | `base × (1 / 1.5 / 2)` p/ posse não-maioria / maioria (2-de-3, 3-de-4) / grupo completo | §5.1 + clarif. |
| Aeroporto | `[25, 50, 100, 200][n-1]` p/ n aeroportos do dono | §2.4 |
| Utilidade | `[4, 10, 20][n-1] × valorDosDados` p/ n utilidades do dono | §2.5 + 002 FR-027 |

`base` = `PropertySquare.rent` (001). Multiplicadores **de construção** são deferidos à spec Construção (ponto de extensão em `rent.ts`).

---

## Invariantes validáveis (viram testes)

1. Comprar debita exatamente `price` e seta `titles[pos].ownerId = comprador`.
2. `cash` nunca fica negativo por compra/lance (bloqueado antes); aluguel insuficiente → `onInsolvency` (sem saldo negativo).
3. Aluguel cidade: não-maioria → base; maioria (2/3, 3/4) → ×1.5; completo → ×2.
4. Aeroporto/utilidade: escala por contagem de posse do dono.
5. `mortgaged` ou dono === pagador → aluguel 0.
6. Leilão: `currentBid` estritamente crescente; lance ≤ caixa do licitante; vencedor paga o lance.
7. `closeAuction` sem `highBidder` → `titles[pos].ownerId` permanece `null` (banco).
8. Enquanto `resolution !== null`, `turn.pendingResolve === true` (turno não finaliza — integra 002 FR-022).
9. `Auction.deadline` é número (serializável); o round-trip JSON do `GameState` preserva tudo.
