// US2 / SC-003 — reload/reconexão sem perda. Reabrir o MESMO link (mesmo uid) re-anexa ao
// assento e restaura o estado exato via snapshot (FR-004/014/015). Vale para convidado e host.
import { describe, expect, it } from 'vitest'
import { createClient } from '@/net/client'
import { localTransport } from '@/net/localTransport'
import { mulberry32 } from '../sim/engine/rng'
import { setupGame, stepOnce } from './harness'

describe('reconexão sem perda (SC-003)', () => {
  it('convidado dá F5, reabre o mesmo link e volta ao assento com estado íntegro', async () => {
    const net = await setupGame(2, 314)
    const pick = mulberry32(1234)
    for (let i = 0; i < 40; i++) stepOnce(net, pick) // avança a partida
    const expected = JSON.stringify(net.host.game())
    const guest = net.players[1]

    // "Reload": a conexão antiga cai (dispara pausa) e o dispositivo reabre com o MESMO uid.
    guest.client.leave()
    expect(net.host.game().paused).not.toBeNull() // desconexão pausou (US3)

    const fresh = createClient(localTransport(net.hub, guest.uid))
    await fresh.join()

    expect(net.host.game().paused).toBeNull() // reconexão retomou automaticamente (FR-018)
    expect(fresh.playerId()).toBe('p2') // mesmo assento (FR-004)
    expect(JSON.stringify(fresh.game())).toBe(expected) // estado idêntico, zero perda (FR-015)
    // A visão do outro cliente também segue convergida.
    expect(JSON.stringify(net.players[0].client.game())).toBe(expected)
  })

  it('host dá F5 e reassume o assento + autoridade (FR-015/US2-2)', async () => {
    const net = await setupGame(2, 271)
    const pick = mulberry32(555)
    for (let i = 0; i < 30; i++) stepOnce(net, pick)
    const expected = JSON.stringify(net.host.game())
    const hostP = net.players[0]

    hostP.client.leave()
    expect(net.host.game().paused).not.toBeNull()

    // O host reabre o link (mesmo uid): a autoridade persiste no processo; o client re-anexa.
    const fresh = createClient(localTransport(net.hub, hostP.uid))
    await fresh.join()

    expect(fresh.playerId()).toBe('p1')
    expect(net.host.game().paused).toBeNull()
    expect(JSON.stringify(fresh.game())).toBe(expected)

    // Autoridade de volta: um novo comando legítimo é aceito e difundido.
    const seqBefore = net.host.seq()
    let sent = false
    for (let i = 0; i < 20 && !sent; i++) {
      const before = net.host.seq()
      stepOnce(net, pick)
      if (net.host.seq() > before) sent = true
    }
    expect(net.host.seq()).toBeGreaterThan(seqBefore)
  })
})
