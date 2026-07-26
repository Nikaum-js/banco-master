# Data Model — Leilão do espólio do falido-ao-banco (039)

O delta em `GameState`. Tudo serializável (princípio VII / D-020: o snapshot é `JSON`).

## Alterado — `LandAuction`

`src/game/economy/types.ts`

```ts
// Origem dos lotes de um pregão (039 / D-031). O mecanismo é um só (pregão simultâneo);
// o que distingue escassez de espólio é de onde os lotes vieram.
export type AuctionOrigin = 'scarcity' | 'bankruptcy' | 'mixed'

export interface LandAuction {
  lots: LandLot[]        // inalterado — cada lote fecha no seu próprio prazo
  bidders: string[]      // inalterado na forma; RECALCULADO quando lotes de espólio entram
  origin: AuctionOrigin  // NOVO
  bankruptId: string | null // NOVO — quem faliu; null quando origin === 'scarcity'
}
```

**`origin`**
- `'scarcity'` — aberto por `maybeOpenLandAuction` (§7.3, limiar de terrenos livres).
- `'bankruptcy'` — aberto por `openEstateAuction` (§9.2).
- `'mixed'` — pregão que recebeu lotes de origem diferente da sua depois de aberto.

Serve à apresentação (FR-020). Nenhuma regra de lance ou de fecho lê este campo — é o que mantém `placeLandBid`/`settleLot` intactos.

**`bankruptId`**
- `null` em pregão de escassez puro.
- O **id** do falido em `'bankruptcy'`. Em `'mixed'`, o id do falido cujo espólio entrou; se um segundo espólio entrar no mesmo pregão, **sobrescreve** — o título passa a nomear o mais recente. Aceito: nomear dois falidos num cabeçalho é ruído, e o log de eventos guarda a sequência.
- **Id, não nome.** Nome de jogador vive na sala, fora do `GameState` (D-019); a UI resolve via `identityOf` (038).

## Inalterado — `LandLot`

```ts
export interface LandLot {
  pos: number
  currentBid: number
  highBidder: string | null
  deadline: number
}
```

**Deliberadamente sem `origin` por lote.** É a estrutura que as três funções mais quentes da mecânica manipulam (`placeLandBid`, `settleLot`, `closeExpiredLandLots`), e nenhuma delas usaria o campo. Ver R5 do [research](./research.md).

## Inalterado — `landAuctionArmed`

`boolean` no `GameState`. É a trava de episódio **da escassez** e o espólio **não a toca** (FR-018). Um pregão de falência não pode desarmar um pregão de escassez que ainda não aconteceu.

## Sem entidade nova

O **espólio** não é entidade persistida: é o conjunto de posições que `declareBankruptcy` coleta e entrega a `openEstateAuction` no mesmo comando. Nasce e se dissolve em lotes dentro de uma transição. Se ele existisse no `GameState`, seria estado que só é verdade por um instante — e todo estado assim é um lugar onde a partida pode ser salva no meio.

## Invariantes

1. `origin === 'scarcity'` ⟹ `bankruptId === null`.
2. `landAuction !== null` ⟹ `lots.length ≥ 1`. A guarda "nunca pregão vazio" da 031 vale igual para o espólio (FR-005): `closeExpiredLandLots` zera `landAuction` quando o último lote sai.
3. Nenhuma posição aparece em dois lotes do mesmo pregão (FR-019).
4. `bidders` ⊆ jogadores não-eliminados. Passa a ser **mantido** ao longo do pregão quando um espólio entra, não só na abertura (FR-017).
5. Propriedade que virou lote de espólio **não** tem `ownerId` do falido nem de ninguém: fica sem dono enquanto o lote está aberto, e `settleLot` decide o destino. É o mesmo estado de um lote de escassez — que também é propriedade sem dono em disputa.

> A invariante 5 é a que faz o reuso funcionar: para o pregão, "lote de espólio" e "lote de escassez" são indistinguíveis. A origem só existe para contar ao jogador o que aconteceu.

## Migração

Nenhuma. `GameState` não tem versionamento e as salas são efêmeras (snapshot por partida em andamento). Um snapshot gravado antes desta spec seria lido com `origin` ausente — mas só existiria se houvesse um pregão aberto no momento exato do deploy, e nesse caso a UI cairia no título padrão. Não vale campo opcional nem default por um pregão de 8 segundos.
