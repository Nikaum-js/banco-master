// FR-012 / US2-3 — um cliente que perde comandos difundidos (rede instável) detecta a lacuna
// na sequência e se recupera SOZINHO lendo o snapshot atual, convergindo de volta.
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../sim/engine/rng'
import { setupGame, stepOnce } from './harness'

const flush = (): Promise<void> => new Promise((res) => setTimeout(res, 0)) // drena o resync assíncrono (loadSnapshot)

describe('recuperação por lacuna de sequência (FR-012)', () => {
  it('cliente que perde difusões recupera via snapshot e converge', async () => {
    const net = await setupGame(2, 2718)
    const pick = mulberry32(9001)
    const guestToken = net.players[1].token
    const guest = net.players[1].client

    for (let i = 0; i < 15; i++) stepOnce(net, pick) // aquecimento — ambos convergidos
    expect(JSON.stringify(guest.game())).toBe(JSON.stringify(net.host.game()))
    const seqAtDrop = guest.seq()

    // Rede instável: o convidado para de receber difusões.
    net.hub.setDropBroadcast(guestToken, true)
    let guard = 0
    while (net.host.seq() < seqAtDrop + 3 && guard++ < 200) stepOnce(net, pick)
    expect(guest.seq()).toBe(seqAtDrop) // ficou para trás (perdeu ≥3 comandos)
    expect(net.host.seq()).toBeGreaterThanOrEqual(seqAtDrop + 3)

    // Rede volta: a próxima difusão chega com um "buraco" na sequência → dispara recuperação.
    net.hub.setDropBroadcast(guestToken, false)
    guard = 0
    const target = net.host.seq()
    while (net.host.seq() <= target && guard++ < 200) stepOnce(net, pick)
    await flush()

    expect(guest.seq()).toBe(net.host.seq()) // reconvergiu
    expect(JSON.stringify(guest.game())).toBe(JSON.stringify(net.host.game()))
  })
})
