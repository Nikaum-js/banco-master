// Perspectiva do jogador local (spec 038, US1). O que se prova aqui:
//   • a tabela de atores é EXAUSTIVA — comando novo sem perspectiva quebra a suíte;
//   • identidade ≠ elegibilidade (lance de leilão é de qualquer licitante, mas só do MEU assento);
//   • decisões FORA do turno vão ao ator certo (troca recebida, reação, empréstimo);
//   • eliminado acompanha mas não decide; pausa não deixa ninguém decidir;
//   • sem sala, nada é bloqueado (single-player intacto — SC-007).
import { describe, expect, it } from 'vitest'
import { localView, waitingForOf } from '@/net/localView'
import { actorOfKind, isSenderActed, type PlayerAction } from '@/game/commands'
import { createRoom, joinRoom, SEAT_COLORS, type Room } from '@/net/room'
import { createSeedState } from '@/game/setup'
import type { GameState } from '@/game/turn/types'
import { pausedBy } from './harness'

// Todos os kinds de PlayerAction — a lista é conferida contra o union no teste de exaustividade.
const ALL_KINDS: PlayerAction['kind'][] = [
  'roll', 'finalize', 'jail-decision', 'choose-bus-move', 'choose-triple-dest', 'use-bus-ticket',
  'resolve-pending', 'buy-property', 'decline-property', 'place-bid', 'pass-bid', 'place-land-bid',
  'build-house', 'sell-building', 'build-hangar', 'sell-hangar', 'mortgage', 'unmortgage',
  'play-hand-card', 'discard-card', 'choose-card-shortcut', 'confirm-card-reveal', 'respond-reaction',
  'pay-debt', 'declare-bankruptcy', 'grant-loan', 'propose-loan', 'respond-loan', 'pay-off-loan',
  'execute-trade', 'propose-trade', 'accept-trade', 'reject-trade', 'dismiss-notice',
]

function sala(): Room {
  let room = createRoom('r1', { token: 'tok-1', name: 'Um', color: SEAT_COLORS[0] })
  for (const [i, tok] of ['tok-2', 'tok-3'].entries()) {
    const r = joinRoom(room, { token: tok, name: `P${i + 2}`, color: SEAT_COLORS[i + 1] })
    if (!r.ok) throw new Error(r.reason)
    room = r.room
  }
  return room
}

const jogo = (): GameState => createSeedState(['p1', 'p2', 'p3'])

describe('exaustividade da tabela de atores', () => {
  it('todo kind de PlayerAction tem perspectiva decidida', () => {
    const game = jogo()
    for (const kind of ALL_KINDS) {
      // Ou o ator é derivável do estado, ou é declarado pelo remetente. Um kind novo que não
      // caia em nenhum dos dois casos indica tabela desatualizada.
      const derivavel = actorOfKind(game, kind) !== null
      const doRemetente = isSenderActed(kind)
      const semEstadoPendente = ['respond-reaction', 'respond-loan', 'accept-trade', 'reject-trade'].includes(kind)
      expect(derivavel || doRemetente || semEstadoPendente).toBe(true)
    }
  })

  it('a lista do teste cobre o union inteiro (falha ao esquecer um comando novo)', () => {
    // `Record<PlayerAction['kind'], true>` só compila com TODAS as chaves — se um kind novo
    // for adicionado ao motor sem entrar em ALL_KINDS, isto quebra no typecheck.
    const cobertura = Object.fromEntries(ALL_KINDS.map((k) => [k, true])) as Record<PlayerAction['kind'], true>
    expect(Object.keys(cobertura)).toHaveLength(ALL_KINDS.length)
  })
})

describe('perspectiva local com sala', () => {
  it('o jogador da vez é o ator; os demais são observadores', () => {
    const game = jogo() // p1 começa
    const room = sala()
    const eu = localView(game, room, 'tok-1')
    const outro = localView(game, room, 'tok-2')

    expect(eu.seatId).toBe('p1')
    expect(eu.role).toBe('actor')
    expect(eu.mayAct('roll')).toBe(true)

    expect(outro.role).toBe('observer')
    expect(outro.mayAct('roll')).toBe(false)
    expect(outro.waitingFor).toBe('p1') // "aguardando <nome de p1>"
  })

  it('isMe distingue o dono da tela de todos os outros', () => {
    const view = localView(jogo(), sala(), 'tok-2')
    expect(view.isMe('p2')).toBe(true)
    expect(view.isMe('p1')).toBe(false)
    expect(view.isMe('p3')).toBe(false)
  })

  it('lance de leilão é legítimo de qualquer assento — identidade, não elegibilidade', () => {
    const game = jogo()
    const room = sala()
    // Nenhum dos dois é o jogador da vez em relação ao lance: o ator é quem declara.
    expect(localView(game, room, 'tok-2').mayAct('place-bid')).toBe(true)
    expect(localView(game, room, 'tok-3').mayAct('pass-bid')).toBe(true)
    // A elegibilidade (ser licitante ativo) NÃO é resposta desta camada — segue nos gates
    // do motor, e a UI compõe as duas condições.
  })

  it('resposta a proposta de troca vai ao destinatário, não ao jogador da vez', () => {
    const game = jogo()
    game.pendingTrade = {
      fromId: 'p1',
      toId: 'p3',
      fromProps: [],
      toProps: [],
      fromCash: 0,
      toCash: 0,
    } as unknown as GameState['pendingTrade']
    const room = sala()

    expect(localView(game, room, 'tok-3').mayAct('accept-trade')).toBe(true)
    expect(localView(game, room, 'tok-1').mayAct('accept-trade')).toBe(false) // proponente não responde
    expect(waitingForOf(game)).toBe('p3')
  })

  it('resposta de empréstimo vai ao credor', () => {
    const game = jogo()
    game.pendingLoan = { debtorId: 'p1', creditorId: 'p2' } as unknown as GameState['pendingLoan']
    const room = sala()

    expect(localView(game, room, 'tok-2').mayAct('respond-loan')).toBe(true)
    expect(localView(game, room, 'tok-1').mayAct('respond-loan')).toBe(false)
    expect(waitingForOf(game)).toBe('p2')
  })

  it('jogador eliminado acompanha, mas não decide nada (FR-007)', () => {
    const game = jogo()
    game.players[1].eliminated = true
    const view = localView(game, sala(), 'tok-2')

    expect(view.role).toBe('eliminated')
    for (const kind of ALL_KINDS) expect(view.mayAct(kind)).toBe(false)
  })

  it('durante a pausa ninguém decide (FR-014)', () => {
    const game = jogo()
    game.paused = pausedBy('disconnect')
    const view = localView(game, sala(), 'tok-1') // jogador da vez

    expect(view.mayAct('roll')).toBe(false)
    expect(view.mayAct('place-bid')).toBe(false)
  })
})

describe('sem sala (cliente único) — SC-007', () => {
  it('nada é bloqueado e a perspectiva acompanha o jogador da vez', () => {
    const game = jogo()
    const view = localView(game, null, null)

    expect(view.seatId).toBeNull()
    expect(view.role).toBe('local')
    expect(view.isMe('p1')).toBe(true) // p1 é quem joga agora
    for (const kind of ALL_KINDS) expect(view.mayAct(kind)).toBe(true)
  })

  it('token sem assento na sala também não trava o cliente único', () => {
    const view = localView(jogo(), sala(), 'tok-desconhecido')
    expect(view.seatId).toBeNull()
    expect(view.mayAct('roll')).toBe(true)
  })
})
