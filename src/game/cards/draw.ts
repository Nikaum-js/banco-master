// Saque e uso de cartas. cardResolve preenche a porta de resolução de acaso/tesouro (002).
import type { ResolveCtx, ResolutionOutcome, TurnPorts } from '../turn/resolution'
import type { GameState, Player } from '../turn/types'
import type { CardSlot, DeckId } from './types'
import { cardById } from './catalog'
import { applyEffect } from './effects'
import { activePlayer, completeResolution, advance, land, finishIfEnded, BOARD_SIZE, type TurnCtx } from '../turn/turnMachine'
import { BOARD } from '@/lib/boardData'
import { ownerOf } from '../economy/titles'
import { addTempEffect } from '../economy/tempEffects'
import { reactorFor, applyOffensive } from './reacao'
import { removeFromHand } from './hand'
import { logEvent } from '../log'

// Movimento por carta continua sendo parte da resolução da casa alcançada pelos dados.
// Portanto, ele não pode apagar uma nova rolagem já conquistada por dupla. A única
// exceção é um destino que encerra o turno (como "Vá para a Prisão"), que `land` marca
// explicitamente e onde a nova rolagem deve permanecer cancelada.
function landAfterCardMovement(state: GameState, player: Player): void {
  const mayRollAgain = state.turn.mayRollAgain
  land(state.turn, player, null)
  if (state.turn.state !== 'encerrado') state.turn.mayRollAgain = mayRollAgain
}

// Nome legível a partir do id da carta ('investidor-anjo-2' → 'Investidor Anjo').
// Carta imediata é pública (§12.2), então o anúncio pode citar o nome.
function cardNameFromId(id: string): string {
  return id
    .replace(/-\d+$/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Resolver de carta — composto com o economyResolve no ctx.resolve do store.
//
// `predrawn` (043, D8/T029): quando o CHAMADOR já sacou pela porta (`cardRevealResolve`, que
// precisa decidir mao-vs-imediato ANTES de aplicar), passa o valor aqui em vez de deixar
// `cardResolve` sacar de novo — sacar duas vezes corromperia o deck e gravaria dois valores
// no lugar de um. Chamadores que não passam nada (todo o resto, inclusive os testes que
// chamam `cardResolve` direto) continuam sacando por conta própria — comportamento inalterado.
export function cardResolve(rctx: ResolveCtx, predrawn?: CardSlot): ResolutionOutcome | null {
  const { square, state, playerId, ports } = rctx
  if (square.kind !== 'acaso' && square.kind !== 'tesouro') return null
  const deckId: DeckId = square.kind
  const id = predrawn !== undefined ? predrawn : ports.draw(state, deckId)

  // Slot OCULTO (043, D7/D8): só ocorre para carta de MÃO alheia — a imediata nunca chega
  // redigida (D9/D10, é sempre pública). Regra única dos dois lados: comprimento é a verdade
  // pública; não sabemos (nem precisamos saber) qual carta é.
  if (id === null) {
    logEvent(state, { kind: 'card-draw', who: playerId, deck: deckId }) // FR-015: sem carta nem raridade
    const player = state.players.find((p) => p.id === playerId)!
    player.hand.push(null)
    if (player.hand.length > 3) {
      state.resolution = { kind: 'card-discard', deckId, drawnId: null } // 4ª → descarte forçado
      return { done: false }
    }
    return { done: true }
  }

  const card = cardById(id)
  // 021/022.1 — carta de mão: privada, só o deck (§10.3). Carta imediata: efeito
  // público, anuncia o nome (§12.2 "anúncio público").
  const name = cardNameFromId(id)

  // Carta de mão: privada (§10.3) — loga só o deck, sem revelar a carta.
  if (card.mode === 'mao') {
    logEvent(state, { kind: 'card-draw', who: playerId, deck: deckId }) // FR-015: sem carta nem raridade
    const player = state.players.find((p) => p.id === playerId)!
    player.hand.push(id) // sai do deck, entra na mão
    if (player.hand.length > 3) {
      state.resolution = { kind: 'card-discard', deckId, drawnId: id } // 4ª → descarte forçado
      return { done: false }
    }
    return { done: true }
  }

  // imediato (público, §12.2). Atalho ainda vai escolher a direção:
  if (card.effect === 'atalho') {
    logEvent(state, { kind: 'card-immediate', who: playerId, deck: deckId, name, delta: 0 })
    state.resolution = { kind: 'card-shortcut', deckId, cardId: id } // escolha ±3
    return { done: false }
  }
  // Demais imediatas: loga o RESULTADO (o que a carta causou), não o nome do evento.
  const player = state.players.find((p) => p.id === playerId)!
  const cashBefore = player.cash
  applyEffect(card.effect, state, playerId, ports)
  state.decks[deckId].push(id) // volta ao fundo
  logEvent(state, { kind: 'card-immediate', who: playerId, deck: deckId, name, delta: player.cash - cashBefore })
  // Cartas de MOVIMENTO (Avance/Volte 3) resolvem a casa de destino como um pouso
  // normal (comprar/pagar aluguel/etc.). gotojail no destino → 'encerrado' (resolvePending trata).
  if (card.effect === 'avance3' || card.effect === 'volte3') {
    landAfterCardMovement(state, player)
    return { done: false }
  }
  return { done: true }
}

// 025 — Revelação: substitui cardResolve no ctx.resolve. SÓ carta de MÃO abre a tela
// (peek + pausa em `card-reveal`; o confirm saca/processa). Carta IMEDIATA não abre
// modal — processa na hora e só registra no log (cardResolve), por pedido de UX.
//
// 043, D8/T029: o "peek" saca DE VERDADE, pela porta (`ports.draw`) — nunca um `state.decks[..][0]`
// cru. Um peek cru funcionaria na autoridade (deck sempre real ali) mas devolveria `null`
// SEMPRE na perspectiva de um cliente (deck oculto), quebrando a convergência: o cliente
// nunca abriria `card-reveal` para a própria carta, nem para a alheia. Sacando pela porta, o
// valor é gravado/reproduzido como qualquer outro não-determinismo — e um retorno `null` aqui
// só pode significar "carta de mão alheia" (a imediata nunca vem oculta), então dá pra montar
// a resolução sem saber QUAL carta é.
export function cardRevealResolve(rctx: ResolveCtx): ResolutionOutcome | null {
  const { square, state, ports } = rctx
  if (square.kind !== 'acaso' && square.kind !== 'tesouro') return null
  const deckId: DeckId = square.kind
  const cardId = ports.draw(state, deckId)
  if (cardId === null) {
    state.resolution = { kind: 'card-reveal', deckId, cardId: null } // slot oculto — não é minha
    return { done: false }
  }
  if (cardById(cardId).mode === 'imediato') return cardResolve(rctx, cardId) // já sacada — aplica direto, sem tela
  state.resolution = { kind: 'card-reveal', deckId, cardId } // só carta de mão revela
  return { done: false }
}

// 025 — Confirma a revelação: limpa o card-reveal e chama o cardResolve EXISTENTE
// (processa a carta JÁ sacada por `cardRevealResolve` — não saca de novo). Reusa toda a
// regra de carta; sem duplicação.
export function confirmCardReveal(state: GameState, ports: TurnPorts): GameState {
  if (state.resolution?.kind !== 'card-reveal') return state
  const { cardId } = state.resolution
  const s: GameState = structuredClone(state)
  s.resolution = null
  const player = activePlayer(s)
  const rctx: ResolveCtx = { playerId: player.id, square: BOARD[player.pos], roll: s.turn.lastRoll, ports, state: s }
  const outcome = cardResolve(rctx, cardId) // processa a carta JÁ sacada (pode abrir card-discard/card-shortcut)
  if (outcome?.done) {
    s.turn.pendingResolve = false
    s.turn.state = 'aguardando-finalizacao'
  }
  return s
}

// Jogar carta de mão respeitando a janela de timing. Puro; no-op fora da janela.
// `target` (posição) é exigido pelas cartas de mão com alvo: Boicote / Imunidade Temporária (015).
export function playHandCard(
  state: GameState,
  playerId: string,
  cardId: string,
  ports: TurnPorts,
  target?: number,
  targetPlayer?: string,
): GameState {
  const player = state.players.find((p) => p.id === playerId)
  // 043, D7: quem replica o comando (host.ts já validou e aceitou) pode ver a própria mão de
  // `playerId` REDIGIDA — um slot oculto no lugar da carta, se `playerId` não for o dono desta
  // perspectiva (ex.: o cliente do PRÓPRIO host aplicando a jogada de outro assento). `includes`
  // cru quebraria a convergência: rejeitaria localmente uma jogada que o host já aceitou. Um
  // slot oculto (`null`) é aceito no lugar do id real — mesma tolerância de `removeFromHand`.
  if (!player || !(player.hand.includes(cardId) || player.hand.includes(null))) return state
  const card = cardById(cardId)
  if (card.mode !== 'mao') return state
  const isActive = activePlayer(state).id === playerId
  if (card.timing === 'proprio-turno' && !isActive) return state
  if (card.timing === 'preso' && !player.jail.inJail) return state
  if (card.timing === 'reacao') return state // reação deferida (FR-013)

  // Imunidade Temporária (015, §10.6) — proteção de alvo sobre propriedade PRÓPRIA.
  if (card.effect === 'imunidade') {
    if (target == null || ownerOf(state, target) !== playerId) return state
    const s = structuredClone(state)
    addTempEffect(s, { kind: 'imunidade-temp', ownerId: playerId, pos: target, lapsRemaining: 2 })
    return discardPlayed(s, playerId, cardId, card.deck)
  }
  // Ofensivas com alvo (015 Boicote / 016 Aquisição/Despejo/Auditoria). Se o alvo tem Diplomacia,
  // abre uma reação (017) em vez de aplicar; senão aplica direto. No-op se a jogada for inválida.
  if (card.effect === 'boicote' || card.effect === 'aquisicaoHostil' || card.effect === 'despejo' || card.effect === 'auditoriaFiscal') {
    const reactor = reactorFor(state, card.effect, playerId, target ?? null, targetPlayer ?? null)
    if (!reactor) return state // jogada inválida → no-op
    // 043: `ports.hasReaction` (gravado/reproduzido, D11) — quem ataca não vê a mão de quem
    // defende, e esta decisão vira `state.resolution` PÚBLICA e estrutural (mesmo motivo de
    // `taxBunkerResolve`).
    if (ports.hasReaction(state, reactor, 'diplomacia') !== null) {
      const s = structuredClone(state)
      const me = s.players.find((p) => p.id === playerId)!
      me.hand = removeFromHand(me.hand, cardId) // ofensiva "em voo" (sai da mão do atacante)
      s.resolution = {
        kind: 'reaction-diplomacia',
        reactorId: reactor,
        attackerId: playerId,
        effect: card.effect,
        cardId,
        deck: card.deck,
        targetPos: target ?? null,
        targetPlayer: targetPlayer ?? null,
      }
      return s
    }
    const s = structuredClone(state)
    applyOffensive(s, card.effect, playerId, target ?? null, targetPlayer ?? null, ports)
    return discardPlayed(s, playerId, cardId, card.deck)
  }

  const s = structuredClone(state)
  applyEffect(card.effect, s, playerId, ports)
  return discardPlayed(s, playerId, cardId, card.deck)
}

// Remove a carta jogada da mão e recicla ao fundo do deck.
function discardPlayed(s: GameState, playerId: string, cardId: string, deck: DeckId): GameState {
  const p = s.players.find((x) => x.id === playerId)!
  p.hand = removeFromHand(p.hand, cardId)
  s.decks[deck].push(cardId)
  return s
}

// Conclui o descarte forçado (mão cheia): a carta escolhida vai ao fundo.
//
// 043, T029/D10: `cardId` chega como `CardSlot` — `null` na perspectiva de quem NÃO é o dono
// do assento que descarta (a ação difundida em `:play` vem redigida). `removeFromHand`
// resolve os dois casos com a MESMA regra (T030): remove o id se visível, um slot oculto
// caso contrário — o comprimento da MÃO nunca diverge entre perspectivas.
//
// `deck` chega SEPARADO (nunca redigido — já é público desde o saque, `card-draw` loga
// `{who, deck}`): sem ele, quem só vê `cardId: null` não saberia em qual dos dois baralhos
// devolver o slot oculto, e o comprimento DAQUELE baralho divergiria entre perspectivas.
export function resolveCardDiscard(state: GameState, cardId: CardSlot, deck: DeckId): GameState {
  if (state.resolution?.kind !== 'card-discard') return state
  const s = structuredClone(state)
  const player = activePlayer(s)
  player.hand = removeFromHand(player.hand, cardId)
  s.decks[deck].push(cardId) // `cardId` real ou `null` — o slot oculto preserva o comprimento igual a qualquer outro
  completeResolution(s)
  return s
}

// Conclui o Atalho: move ±3 e RESOLVE a casa de destino (compra/aluguel/etc.), como
// um pouso normal. Recicla a carta. (gotojail no destino → prisão, via land.)
export function resolveCardShortcut(state: GameState, dir: 'frente' | 'tras', ctx: TurnCtx): GameState {
  if (state.resolution?.kind !== 'card-shortcut') return state
  const { deckId, cardId } = state.resolution
  const s = structuredClone(state)
  const player = activePlayer(s)
  if (dir === 'frente') advance(s, player, 3, ctx.ports) // credita GO ao cruzar
  else player.pos = (player.pos - 3 + BOARD_SIZE) % BOARD_SIZE // ré: sem bônus de GO (§10.6)
  s.decks[deckId].push(cardId)
  s.resolution = null // limpa o card-shortcut
  landAfterCardMovement(s, player) // resolve o destino sem apagar a dupla que trouxe até a carta
  return finishIfEnded(s, ctx)
}
