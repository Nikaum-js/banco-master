// US4 / SC-005 — integridade: ninguém age pelos outros. Todo comando carrega a identidade do
// remetente; o host rejeita `playerId` forjado e sessões sem assento, sem alterar estado nem
// difundir. Fecha o item 17 da auditoria (`store.ts:262`).
import { describe, expect, it } from 'vitest'
import { localTransport } from '@/net/localTransport'
import { supabaseTransport } from '@/net/supabaseTransport'
import { publicView, setupGame } from './harness'
import { fakeSupabase } from './fakeSupabase'

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
    // Convergência preservada: a visão de p2 acompanha (043: projeção pública — D7).
    expect(JSON.stringify(publicView(net.players[1].client.game()!))).toBe(JSON.stringify(publicView(net.host.game())))
  })
})

// 043 (D3/D-042) — o caso que era impossível de provar antes da Fase 2: até ali, o `uid` do
// remetente vinha de um CAMPO no payload (`{ cmd, uid }`), e nada impedia um cliente cru de
// escrever ali o que quisesse. A partir da topologia de três tópicos, esse campo NEM EXISTE
// MAIS no payload de `submit` — o `fromUid` que chega a `onSubmit` vem do CANAL, e forjar o
// campo (que o adapter de produção nem lê) não muda quem o host acredita que enviou.
describe('forjar o uid não funciona mais nem no payload cru (043, D3)', () => {
  it('um payload de submit com `uid` forjado ainda chega com o uid REAL do remetente', async () => {
    const fake = fakeSupabase()
    const host = supabaseTransport(fake.client('t-host'), 'sala-attack', 't-host')
    const attacker = supabaseTransport(fake.client('t-attacker'), 'sala-attack', 't-attacker')
    await host.connect()
    await attacker.connect()
    host.watchSeat('t-attacker')

    const seen: { fromUid: string }[] = []
    host.onSubmit((_cmd, fromUid) => seen.push({ fromUid }))

    // Envio LEGÍTIMO pela API pública — o adapter não aceita `uid` como argumento de `submit`,
    // então mesmo um chamador mal-intencionado não tem COMO declarar identidade alheia aqui.
    attacker.submit({ senderId: 'p1', action: { kind: 'roll' } })

    expect(seen).toEqual([{ fromUid: 't-attacker' }]) // nunca 't-host' ou qualquer outro uid
  })
})
