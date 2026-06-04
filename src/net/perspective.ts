// Divisão/mescla de perspectiva (spec 043, D6/D7 — data-model §§6-7). A AUTORIDADE (host)
// nunca tem `null` no próprio `GameState` (D7): mão e decks são sempre reais ali. O que este
// módulo faz é separar essa verdade em uma parte PÚBLICA (redigida, do tamanho certo, com
// `null` no lugar de carta alheia) e uma parte SECRETA (as cartas reais, por dono), e depois
// remontar a visão de UM viewer específico a partir das duas — sem o servidor conhecer o
// esquema do jogo (`read_snapshot` só seleciona chave, D6).
import type { GameState } from '@/game/turn/types'
import type { CardId, DeckId } from '@/game/cards/types'
import type { Room } from './room'
import type { AcceptedCommand } from './transport'
import { cardById } from '@/game/cards/catalog'

// `rooms.secrets` (data-model §7) — mãos reais por UID de assento (não por playerId: o
// servidor seleciona por `auth.uid()`, que É o uid) e os decks reais, íntegros.
export interface Secrets {
  hands: Record<string, CardId[]> // uid → mão real, na MESMA ordem/posição da mão pública
  decks: Partial<Record<DeckId, CardId[]>> // deck real, íntegro (só a autoridade recebe tudo)
}

export const EMPTY_SECRETS: Secrets = { hands: {}, decks: {} }

// Separa o `GameState` real (só existe na autoridade) em público + segredo. Público preserva
// TODO comprimento (§12.3, D7) — só o CONTEÚDO da mão/deck vira `null`.
export function splitSnapshot(game: GameState, room: Room): { publicGame: GameState; secrets: Secrets } {
  const publicGame: GameState = structuredClone(game)
  const secrets: Secrets = { hands: {}, decks: {} }

  for (const seat of room.seats) {
    const player = publicGame.players.find((p) => p.id === seat.playerId)
    if (!player) continue
    secrets.hands[seat.uid] = player.hand.filter((c): c is CardId => c !== null)
    player.hand = player.hand.map(() => null)
  }

  for (const deckId of Object.keys(game.decks) as DeckId[]) {
    secrets.decks[deckId] = game.decks[deckId].filter((c): c is CardId => c !== null)
    publicGame.decks[deckId] = game.decks[deckId].map(() => null)
  }

  return { publicGame, secrets }
}

// Remonta a visão de UM viewer: preenche os slots ocultos da própria mão (e, para a
// autoridade, do deck) com o que `secrets` trouxer. `secrets` parcial é o caso comum — um
// jogador só recebe a própria entrada de `hands` (seleção de chave no servidor, D6); a
// autoridade recebe tudo. Propriedade coberta pela suíte (T033): `mergeSnapshot(...
// splitSnapshot(g, room), room)` com os segredos INTEIROS devolve `g` inalterado.
export function mergeSnapshot(publicGame: GameState, secrets: Partial<Secrets>, room: Room): GameState {
  const game: GameState = structuredClone(publicGame)
  const hands = secrets.hands ?? {}

  for (const seat of room.seats) {
    const realHand = hands[seat.uid]
    if (!realHand) continue
    const player = game.players.find((p) => p.id === seat.playerId)
    if (!player) continue
    player.hand = realHand.slice()
  }

  const decks = secrets.decks ?? {}
  for (const deckId of Object.keys(decks) as DeckId[]) {
    const realDeck = decks[deckId]
    if (!realDeck) continue
    game.decks[deckId] = realDeck.slice()
  }

  return game
}

// Redige o comando ACEITO para a difusão pública (data-model §6, D9/D10): carta que foi para
// a MÃO vira `null` em `resolved.draws`; `discard-card` vira `null` em `action.cardId`. Carta
// IMEDIATA nunca é redigida (é pública por natureza, §12.2) — nem `play-hand-card` (jogar é
// revelar). Devolve o MESMO objeto (`===`) quando não há nada a redigir, para o chamador
// decidir barato se precisa de uma cópia privada.
export function redactAccepted(cmd: AcceptedCommand): AcceptedCommand {
  let action = cmd.action
  let draws = cmd.resolved.draws

  if (action.kind === 'discard-card' && action.cardId !== null) {
    action = { ...action, cardId: null }
  }
  if (draws.some((id) => id !== null && cardById(id).mode === 'mao')) {
    draws = draws.map((id) => (id !== null && cardById(id).mode === 'mao' ? null : id))
  }

  if (action === cmd.action && draws === cmd.resolved.draws) return cmd
  return { ...cmd, action, resolved: { ...cmd.resolved, draws } }
}
