# Contrato — `openEstateAuction`

A única função nova desta spec. Pura: `(state, ...) → GameState`, sem mutar a entrada.

```ts
// src/game/economy/landAuction.ts
export function openEstateAuction(
  state: GameState,
  positions: number[],   // propriedades do espólio (construções já desfeitas)
  now: number,           // epoch ms — vem de ctx.now (convergência: recorder grava/reproduz)
  bankruptId: string,    // quem faliu; já marcado eliminated no `state` recebido
): { state: GameState; claimed: number[] }
```

## Por que devolve `claimed`

O chamador (`declareBankruptcy`) precisa saber **quais posições o pregão aceitou**, porque as recusadas têm de cair no comportamento antigo (`ownerId = null`, direto ao banco). Sem isso, uma recusa deixaria propriedades em limbo — nem no pregão, nem no banco, nem com o falido.

`claimed` é subconjunto de `positions`. Quando o pregão recusa abrir por completo, `claimed` é `[]` e `state` volta inalterado.

## Guardas, na ordem

| # | Condição | Resultado | Requisito |
|---|---|---|---|
| 1 | `positions` vazio | no-op, `claimed: []` | FR-005 |
| 2 | menos de 2 jogadores não-eliminados em `state` | no-op, `claimed: []` | FR-006 (fim de jogo tem precedência, §9.5) |
| 3 | posições que já são lote no pregão em curso | filtradas de `positions` | FR-019 |
| 4 | após a filtragem, nada sobrou | no-op, `claimed: []` | FR-005 (mesma guarda, depois do filtro) |

A guarda 2 lê `state` **depois** de o falido ter sido marcado `eliminated` — é o chamador que garante essa ordem, e o contrato depende dela. Um espólio numa partida de 2 jogadores termina com 1 vivo: nenhum pregão, e é isso que se quer.

## Comportamento

**Pregão fechado** (`state.landAuction === null`):

```
landAuction = {
  lots: positions.map(pos => ({ pos, currentBid: 0, highBidder: null, deadline: now + WINDOW })),
  bidders: <não-eliminados>,
  origin: 'bankruptcy',
  bankruptId,
}
```

**Pregão aberto**: acrescenta os lotes novos e

- **preserva** o `deadline` de todo lote preexistente (FR-016) — só os novos recebem `now + WINDOW`;
- **recalcula** `bidders` para os não-eliminados, o que remove o recém-falido inclusive dos lotes que já estavam lá (FR-017);
- promove `origin` a `'mixed'` se era `'scarcity'`; mantém `'bankruptcy'` se já era; mantém `'mixed'` se já era;
- sobrescreve `bankruptId` com o falido atual.

**Em nenhum caso** toca `landAuctionArmed` (FR-018), `turn`, `activeSeat` ou `resolution` (FR-014).

## Invariantes de saída

1. `claimed` ⊆ `positions`, sem repetição.
2. `claimed` não-vazio ⟺ `state.landAuction` mudou.
3. Nenhuma posição em dois lotes do pregão resultante.
4. `bidders` ⊆ não-eliminados; `bankruptId ∉ bidders`.
5. `origin === 'scarcity'` nunca é resultado desta função.

## Contrato do chamador — `declareBankruptcy`

Ordem obrigatória, porque as guardas dependem dela:

1. desfaz construções e coleta as posições do devedor (comportamento atual);
2. **quando não há herdeiro**, guarda as posições em vez de zerar `ownerId` imediatamente;
3. marca o devedor `eliminated`, zera o caixa, limpa empréstimos/imunidades/efeitos (comportamento atual);
4. chama `openEstateAuction`;
5. **zera `ownerId` das posições NÃO reivindicadas** — o caminho de recusa vira exatamente o comportamento de hoje;
6. `checkEndGame` e `advanceSeat` (comportamento atual, inalterado).

O passo 3 antes do 4 é o que faz a guarda 2 contar certo. O passo 5 é o que impede limbo.

Com herdeiro (`heirId !== null`), os passos 2, 4 e 5 não acontecem — `declareBankruptcy` segue idêntico a hoje (FR-002).

## O que este contrato promete NÃO mudar

`placeLandBid`, `committedCash`, `settleLot`, `closeExpiredLandLots`, `closeLandAuction` e `maybeOpenLandAuction` (fora do preenchimento dos dois campos novos na abertura). Um lote de espólio é indistinguível de um lote de escassez para todas elas — se alguma precisar saber a origem, o desenho está errado.
