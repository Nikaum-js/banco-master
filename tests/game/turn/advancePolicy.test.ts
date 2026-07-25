// Card 2 do review de arquitetura: a política de auto-avanço morava num `useEffect` de
// `GameDriver.tsx` — inalcançável por teste num projeto com `environment: 'node'` e sem
// DOM testing. Extraída, é uma função pura e estes são os primeiros testes que ela tem.
import { describe, expect, it } from 'vitest'
import { advancePolicy } from '@/game/turn/advancePolicy'
import { createSeedState } from '@/game/setup'
import type { GameState } from '@/game/turn/types'

// Estado no ponto exato em que o jogo deve resolver a casa sozinho.
function aResolver(over: Partial<GameState> = {}): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.turn.state = 'casa-a-resolver'
  g.turn.awaitingChoice = null
  g.resolution = null
  return { ...g, ...over }
}

describe('advancePolicy — resolver a casa', () => {
  it('resolve sozinho quando não há decisão pendente', () => {
    expect(advancePolicy(aResolver())).toEqual({ kind: 'resolve-pending' })
  })

  it('espera o peão terminar de andar', () => {
    expect(advancePolicy(aResolver(), { animating: true })).toBeNull()
  })

  it('não age quando a vez é de outro dispositivo (spec 038, FR-002)', () => {
    expect(advancePolicy(aResolver(), { mayAct: false })).toBeNull()
  })

  it('não age com uma resolução aberta — o modal é decisão do jogador', () => {
    const g = aResolver()
    g.resolution = { kind: 'purchase', pos: 1, playerId: 'p1' } as GameState['resolution']
    expect(advancePolicy(g)).toBeNull()
  })

  it('não age com escolha de Speed Die pendente (triple/ônibus)', () => {
    const g = aResolver()
    g.turn.awaitingChoice = 'triple'
    expect(advancePolicy(g)).toBeNull()
  })
})

describe('advancePolicy — finalizar', () => {
  const aguardando = (mayRollAgain: boolean): GameState => {
    const g = createSeedState(['p1', 'p2'])
    g.turn.state = 'aguardando-finalizacao'
    g.turn.mayRollAgain = mayRollAgain
    return g
  }

  it('re-rola sozinho na DUPLA', () => {
    expect(advancePolicy(aguardando(true))).toEqual({ kind: 'finalize' })
  })

  it('passar a vez segue MANUAL — sem dupla, não finaliza sozinho (D-015)', () => {
    expect(advancePolicy(aguardando(false))).toBeNull()
  })

  it('a animação NÃO segura a re-rolagem — só a resolução da casa', () => {
    expect(advancePolicy(aguardando(true), { animating: true })).toEqual({ kind: 'finalize' })
  })
})

describe('advancePolicy — portões globais', () => {
  it('pausado, o jogo não anda sozinho (VII, FR-011)', () => {
    expect(advancePolicy(aResolver({ paused: true }))).toBeNull()
  })

  it('partida encerrada não anda sozinha', () => {
    expect(advancePolicy(aResolver({ phase: 'ended' }))).toBeNull()
  })

  it('aguardando rolagem, quem age é o jogador — nunca a política', () => {
    const g = createSeedState(['p1', 'p2'])
    expect(g.turn.state).toBe('aguardando-rolagem')
    expect(advancePolicy(g)).toBeNull()
  })
})
