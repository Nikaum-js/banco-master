// Saque e uso de cartas. cardResolve preenche a porta de resolução de acaso/tesouro (002).
import type { ResolveCtx, ResolutionOutcome, TurnPorts } from '../turn/resolution'
import type { GameState } from '../turn/types'
import type { DeckId } from './types'
import { cardById } from './catalog'
import { applyEffect } from './effects'
import { activePlayer, completeResolution, advance, land, finishIfEnded, BOARD_SIZE, type TurnCtx } from '../turn/turnMachine'
import { BOARD } from '@/lib/boardData'
import { ownerOf } from '../economy/titles'
import { addTempEffect } from '../economy/tempEffects'
import { reactorFor, findReactionCard, applyOffensive } from './reacao'
import { logEvent } from '../log'

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
export function cardResolve(rctx: ResolveCtx): ResolutionOutcome | null {
  const { square, state, playerId, ports } = rctx
  if (square.kind !== 'acaso' && square.kind !== 'tesouro') return null
  const deckId: DeckId = square.kind
  const id = state.decks[deckId].shift()
  if (!id) return { done: true } // nunca esgota na prática (imediatas reciclam)
  const card = cardById(id)
  // 021/022.1 — carta de mão: privada, só o deck (§10.3). Carta imediata: efeito
  // público, anuncia o nome (§12.2 "anúncio público").
  const deckLabel = deckId === 'acaso' ? 'Acaso' : 'Tesouro'
  const name = cardNameFromId(id)

  // Carta de mão: privada (§10.3) — loga só o deck, sem revelar a carta.
  if (card.mode === 'mao') {
    logEvent(state, playerId, `sacou ${deckLabel}`)
    const player = state.players.find((p) => p.id === playerId)!
    player.hand.push(id) // sai do deck, entra na mão
    if (player.hand.length > 3) {
      state.resolution = { kind: 'card-discard', deckId, drawnId: id } // 4ª → descarte forçado
      return { done: false, blocksFinalize: true }
    }
    return { done: true }
  }

  // imediato (público, §12.2). Atalho ainda vai escolher a direção:
  if (card.effect === 'atalho') {
    logEvent(state, playerId, `${deckLabel}: ${name}`)
    state.resolution = { kind: 'card-shortcut', deckId, cardId: id } // escolha ±3
    return { done: false, blocksFinalize: true }
  }
  // Demais imediatas: loga o RESULTADO (o que a carta causou), não o nome do evento.
  const player = state.players.find((p) => p.id === playerId)!
  const cashBefore = player.cash
  applyEffect(card.effect, state, playerId, ports)
  state.decks[deckId].push(id) // volta ao fundo
  logEvent(state, playerId, describeImmediate(card.effect, player.cash - cashBefore))
  // Cartas de MOVIMENTO (Avance/Volte 3) resolvem a casa de destino como um pouso
  // normal (comprar/pagar aluguel/etc.). gotojail no destino → 'encerrado' (resolvePending trata).
  if (card.effect === 'avance3' || card.effect === 'volte3') {
    land(state.turn, player, null)
    return { done: false, blocksFinalize: true }
  }
  return { done: true }
}

// Descrição do que um evento imediato CAUSOU (vai pro log). `dCash` = variação de
// caixa do jogador (negativo = pagou; positivo = recebeu). Sem "nome do evento" seco.
function describeImmediate(effect: string, dCash: number): string {
  switch (effect) {
    case 'voltaGo': return `foi para o GO (+$${dCash})`
    case 'vaPrisao': return 'foi para a Prisão'
    case 'avance3': return dCash > 0 ? `avançou 3 casas e passou no GO (+$${dCash})` : 'avançou 3 casas'
    case 'volte3': return 'voltou 3 casas'
    case 'apagao': return 'Apagão: hangares ficam inativos por 1 volta'
    case 'greveUtilidades': return 'Greve: utilidades sem aluguel por 1 volta'
    case 'investidorAnjo': return 'Investidor Anjo: 20% de desconto na próxima compra'
    case 'passagemOnibus': return 'ganhou 1 Bus Ticket'
    case 'refinanciamento': return dCash < 0
      ? `desipotecou uma propriedade pagando só 5% de juros ($${-dCash})`
      : 'Refinanciamento desipotecaria uma propriedade a juros de só 5%, mas você não tem nada hipotecado'
    case 'consertoImoveis': return dCash < 0
      ? `pagou $${-dCash} de conserto dos imóveis ($25/casa, $100/hotel)`
      : 'Conserto de Imóveis cobraria $25/casa e $100/hotel, mas você não tem construções'
    case 'criseImobiliaria': return dCash < 0
      ? `pagou $${-dCash} na crise (5% do patrimônio)`
      : 'Crise imobiliária cobraria 5% do seu patrimônio, mas você está sem propriedades e caixa a perder'
    case 'aniversario': return dCash > 0
      ? `recebeu $${dCash} de aniversário (cada adversário te paga $10)`
      : 'Aniversário: cada adversário te pagaria $10, mas não há outro jogador para cobrar'
    case 'honorarios': return `pagou $${-dCash} de honorários`
    default: // erroBanco, boomEconomico e quaisquer outros baseados em caixa
      if (dCash < 0) return `pagou $${-dCash}`
      if (dCash > 0) return `recebeu $${dCash}`
      return 'nenhum efeito'
  }
}

// 025 — Revelação: substitui cardResolve no ctx.resolve. SÓ carta de MÃO abre a tela
// (peek + pausa em `card-reveal`; o confirm saca/processa). Carta IMEDIATA não abre
// modal — processa na hora e só registra no log (cardResolve), por pedido de UX.
export function cardRevealResolve(rctx: ResolveCtx): ResolutionOutcome | null {
  const { square, state } = rctx
  if (square.kind !== 'acaso' && square.kind !== 'tesouro') return null
  const deckId: DeckId = square.kind
  const cardId = state.decks[deckId][0] // peek (determinístico)
  if (!cardId) return { done: true } // deck vazio (não ocorre na prática)
  if (cardById(cardId).mode === 'imediato') return cardResolve(rctx) // saca, aplica e loga — sem tela
  state.resolution = { kind: 'card-reveal', deckId, cardId } // só carta de mão revela
  return { done: false, blocksFinalize: true }
}

// 025 — Confirma a revelação: limpa o card-reveal e chama o cardResolve EXISTENTE
// (saca de verdade + processa). Reusa toda a regra de carta; sem duplicação.
export function confirmCardReveal(state: GameState, ports: TurnPorts): GameState {
  if (state.resolution?.kind !== 'card-reveal') return state
  const s: GameState = structuredClone(state)
  s.resolution = null
  const player = activePlayer(s)
  const rctx: ResolveCtx = { playerId: player.id, square: BOARD[player.pos], roll: s.turn.lastRoll, ports, state: s }
  const outcome = cardResolve(rctx) // saca + processa (pode abrir card-discard/card-shortcut)
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
  if (!player || !player.hand.includes(cardId)) return state
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
    if (findReactionCard(state, reactor, 'diplomacia')) {
      const s = structuredClone(state)
      const me = s.players.find((p) => p.id === playerId)!
      me.hand = me.hand.filter((h) => h !== cardId) // ofensiva "em voo" (sai da mão do atacante)
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
  p.hand = p.hand.filter((h) => h !== cardId)
  s.decks[deck].push(cardId)
  return s
}

// Conclui o descarte forçado (mão cheia): a carta escolhida vai ao fundo.
export function resolveCardDiscard(state: GameState, cardId: string): GameState {
  if (state.resolution?.kind !== 'card-discard') return state
  if (!activePlayer(state).hand.includes(cardId)) return state
  const s = structuredClone(state)
  const player = activePlayer(s)
  player.hand = player.hand.filter((h) => h !== cardId)
  s.decks[cardById(cardId).deck].push(cardId)
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
  land(s.turn, player, null) // resolve o destino normalmente
  return finishIfEnded(s, ctx)
}
