import { describe, it, expect } from 'vitest'
import { playHandCard } from '@/game/cards/draw'
import { taxBunkerResolve, respondReaction } from '@/game/cards/reacao'
import { createSeedState, defaultPorts } from '@/game/store'
import type { GameState } from '@/game/turn/types'
import { BOARD } from '@/lib/boardData'

const TAX = BOARD.find((s) => s.kind === 'tax')!.pos
const TAX_AMT = 'amount' in BOARD[TAX] ? (BOARD[TAX] as { amount: number }).amount : 0

// p1 (ativo) ataca; p2 dono de pos 1 e 3 (2 não-hipotecadas → alvo válido p/ Aquisição).
function attackSetup(attackerCard: string, p2HasDiplomacia: boolean): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.players[0].hand.push(attackerCard)
  g.titles[1].ownerId = 'p2'
  g.titles[3].ownerId = 'p2'
  if (p2HasDiplomacia) g.players[1].hand.push('diplomacia-1')
  return g
}

describe('Diplomacia — reação a ofensiva (US1)', () => {
  it('SC-001: ofensiva contra alvo com Diplomacia abre reação (não aplica)', () => {
    const g = attackSetup('aquisicao-hostil-1', true)
    const out = playHandCard(g, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)
    expect(out.resolution?.kind).toBe('reaction-diplomacia')
    if (out.resolution?.kind === 'reaction-diplomacia') expect(out.resolution.reactorId).toBe('p2')
    expect(out.players[0].hand).not.toContain('aquisicao-hostil-1') // em voo
    expect(out.titles[1].ownerId).toBe('p2') // ainda não transferida
  })

  it('SC-002: usar Diplomacia cancela (sem efeito, ambas recicladas)', () => {
    let g = attackSetup('aquisicao-hostil-1', true)
    g = playHandCard(g, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)
    const out = respondReaction(g, true, defaultPorts)
    expect(out.resolution).toBeNull()
    expect(out.titles[1].ownerId).toBe('p2') // não mudou
    expect(out.players[0].cash).toBe(2000) // atacante não pagou
    expect(out.players[1].hand).not.toContain('diplomacia-1') // Diplomacia gasta
    expect(out.decks.acaso).toContain('aquisicao-hostil-1') // ofensiva reciclada
  })

  it('SC-002: recusar aplica a ofensiva', () => {
    let g = attackSetup('aquisicao-hostil-1', true)
    g = playHandCard(g, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)
    const out = respondReaction(g, false, defaultPorts)
    expect(out.resolution).toBeNull()
    expect(out.titles[1].ownerId).toBe('p1') // adquirida
    expect(out.players[0].cash).toBe(2000 - 60)
    expect(out.players[1].cash).toBe(2000 + 60)
  })

  it('SC-001: alvo sem Diplomacia → ofensiva aplica direto', () => {
    const g = attackSetup('aquisicao-hostil-1', false)
    const out = playHandCard(g, 'p1', 'aquisicao-hostil-1', defaultPorts, 1)
    expect(out.resolution).toBeNull()
    expect(out.titles[1].ownerId).toBe('p1') // aplicou direto
  })

  it('SC-002: Diplomacia também intercepta Boicote', () => {
    const g = attackSetup('boicote-1', true)
    const out = playHandCard(g, 'p1', 'boicote-1', defaultPorts, 1)
    expect(out.resolution?.kind).toBe('reaction-diplomacia')
  })
})

describe('Bunker Fiscal — reação a imposto (US2)', () => {
  function taxState(hasBunker: boolean): GameState {
    const g = createSeedState(['p1', 'p2'])
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    if (hasBunker) g.players[0].hand.push('bunker-fiscal-1')
    return g
  }

  it('SC-003: imposto com Bunker abre reação', () => {
    const g = taxState(true)
    const outcome = taxBunkerResolve({ playerId: 'p1', square: BOARD[TAX], roll: null, ports: defaultPorts, state: g })
    expect(outcome).toEqual({ done: false, blocksFinalize: true })
    expect(g.resolution?.kind).toBe('reaction-bunker')
  })

  it('SC-003: sem Bunker → null (cai no handler default de imposto)', () => {
    const g = taxState(false)
    expect(taxBunkerResolve({ playerId: 'p1', square: BOARD[TAX], roll: null, ports: defaultPorts, state: g })).toBeNull()
  })

  it('SC-003: usar Bunker cancela o imposto; recusar paga', () => {
    const usa = taxState(true)
    taxBunkerResolve({ playerId: 'p1', square: BOARD[TAX], roll: null, ports: defaultPorts, state: usa })
    const cancelado = respondReaction(usa, true, defaultPorts)
    expect(cancelado.players[0].cash).toBe(2000) // não pagou
    expect(cancelado.players[0].hand).not.toContain('bunker-fiscal-1') // gasta
    expect(cancelado.resolution).toBeNull()

    const recusa = taxState(true)
    taxBunkerResolve({ playerId: 'p1', square: BOARD[TAX], roll: null, ports: defaultPorts, state: recusa })
    const pago = respondReaction(recusa, false, defaultPorts)
    expect(pago.players[0].cash).toBe(2000 - TAX_AMT) // pagou o imposto
    expect(pago.resolution).toBeNull()
  })
})
