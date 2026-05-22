# Data Model — Painel "Minhas Cartas" (029)

**Sem entidade nova no `GameState`.** Lê `player.hand: string[]` (006) e os metadados de carta (`cardById`). Define duas **visões derivadas** (puras) e um store de UI efêmero.

## Visões derivadas (puras, `src/game/ui/cards/handView.ts`)

### `HandCardView` — item da mão

```ts
interface HandCardView {
  id: string                 // id da carta na mão
  effect: string             // efeito (chave dos mapas de rótulo/descrição)
  label: string              // nome legível (cardLabel)
  desc: string               // texto do efeito (CARD_DESC)
  rarityColor: string        // cor da raridade (RARITY_COLOR[card.rarity])
  timing: 'proprio-turno' | 'preso' | 'reacao'
  needsTarget: boolean       // true se cardTargets(...) !== null
  playable: boolean          // pode usar agora?
  reason?: string            // motivo quando !playable (tooltip)
}

function handCardsView(game: GameState, playerId: string): HandCardView[]
```

Regra de `playable`/`reason` (na ordem):
- `timing === 'reacao'` → `false`, "Carta de reação — usada automaticamente quando aplicável".
- `timing === 'proprio-turno'` e `playerId` não é o ativo → `false`, "Só no seu turno".
- `timing === 'preso'` e jogador não está preso → `false`, "Só quando preso".
- `needsTarget` e `cardTargets` vazio → `false`, "Sem alvo válido".
- senão → `true`.

### `CardTargets` — alvos válidos de uma carta

```ts
interface CardTargets {
  positions?: number[]   // propriedades-alvo válidas
  players?: string[]     // jogadores-alvo válidos
}

function cardTargets(game: GameState, playerId: string, cardId: string): CardTargets | null
```

- `aquisicaoHostil` → `{ positions: posições onde reactorFor(game,'aquisicaoHostil',playerId,pos,null) !== null }`
- `despejo` → `{ positions: posições onde reactorFor(game,'despejo',playerId,pos,null) !== null }`
- `boicote` → `{ positions: posições onde reactorFor(game,'boicote',playerId,pos,null) !== null }`
- `auditoriaFiscal` → `{ players: jogadores onde canAudit(game,playerId,id) }`
- `imunidade` → `{ positions: posições onde ownerOf(game,pos) === playerId }`
- qualquer outro efeito (sem alvo) → `null`

> `reactorFor` (017) encapsula os gates do motor (`canAcquire`/`canEvict` + dono/temp-imune do boicote). Reusar evita duplicar regra → zero divergência com o que `playHandCard` aceita.

## Store de UI (efêmero, `HandCardLayer.tsx`)

```ts
useHandCardUI: { cardId: string | null; open(cardId): void; close(): void }
```

- `open(cardId)` quando o jogador clica "Usar" numa carta de alvo. `HandCardLayer` mostra os alvos (`cardTargets`). Escolher → `playHandCard(cardId, target?, targetPlayer?)` + `close()`. Efêmero (não entra no `GameState`; princípio VII intacto).

## Entidades existentes (reusadas)

- **Carta** (006): `cardById(id) → { effect, mode: 'mao', timing, deck, rarity }`.
- **`player.hand: string[]`** (006): ids na mão (limite 3, privada §10.3).
- **Comando `playHandCard(cardId, target?, targetPlayer?)`** (store): aplica ao jogador ativo; intercepta Diplomacia (017).
- **`reactorFor` / `canAudit` / `ownerOf`**: critérios de validade reusados.
