# Data Model — Leilão de escassez de terrenos (031)

Estado novo, 100% serializável (JSON puro — Princípio VII). Sem refs/handles. Tudo em `src/game/economy/types.ts` (entidades) + `src/game/turn/types.ts` (campos no `GameState`).

## Entidades

### `LandLot` (lote em disputa)

```ts
export interface LandLot {
  pos: number              // posição do terreno no tabuleiro (cidade/aeroporto/utilidade)
  currentBid: number       // 0 = ainda sem lance
  highBidder: string | null // id do maior licitante deste lote; null = sem lance
  deadline: number         // epoch ms — prazo PRÓPRIO; reinicia só com lance NELE; fecha sozinho
}
```

### `LandAuction` (evento autônomo do pregão)

```ts
export interface LandAuction {
  lots: LandLot[]          // 1..3 lotes; cada um é um leilão inglês próprio, com seu próprio prazo
  bidders: string[]        // ids dos jogadores não-eliminados participantes (snapshot na abertura)
}
```

### Campos novos em `GameState`

```ts
landAuction: LandAuction | null   // pregão de escassez ativo (031); null = nenhum. Evento autônomo, fora do turno.
landAuctionArmed: boolean         // trava de episódio: true = pode disparar; false = já disparou nesta "descida"
```

> `landAuctionArmed` inicia `true` no seed. Não confundir com o removido `houseAuction` (D-022) — aquele era leilão de CASAS e foi apagado.

## Invariantes

- **No máximo 1 pregão por vez:** `landAuction != null` bloqueia novo `open`.
- **Lotes = terrenos livres no instante da abertura:** `pos` de `kind ∈ {property,airport,utility}` com `ownerId == null`; tamanho 1..3 (gatilho ≤3).
- **Lance monotônico por lote:** `currentBid` só sobe; cada novo lance `> currentBid` daquele lote e `≥ minBid`.
- **Solvência:** para todo `playerId`, em qualquer instante, `Σ_{lots onde highBidder==playerId} currentBid ≤ caixa(playerId)`. Garantido pela validação do lance (R4).
- **Participantes fixos:** `bidders` é snapshot dos vivos na abertura (eliminação durante o pregão é fora de escopo single-client; revisitar no M3).
- **Serializável:** nenhuma função/handle em `landAuction`; o timer vive no store, reconstruível pelo `deadline`.

## Transições de estado

```text
                 maybeOpenLandAuction(now)          placeLandBid (válido)
   (sem pregão) ───────────────────────────▶ ABERTO ───────────────────▶ ABERTO
   landAuction=null                          lots[i].deadline=now+WINDOW  (SÓ o lote do lance:
   landAuctionArmed=true                      (cada lote o seu)           currentBid/highBidder/
        ▲                                     landAuctionArmed=false       deadline=now+WINDOW)
        │                                          │                                │ deadline de UM lote expira
        │   freeLots > THRESHOLD                    │ closeExpiredLandLots           ▼
        └──── re-arma (armed=true) ◀────────────────┴──────────────────────────── lote FECHA (sozinho)
              (ex.: falência devolve                lote c/ highBidder → dono paga banco; sem lance → livre.
               terreno ao banco)                    Removido de lots; quando lots=∅ → landAuction=null
```

### Gatilho `maybeOpenLandAuction(state, now)`

Abre sse **todas**: `freeLots(state).length ≤ THRESHOLD (=3)` · `aliveCount(state) ≥ 2` · `state.landAuction == null` · `state.landAuctionArmed == true`.
Efeito de re-arme: se `freeLots > THRESHOLD` e `!armed`, seta `armed=true` (e não abre).

### `placeLandBid(state, playerId, pos, amount, now)` — validação (no-op se falhar)

1. `state.landAuction != null` e existe lote em `pos`.
2. `playerId ∈ bidders`.
3. `amount ≥ minBid` (tema) e `amount > lot.currentBid`.
4. `committedOutros(playerId) + amount ≤ caixa(playerId)` (trava de solvência).
→ Atualiza `lot.currentBid`, `lot.highBidder` e **só** `lot.deadline = now + WINDOW` (os outros lotes não mudam).

### `closeExpiredLandLots(state, now)` (dirigido pelo timer)

Para cada lote com `deadline ≤ now`: havendo `highBidder`, `caixa -= currentBid` e `titles[pos].ownerId = highBidder`; sem lance, fica livre. Remove os expirados de `lots`; se `lots` ficar vazio, `landAuction = null`. (Não toca no turno.)

### `closeLandAuction(state)` (force-close)

Fecha **todos** os lotes restantes de imediato (mesma resolução por lote) e `landAuction = null`. Usado p/ encerramento forçado; o fluxo normal é por `closeExpiredLandLots`.

## Knobs de tema (tunáveis)

| Knob | Origem | Default |
|---|---|---|
| Limiar de disparo | `THEME.LAND_AUCTION_THRESHOLD` | `3` terrenos livres |
| Janela do cronômetro **por lote** | `THEME.LAND_AUCTION_SECONDS` | `8` s |
| Lance mínimo | regra §7.2 / tema | `$1` (ou mínimo do tema) |
