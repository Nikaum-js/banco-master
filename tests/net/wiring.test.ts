// T017 — `connectMultiplayer` liga o `useGameStore` (consumido pela UI) ao client: métodos de
// ação viram comandos enviados ao host, e o `game` do store reflete a difusão (pessimista).
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

    // UI chama `rollDice` → comando 'roll' → host aplica e difunde → store atualiza.
    const seqBefore = net.host.seq()
    useGameStore.getState().rollDice()
    expect(net.host.seq()).toBe(seqBefore + 1)
    expect(JSON.stringify(useGameStore.getState().game)).toBe(JSON.stringify(net.host.game()))
  })
})
