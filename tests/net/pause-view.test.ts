// View-models de conexão e pausa (041) — testando a VIEW, não o DOM, mesma abordagem dos
// `*View` da 038. `pauseBannerView` nomeia CADA causa ativa; antes, uma pausa por
// persistência (sem ausentes) era invisível (`show` dependia de `ausentes.length > 0`).
import { describe, expect, it } from 'vitest'
import { pauseBannerView } from '@/net/ui/pauseBannerView'
import { connectionBannerView } from '@/net/ui/connectionBannerView'
import { createSeedState } from '@/game/setup'
import { createRoom, joinRoom, SEAT_COLORS, markDisconnected, type Room } from '@/net/room'
import type { GameState } from '@/game/turn/types'
import { pausedBy } from './harness'

function sala(): Room {
  let room = createRoom('r1', { token: 'tok-1', name: 'Ana', color: SEAT_COLORS[0] })
  const r2 = joinRoom(room, { token: 'tok-2', name: 'Bob', color: SEAT_COLORS[1] })
  if (!r2.ok) throw new Error(r2.reason)
  room = r2.room
  return room
}

const jogo = (): GameState => createSeedState(['p1', 'p2'])

describe('pauseBannerView (041)', () => {
  it('sem sala (cliente único) não mostra nada — SC-007', () => {
    expect(pauseBannerView(jogo(), null)).toBeNull()
  })

  it('sem pausa não mostra nada', () => {
    expect(pauseBannerView(jogo(), sala())).toBeNull()
  })

  it('só desconexão: nomeia os ausentes, termina em "reconectar"', () => {
    const g = { ...jogo(), paused: pausedBy('disconnect') }
    const room = markDisconnected(sala(), 'tok-2')
    const view = pauseBannerView(g, room)!
    expect(view.ausentes.map((s) => s.playerId)).toEqual(['p2'])
    expect(view.hostFora).toBe(false)
    expect(view.tail).toBe('reconectar')
  })

  it('só persistência: SEM ausentes — antes disto era invisível', () => {
    const g = { ...jogo(), paused: pausedBy('persistence') }
    const view = pauseBannerView(g, sala())!
    expect(view.ausentes).toEqual([])
    expect(view.tail).toBe('o salvamento voltar')
  })

  it('as duas causas ativas: a frase nomeia as DUAS', () => {
    const g = { ...jogo(), paused: { causes: ['disconnect', 'persistence'], since: 0 } as GameState['paused'] }
    const room = markDisconnected(sala(), 'tok-2')
    const view = pauseBannerView(g, room)!
    expect(view.ausentes.map((s) => s.playerId)).toEqual(['p2'])
    expect(view.tail).toBe('reconectar e o salvamento voltar')
  })

  it('host fora: a frase muda para "o anfitrião voltar"', () => {
    const g = { ...jogo(), paused: pausedBy('disconnect') }
    const room = markDisconnected(sala(), 'tok-1') // tok-1 é o host
    const view = pauseBannerView(g, room)!
    expect(view.hostFora).toBe(true)
    expect(view.tail).toBe('o anfitrião voltar')
  })

  it('eliminado desconectado não aparece nos ausentes (D-029)', () => {
    const g = { ...jogo(), paused: pausedBy('disconnect') }
    g.players[1].eliminated = true
    const room = markDisconnected(sala(), 'tok-2')
    const view = pauseBannerView(g, room)!
    expect(view.ausentes).toEqual([])
  })
})

describe('connectionBannerView (041)', () => {
  it('conectado: nada a mostrar', () => {
    expect(connectionBannerView('connected')).toBeNull()
  })

  it('reconectando: aviso de queda própria', () => {
    const view = connectionBannerView('reconnecting')!
    expect(view.title).toMatch(/caiu/i)
  })

  it('desynced: texto PRÓPRIO — reconectado, ainda reconciliando', () => {
    const view = connectionBannerView('desynced')!
    expect(view.title).not.toMatch(/caiu/i)
    expect(view.detail).toMatch(/sincroniz/i)
  })
})
