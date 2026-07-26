# Contrato — `openEstateAuction`

A única função nova desta spec. Pura: `(state, ...) → GameState`, sem mutar a entrada.

```ts
// src/game/economy/landAuction.ts
export function openEstateAuction(
  state: GameState,
  positions: number[],   // propriedades do espólio (construções já desfeitas)
  now: number,           // epoch ms — vem de ctx.now (convergência: recorder grava/reproduz)
  bankruptId: string,    // quem faliu; já marcado eliminated no `state` recebido
): GameState
```

## Por que recusar é seguro sem avisar o chamador

> **Revisado na implementação.** A primeira versão deste contrato devolvia `{ state, claimed }`, para o chamador dar às posições recusadas o destino antigo (`ownerId = null`, direto ao banco) e evitar limbo.
>
> O limbo nunca era possível: **um lote em pregão e uma propriedade no banco têm exatamente o mesmo estado de título** — `ownerId: null`. O que os distingue é apenas estar ou não em `landAuction.lots`. Então quando uma guarda recusa, as propriedades já estão onde o comportamento pré-039 as deixava, e não há nada a corrigir. `claimed` era peso morto sem consumidor.
>
> Retorno simplificado para `GameState`. Recusa é **no-op referencial** (`return state`), o que os testes checam com `toBe`.

## Guardas, na ordem

| # | Condição | Resultado | Requisito |
|---|---|---|---|
| 1 | `positions` vazio | no-op referencial | FR-005 |
| 2 | menos de 2 jogadores não-eliminados em `state` | no-op referencial | FR-006 (fim de jogo tem precedência, §9.5) |
| 3 | posições que já são lote no pregão em curso | filtradas de `positions` | FR-019 |
| 4 | após a filtragem, nada sobrou | no-op referencial | FR-005 (mesma guarda, depois do filtro) |

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

1. Recusa devolve `state` por referência (`toBe`), nunca uma cópia igual.
2. Nenhuma posição em dois lotes do pregão resultante — incluindo posição repetida na própria entrada.
3. `bidders` ⊆ não-eliminados; `bankruptId ∉ bidders`.
4. `origin === 'scarcity'` nunca é resultado desta função.

## Contrato do chamador — `declareBankruptcy`

Ordem obrigatória, porque as guardas dependem dela:

1. desfaz construções e coleta as posições do devedor (comportamento atual);
2. **quando não há herdeiro**, guarda as posições numa lista (o laço já zera `ownerId`, que é o estado correto tanto para "no banco" quanto para "em lote");
3. marca o devedor `eliminated`, zera o caixa, limpa empréstimos/imunidades/efeitos (comportamento atual);
4. `checkEndGame` e `advanceSeat` (comportamento atual, inalterado);
5. chama `openEstateAuction` **por último**.

A ordem não é estética. `eliminated` antes é o que faz a guarda 2 contar certo (mesa de 2 → sobra 1 → nenhum pregão). `advanceSeat` antes é o que garante que o pregão não interfere na passagem da vez (FR-014) — é evento autônomo.

Com herdeiro (`heirId !== null`), os passos 2 e 5 não acontecem — `declareBankruptcy` segue idêntico a hoje (FR-002).

## O que este contrato promete NÃO mudar

`placeLandBid`, `committedCash`, `settleLot`, `closeExpiredLandLots`, `closeLandAuction` e `maybeOpenLandAuction` (fora do preenchimento dos dois campos novos na abertura). Um lote de espólio é indistinguível de um lote de escassez para todas elas — se alguma precisar saber a origem, o desenho está errado.
