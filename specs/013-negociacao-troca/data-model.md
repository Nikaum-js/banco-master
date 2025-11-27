# Data Model: Negociação — troca

**Sem mudança no `GameState`.** A troca muta `Title.ownerId` e `Player.cash` (existentes). `Trade` é um parâmetro transitório.

## Entidades

### Trade (param transitório — `economy/trade.ts`)

```ts
interface Trade {
  fromId: string
  toId: string
  fromProps: number[]  // posições que `from` oferece
  fromCash: number     // ≥ 0
  toProps: number[]    // posições que `to` oferece
  toCash: number       // ≥ 0
}
```

Não persiste no estado (a UX propor/aceitar/recusar é da UI/multiplayer).

### Mutações (executeTrade)

| Alvo | Mudança |
|---|---|
| `titles[p].ownerId` (p ∈ fromProps) | → `toId` |
| `titles[p].ownerId` (p ∈ toProps) | → `fromId` |
| `players[fromId].cash` | `− fromCash + toCash − feesFrom` |
| `players[toId].cash` | `− toCash + fromCash − feesTo` |
| `mortgaged` / `hangar` | acompanham a propriedade (não mudam) |

`feesFrom` = Σ `transferKeepFee` das hipotecadas em `toProps`; `feesTo` = idem em `fromProps`. Taxas → banco (removidas).

## Validação (atômica — rejeita sem efeito)

- `!state.paused`
- `fromId !== toId`; ambos existem e não eliminados
- `fromCash ≥ 0`, `toCash ≥ 0`
- cada `fromProps` pertence a `fromId`; cada `toProps` a `toId`
- nenhuma cidade com `cityLevel > 0` (construção) nos props
- `from.cash ≥ fromCash` e `to.cash ≥ toCash`
- `finalFrom ≥ 0` e `finalTo ≥ 0` (após taxas)

## Invariantes

- Atômica: ou aplica tudo ou nada.
- Posse e caixa conservam-se (exceto taxas de transferência removidas ao banco).
- Construções de cidade nunca trocam de mão por negociação.
- Cartas/Bus Tickets/empréstimos nunca trocam de mão (não estão no `Trade`).
- Nenhum jogador fica com caixa negativo.
- Estado JSON puro/serializável (princípio VII).
