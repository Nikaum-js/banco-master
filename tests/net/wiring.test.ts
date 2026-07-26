// T017 — `connectMultiplayer` liga o `useGameStore` (consumido pela UI) ao client: o
// `dispatch` da UI vira comando enviado ao host, e o `game` do store reflete a difusão
// (pessimista). Card 1 do review: o store tem UMA porta de ação, então este teste cobre
// o roteamento inteiro — antes cobria 1 dos 34 mapeamentos escritos à mão.
import { afterEach, describe, expect, it } from 'vitest'
import { useGameStore } from '@/game/store'
import { connectMultiplayer } from '@/net/connectStore'
import { setupGame } from './harness'

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

describe('connectMultiplayer (T017)', () => {
  it('reflete o estado do client no store e roteia ações da UI como comandos', async () => {
    const net = await setupGame(2, 5)
    const hostClient = net.players[0].client
    cleanup = connectMultiplayer(hostClient)

    // Store espelha o estado inicial do client.
    expect(JSON.stringify(useGameStore.getState().game)).toBe(JSON.stringify(hostClient.game()))

    // UI despacha 'roll' → host aplica e difunde → store atualiza.
    const seqBefore = net.host.seq()
    useGameStore.getState().dispatch({ kind: 'roll' })
    expect(net.host.seq()).toBe(seqBefore + 1)
    expect(JSON.stringify(useGameStore.getState().game)).toBe(JSON.stringify(net.host.game()))
  })

  it('não emite ações de SISTEMA — fecho por prazo e pausa são do host', async () => {
    const net = await setupGame(2, 5)
    cleanup = connectMultiplayer(net.players[0].client)

    const seqBefore = net.host.seq()
    useGameStore.getState().dispatch({ kind: 'pause', cause: 'disconnect', at: 0 })
    useGameStore.getState().dispatch({ kind: 'close-auction' })
    useGameStore.getState().dispatch({ kind: 'close-land-lots', now: 0 })
    expect(net.host.seq()).toBe(seqBefore) // nada trafegou
  })

  it('o desligador RESTAURA o dispatch local — sair da sala não deixa o store morto', async () => {
    const net = await setupGame(2, 5)
    const disconnect = connectMultiplayer(net.players[0].client)
    disconnect()

    // Fora da sala, o dispatch volta a aplicar no reducer local.
    const before = useGameStore.getState().game
    useGameStore.getState().dispatch({ kind: 'roll' })
    expect(useGameStore.getState().game).not.toBe(before)
    expect(net.host.seq()).toBe(net.host.seq()) // nada foi enviado ao host
  })
})
