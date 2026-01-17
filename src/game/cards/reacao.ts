// Cartas de reação (017, SRS §10.6/§12.4) — subsistema de interrupção. Puro.
// Diplomacia cancela uma ofensiva contra você; Bunker Fiscal cancela um imposto de casa.
// A reação reusa o slot `resolution` (bloqueia finalizar); a ofensiva fica "em voo" na variante.
import type { ResolveCtx, ResolutionOutcome, TurnPorts } from '../turn/resolution'
import type { GameState } from '../turn/types'
import { completeResolution } from '../turn/turnMachine'
import { cardById } from './catalog'
import { removeFromHand } from './hand'
import { ownerOf } from '../economy/titles'
import { isTempImmune, isPlayerImmune, addTempEffect } from '../economy/tempEffects'
import { acquire, confiscate, audit, swap, embargo, canAcquire, canConfiscate, canAudit, canSwap, canEmbargo } from './ofensivas'
import { logEvent } from '../log'
import { discountedByTin } from '../economy/rent'

// id da carta na mão do jogador cujo efeito é a reação procurada (privado: não revela ao
// atacante). 043, T031 — ignora slot OCULTO: numa mão alheia (perspectiva de quem não é
// `playerId`), `hand` é só `null`, e `cardById(null)` estouraria. `null` aqui não significa
// "sem a carta" — significa "não sei"; é por isso que a decisão que IMPORTA (abrir ou não a
// janela) passa por `ports.hasReaction` (gravado/reproduzido — D11), não por esta função
// direto. `findReactionCard` continua correta na perspectiva de quem TEM a mão visível: o
// próprio reator, ou o host.
export function findReactionCard(
  state: GameState,
  playerId: string,
  effect: 'diplomacia' | 'bunkerFiscal',
): string | undefined {
  const p = state.players.find((x) => x.id === playerId)
  return p?.hand.find((id): id is string => id !== null && cardById(id).effect === effect)
}

// Quem pode reagir (Diplomacia) a esta ofensiva, SE ela for válida; senão null.
// `targetPos2` (D-064): só a Permuta Forçada usa — a propriedade PRÓPRIA do atacante.
export function reactorFor(
  state: GameState,
  effect: string,
  attackerId: string,
  targetPos: number | null,
  targetPlayer: string | null,
  targetPos2?: number | null,
): string | null {
  if (effect === 'aquisicaoHostil') return targetPos != null && canAcquire(state, attackerId, targetPos) ? ownerOf(state, targetPos) : null
  if (effect === 'confiscoGeral') return targetPos != null && canConfiscate(state, attackerId, targetPos) ? ownerOf(state, targetPos) : null
  if (effect === 'impostoFederal') return targetPlayer != null && canAudit(state, attackerId, targetPlayer) ? targetPlayer : null
  if (effect === 'permutaForcada')
    return targetPos != null && targetPos2 != null && canSwap(state, attackerId, targetPos2, targetPos) ? ownerOf(state, targetPos) : null
  if (effect === 'embargoDeObras') return targetPlayer != null && canEmbargo(state, attackerId, targetPlayer) ? targetPlayer : null
  if (effect === 'boicote') {
    if (targetPos == null) return null
    const owner = ownerOf(state, targetPos)
    if (owner === null || owner === attackerId || isTempImmune(state, targetPos) || isPlayerImmune(state, owner)) return null // gate do Boicote (015) / Imunidade Total (D-064)
    return owner
  }
  return null
}

// Aplica a ofensiva (na recusa da Diplomacia). MUTA o state.
export function applyOffensive(
  state: GameState,
  effect: string,
  attackerId: string,
  targetPos: number | null,
  targetPlayer: string | null,
  ports: TurnPorts,
  targetPos2?: number | null,
): void {
  if (effect === 'aquisicaoHostil' && targetPos != null) acquire(state, attackerId, targetPos)
  else if (effect === 'confiscoGeral' && targetPos != null) confiscate(state, attackerId, targetPos)
  else if (effect === 'impostoFederal' && targetPlayer != null) audit(state, attackerId, targetPlayer, ports)
  else if (effect === 'permutaForcada' && targetPos != null && targetPos2 != null) swap(state, attackerId, targetPos2, targetPos)
  else if (effect === 'embargoDeObras' && targetPlayer != null) embargo(state, attackerId, targetPlayer)
  else if (effect === 'boicote' && targetPos != null) addTempEffect(state, { kind: 'boicote', ownerId: attackerId, pos: targetPos, lapsRemaining: 2 })
}

// Imposto de casa + pagador com Bunker → abre reação (em vez de cobrar). Composto no ctx.resolve.
//
// 043: `ports.hasReaction` (gravado/reproduzido — D11), não `findReactionCard` direto — esta
// decisão vira `state.resolution`, PÚBLICA e estrutural; perguntando a mão do reator direto,
// cada perspectiva sem visão dela (todo mundo, exceto o próprio reator e o host) chegaria a
// uma resposta diferente e a convergência quebraria.
export function taxBunkerResolve(rctx: ResolveCtx): ResolutionOutcome | null {
  const { square, state, playerId, ports } = rctx
  if (square.kind !== 'tax') return null
  if (isPlayerImmune(state, playerId)) return null // Imunidade Total (D-064): o imposto nem será cobrado — não gaste o Bunker
  if (ports.hasReaction(state, playerId, 'bunkerFiscal') === null) return null
  state.resolution = {
    kind: 'reaction-bunker',
    reactorId: playerId,
    amount: discountedByTin(state, playerId, square.amount),
  }
  return { done: false }
}

// Responde a reação pendente (Diplomacia/Bunker): usar (cancela) ou recusar (aplica). Puro.
//
// 043, T031: a remoção da carta do reator tolera slot oculto (`removeFromHand`) — em quem NÃO
// é o reator, `findReactionCard` não encontra nada (mão alheia é só `null`), mas uma carta FOI
// gasta mesmo assim; `dip ?? null` preserva o comprimento da mão e do baralho em toda
// perspectiva, sem nomear qual carta era.
export function respondReaction(state: GameState, use: boolean, ports: TurnPorts): GameState {
  const res = state.resolution
  if (res?.kind !== 'reaction-diplomacia' && res?.kind !== 'reaction-bunker') return state
  if (state.paused) return state
  const s = structuredClone(state)
  const r = s.resolution!

  if (r.kind === 'reaction-diplomacia') {
    const reactor = s.players.find((p) => p.id === r.reactorId)
    if (use) {
      const dip = findReactionCard(s, r.reactorId, 'diplomacia') ?? null // cancela: gasta a Diplomacia
      if (reactor) {
        reactor.hand = removeFromHand(reactor.hand, dip)
        s.decks.tesouro.push(dip)
      }
      // 058/US2 — O RAMO QUE NÃO NARRAVA NADA. A ofensiva é cancelada, então ela não emite
      // fato; a Diplomacia saía da mão em silêncio. Para a mesa, a carta mais cara do
      // adversário simplesmente não fazia efeito — o relato literal da jogatina.
      //
      // O fato vai AQUI, e não em `findReactionCard`: ele não depende de saber QUAL carta
      // era (numa perspectiva sem visão da mão do reator, `dip` é `null`), só de que a
      // reação foi usada — que é exatamente o que a resolução já afirma.
      logEvent(s, {
        kind: 'reaction-blocked',
        who: r.reactorId,
        attackerId: r.attackerId,
        effect: r.effect,
        reaction: 'diplomacia',
        targetPos: r.targetPos,
        targetPlayer: r.targetPlayer,
      })
    } else {
      applyOffensive(s, r.effect, r.attackerId, r.targetPos, r.targetPlayer, ports, r.targetPos2) // recusa: aplica
    }
    s.decks[r.deck].push(r.cardId) // a ofensiva é gasta sempre (volta ao fundo)
    s.resolution = null // aberta fora do fluxo de resolução: preserva o estado do turno
    return s
  }

  if (r.kind !== 'reaction-bunker') return state // narrowing p/ o TS (inalcançável: já filtrado acima)
  const reactor = s.players.find((p) => p.id === r.reactorId)!
  if (use) {
    const bunker = findReactionCard(s, r.reactorId, 'bunkerFiscal') ?? null // cancela o imposto
    reactor.hand = removeFromHand(reactor.hand, bunker)
    s.decks.tesouro.push(bunker)
    completeResolution(s)
  } else if (reactor.cash >= r.amount) {
    reactor.cash -= r.amount // recusou: paga o imposto
    ports.onPayToCenter(s, r.amount)
    // ACHADO PELO INVARIANTE DE NARRAÇÃO da simulação (D-063), não por leitura: recusar o Bunker
    // pagava o imposto sem NENHUM fato. O `tax` do registry de resolução nunca chega a rodar
    // aqui — `taxBunkerResolve` intercepta a casa ANTES dele para abrir a janela de reação —,
    // então o pagamento acontecia por um caminho que ninguém tinha lembrado de narrar. É o mesmo
    // molde dos seis furos que a D-063 listou: um débito correto num ramo silencioso.
    logEvent(s, { kind: 'tax', who: r.reactorId, amount: r.amount })
    completeResolution(s)
  } else {
    // sem caixa → dívida (008). O reator do Bunker é sempre o jogador da vez (`taxBunkerResolve`
    // roda na resolução da casa dele), mas `debtorId` vai explícito de todo jeito: um dia isso
    // deixa de valer, e a dívida implícita foi exatamente o que a D-061 teve de desfazer.
    s.resolution = { kind: 'debt', amount: r.amount, creditorId: null, debtorId: r.reactorId, cause: 'bunker-tax' }
    logEvent(s, { kind: 'debt-open', who: r.reactorId, amount: r.amount, creditorId: null, cause: 'bunker-tax' })
  }
  return s
}
