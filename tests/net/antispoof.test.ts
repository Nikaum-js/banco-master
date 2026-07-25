// US4 / SC-005 — integridade: ninguém age pelos outros. Todo comando carrega a identidade do
// remetente; o host rejeita `playerId` forjado e sessões sem assento, sem alterar estado nem
// difundir. Fecha o item 17 da auditoria (`store.ts:262`).
import { describe, expect, it } from 'vitest'
import { localTransport } from '@/net/localTransport'
import { setupGame } from './harness'

describe('anti-spoof de identidade (SC-005)', () => {
  it('comando com playerId FORJADO é descartado sem efeito (US4-1)', async () => {
    const net = await setupGame(2, 42)
    const before = JSON.stringify(net.host.game())
    const seqBefore = net.host.seq()
    // p2 (token tok-1) envia um `roll` fingindo ser p1 — direto no transporte, com senderId forjado.
    net.players[1].transport.submit({ senderId: 'p1', action: { kind: 'roll' } })
    expect(net.host.seq()).toBe(seqBefore) // nada aceito
    expect(JSON.stringify(net.host.game())).toBe(before) // estado imutável
  })

  it('comando de sessão SEM assento na sala é descartado (US4-2)', async () => {
    const net = await setupGame(2, 7)
    const before = JSON.stringify(net.host.game())
    const stranger = localTransport(net.hub, 'intruso')
    await stranger.connect()
    stranger.submit({ senderId: 'p1', action: { kind: 'roll' } })
    expect(JSON.stringify(net.host.game())).toBe(before)
  })

  it('ação legítima do próprio jogador é aceita (a checagem é identidade, não bloqueio extra — US4-3)', async () => {
    const net = await setupGame(2, 99)
    const seqBefore = net.host.seq()
    // p1 (jogador ativo) rola pelo próprio id → aceito e difundido.
    net.players[0].client.send({ kind: 'roll' })
    expect(net.host.seq()).toBe(seqBefore + 1)
    // Convergência preservada: a visão de p2 acompanha.
    expect(JSON.stringify(net.players[1].client.game())).toBe(JSON.stringify(net.host.game()))
  })
})
