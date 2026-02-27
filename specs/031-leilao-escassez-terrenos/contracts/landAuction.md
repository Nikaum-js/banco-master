# Contract — `economy/landAuction.ts` (reducers puros)

Módulo puro (sem efeito; clona via `structuredClone`). O **timer** e o **`now`** vivem no store (efeito), igual ao leilão 003. Assinaturas em TypeScript.

```ts
import type { GameState } from '../turn/types'

// Terrenos compráveis sem dono (cidade/aeroporto/utilidade, ownerId == null).
export function freeLots(state: GameState): number[]

// Gatilho. Abre o pregão se: freeLots ≤ THRESHOLD && vivos ≥ 2 && landAuction==null && armed.
// Re-arma (armed=true) se freeLots > THRESHOLD. No-op caso contrário. `now` define o deadline.
// Retorna estado novo (ou o mesmo, se nada muda).
export function maybeOpenLandAuction(state: GameState, now: number): GameState

// Lance num lote. No-op se inválido (ver regras 1–4 abaixo). Reinicia o deadline SÓ daquele lote.
export function placeLandBid(
  state: GameState,
  playerId: string,
  pos: number,
  amount: number,
  now: number,
): GameState

// Fecha os lotes cujo prazo PRÓPRIO expirou (deadline ≤ now): vencedor paga e vira dono; sem lance
// fica livre; remove de lots; lots vazio → landAuction=null. Dirigido pelo timer do store. NÃO toca no turno.
export function closeExpiredLandLots(state: GameState, now: number): GameState

// Force-close: fecha TODOS os lotes restantes de imediato (mesma resolução por lote). NÃO toca no turno.
export function closeLandAuction(state: GameState): GameState

// Janela do cronômetro por lote (ms) = THEME.LAND_AUCTION_SECONDS * 1000.
export const LAND_AUCTION_WINDOW: number

// Caixa comprometido do jogador nos OUTROS lotes (soma dos lances onde já é maior licitante),
// excluindo o lote `exceptPos`. Usado pela trava de solvência e pela UI (caixa disponível).
export function committedCash(state: GameState, playerId: string, exceptPos: number): number
```

## Regras de validação de `placeLandBid` (todas obrigatórias)

1. `state.landAuction != null` **e** existe `lot` com `lot.pos === pos`.
2. `playerId ∈ state.landAuction.bidders`.
3. `amount ≥ minBid` **e** `amount > lot.currentBid`.
4. **Solvência:** `committedCash(state, playerId, pos) + amount ≤ caixa(playerId)`.

Falhou qualquer uma → retorna `state` inalterado (no-op; o cronômetro **não** reinicia).

## Comandos no store (efeito)

```ts
placeLandBid(playerId: string, pos: number, amount: number): void  // injeta now()
closeLandAuction(): void
// Internamente, após buy/closeAuction/finalizeTurn: game = maybeOpenLandAuction(game, now());
// se abriu (ou deadline mudou), (re)agenda setTimeout → closeLandAuction pelo deadline (igual 003).
```

## Contrato de UI — `LandAuctionLayer`

Lê `game.landAuction`. Quando `!= null`, renderiza overlay com:
- **Cada lote:** nome/grupo (via `BOARD[pos]`), `currentBid`, `highBidder` (nome).
- **Tempo restante:** derivado de `deadline - now` (atualiza ~1s).
- **Lance:** input/passos por lote → `placeLandBid(jogadorSelecionado, pos, valor)`; desabilitado se viola regra 3/4 (mostra motivo: "abaixo do mínimo", "≤ lance atual", "caixa insuficiente").
- **Single-client:** seletor "lance por: [jogador vivo]".
- Some quando `landAuction == null` (fechado).

Todo texto em **pt-BR**.

## Reuso / não-reuso

- **Reusa (padrão):** `deadline`+timer do store (003), `AUCTION_WINDOW` (`purchase.ts`), `structuredClone`, `activePlayer`/helpers de `titles`.
- **NÃO reusa:** `resolution.kind:'auction'` (003) — acopla ao turno e é single-lote. **NÃO** reintroduz `bank`/`houseAuction`/`BankStock` (removidos na D-022).
