// US3 / SC-004 — pausa global por desconexão: pausa para todos, comando rejeitado, prazos
// congelam e retomam, reconexão retoma sozinha, host caído pausa indefinidamente (FR-016..020).
import { describe, expect, it } from 'vitest'
import { createClient } from '@/net/client'
import { localTransport } from '@/net/localTransport'
import { applyCommand } from '@/game/commands'
import { buildGameCtx, buildInitialGame } from '@/game/ctx'
import type { GameState } from '@/game/turn/types'
import { mulberry32 } from '../sim/engine/rng'
import { setupGame, stepOnce } from './harness'

describe('pausa global por desconexão (SC-004)', () => {
  it('desconexão pausa para todos e mostra o caído; comando é rejeitado durante a pausa', async () => {
    const net = await setupGame(3, 161)
    const pick = mulberry32(42)
    for (let i = 0; i < 20; i++) stepOnce(net, pick)

    const p3 = net.players[2]
    p3.client.leave()

    // Pausa global (FR-016): host e demais clientes veem `paused`.
    expect(net.host.game().paused).toBe(true)
    expect(net.players[0].client.paused()).toBe(true)
    expect(net.players[1].client.paused()).toBe(true)
    // Status do desconectado visível a todos (FR-016, §12.3).
    const seatP3 = net.players[0].client.room()!.seats.find((s) => s.playerId === 'p3')!
    expect(seatP3.connected).toBe(false)

    // Comando de jogo durante a pausa é rejeitado (FR-017, US3-2).
    const seqBefore = net.host.seq()
    const snapBefore = JSON.stringify(net.host.game())
    for (let i = 0; i < 10; i++) stepOnce(net, pick)
    expect(net.host.seq()).toBe(seqBefore)
    expect(JSON.stringify(net.host.game())).toBe(snapBefore)
  })

  it('reconexão retoma automaticamente e nada se perde (FR-018/020)', async () => {
    const net = await setupGame(2, 555)
    const pick = mulberry32(77)
    for (let i = 0; i < 30; i++) stepOnce(net, pick)

    const guest = net.players[1]
    const p2Before = JSON.stringify(net.host.game().players.find((p) => p.id === 'p2'))

    guest.client.leave()
    expect(net.host.game().paused).toBe(true)

    const fresh = createClient(localTransport(net.hub, guest.token))
    await fresh.join()

    expect(net.host.game().paused).toBe(false) // retomou sozinho, sem ação manual
    const p2After = JSON.stringify(net.host.game().players.find((p) => p.id === 'p2'))
    expect(p2After).toBe(p2Before) // propriedades/cartas/saldo intactos (FR-020)
  })

  it('host desconectado pausa INDEFINIDAMENTE — sem transferência (FR-019)', async () => {
    const net = await setupGame(2, 808)
    const pick = mulberry32(3)
    for (let i = 0; i < 15; i++) stepOnce(net, pick)

    net.players[0].client.leave() // host cai
    expect(net.host.game().paused).toBe(true)

    // Segue pausado enquanto o host não volta — o convidado não pode destravar.
    for (let i = 0; i < 10; i++) stepOnce(net, pick)
    expect(net.host.game().paused).toBe(true)
  })
})

describe('congelamento de prazo em voo (FR-017)', () => {
  it('resume desloca o deadline do leilão pelo tempo pausado, preservando a janela', () => {
    const ctx = buildGameCtx(mulberry32(1), () => 0)
    const base: GameState = buildInitialGame(['p1', 'p2'], mulberry32(1))
    const g: GameState = {
      ...base,
      resolution: { kind: 'auction', auction: { pos: 5, currentBid: 100, highBidder: 'p1', activeBidders: ['p1', 'p2'], deadline: 5_000 } },
    }
    const paused = applyCommand(g, { kind: 'pause' }, ctx)
    expect(paused.paused).toBe(true)
    expect(paused.resolution).toEqual(g.resolution) // pausar não mexe no deadline

    const resumed = applyCommand(paused, { kind: 'resume', pausedMs: 2_000 }, ctx)
    expect(resumed.paused).toBe(false)
    expect(resumed.resolution?.kind === 'auction' && resumed.resolution.auction.deadline).toBe(7_000) // janela restante preservada
  })
})

// D-029 (SRS §11.3 v1.5) — a exceção que a spec 038 introduziu: quem já foi eliminado não
// tem patrimônio, turno nem decisão a proteger, e costuma fechar a aba. Como NÃO existe
// timeout de desconexão (D-015), a regra literal deixava a mesa refém de quem já perdeu.
describe('desconexão de jogador eliminado (D-029)', () => {
  it('não pausa a partida dos sobreviventes', async () => {
    const net = await setupGame(3, 21)
    net.host.game().players[2].eliminated = true // p3 fora da partida

    net.players[2].transport.disconnect()

    expect(net.host.game().paused).toBe(false)
    expect(net.host.room().seats[2].connected).toBe(false) // a sala registra a ausência…
    // …mas ela não trava ninguém: o jogo segue aceitando comando de quem está vivo.
    const seqAntes = net.host.seq()
    const ator = net.players.find((p) => p.playerId === net.host.game().players[net.host.game().turnOrder[net.host.game().activeSeat]].id)!
    ator.client.send({ kind: 'roll' })
    expect(net.host.seq()).toBeGreaterThan(seqAntes)
  })

  it('jogador VIVO que cai continua pausando — a exceção não afrouxa a regra', async () => {
    const net = await setupGame(3, 22)
    net.host.game().players[2].eliminated = true

    net.players[1].transport.disconnect() // p2 está vivo

    expect(net.host.game().paused).toBe(true)
  })

  it('a volta do eliminado não é condição para retomar', async () => {
    const net = await setupGame(3, 23)
    net.host.game().players[2].eliminated = true
    net.players[2].transport.disconnect() // eliminado sai (não pausa)
    net.players[1].transport.disconnect() // vivo cai → pausa

    expect(net.host.game().paused).toBe(true)
    await net.players[1].client.join() // só o vivo volta

    expect(net.host.game().paused).toBe(false) // retomou sem esperar o eliminado
  })
})
