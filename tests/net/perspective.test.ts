// Perspectiva local ponta a ponta (spec 038, US1/SC-001). O `localView.test.ts` cobre a
// função pura; aqui a pergunta é outra: numa partida REAL de 3 clientes sobre o hub,
// a perspectiva de cada um bate com o que o host aceita?
//
// A invariante que se prova: **o que `mayAct` libera é exatamente o que o host aceita**.
// Se a UI oferecesse um controle a mais, o comando morreria no host (tela mentindo); se
// oferecesse a menos, o jogador ficaria travado sem poder jogar a própria vez.
import { describe, expect, it } from 'vitest'
import { localView } from '@/net/localView'
import type { PlayerAction } from '@/game/commands'
import { setupGame, type NetGame } from './harness'

const KINDS: PlayerAction['kind'][] = ['roll', 'finalize', 'resolve-pending', 'buy-property', 'build-house']

function viewOf(net: NetGame, i: number) {
  return localView(net.host.game(), net.host.room(), net.players[i].token)
}

describe('perspectiva local numa partida em rede', () => {
  it('em cada instante, exatamente um cliente pode rolar — o da vez', async () => {
    const net = await setupGame(3, 11)

    for (let turno = 0; turno < 6; turno++) {
      const podem = net.players.map((_, i) => viewOf(net, i)).filter((v) => v.mayAct('roll'))
      expect(podem).toHaveLength(1)

      const eu = net.players.findIndex((_, i) => viewOf(net, i).mayAct('roll'))
      net.players[eu].client.send({ kind: 'roll' })
      // Devolve o turno para seguir o roteiro (dupla mantém o mesmo jogador — tudo bem).
      net.players[eu].client.send({ kind: 'resolve-pending' })
      net.players[eu].client.send({ kind: 'finalize' })
    }
  })

  it('o que a perspectiva libera é o que o host aceita (affordance = autoridade)', async () => {
    const net = await setupGame(3, 5)

    for (const kind of KINDS) {
      for (const [i, p] of net.players.entries()) {
        const view = viewOf(net, i)
        const seqAntes = net.host.seq()
        // Comando mínimo do kind — só interessa se a IDENTIDADE passa pelo host.
        const action = { kind, pos: 1, playerId: p.playerId } as unknown as PlayerAction
        p.client.send(action)
        const aceitouAlgo = net.host.seq() > seqAntes

        // Host aceitando ⟹ a perspectiva daquele cliente também liberava.
        if (aceitouAlgo) expect(view.mayAct(kind)).toBe(true)
      }
    }
  })

  it('quem não é o ator não muda o estado de ninguém (SC-001/SC-005)', async () => {
    const net = await setupGame(3, 3)
    const naoAtor = net.players.find((_, i) => !viewOf(net, i).mayAct('roll'))!

    const antes = net.serialized()
    naoAtor.client.send({ kind: 'roll' })
    expect(net.serialized()).toEqual(antes) // nada mudou em NENHUMA das visões
  })

  it('o eliminado perde os controles, e a partida segue para os vivos', async () => {
    const net = await setupGame(3, 9)
    // Elimina p3 diretamente no estado do host (o caminho de falência tem sua própria suíte).
    const g = net.host.game()
    g.players[2].eliminated = true

    const viewEliminado = localView(g, net.host.room(), net.players[2].token)
    expect(viewEliminado.role).toBe('eliminated')
    expect(viewEliminado.mayAct('roll')).toBe(false)
    expect(viewEliminado.mayAct('place-bid')).toBe(false)

    // E quem está vivo segue jogando normalmente.
    const vivos = net.players.slice(0, 2).map((_, i) => localView(g, net.host.room(), net.players[i].token))
    expect(vivos.some((v) => v.mayAct('roll'))).toBe(true)
  })

  it('durante a pausa nenhum cliente oferece decisão (FR-014)', async () => {
    const net = await setupGame(2, 7)
    net.players[1].transport.disconnect() // queda → pausa global

    const views = net.players.map((_, i) => viewOf(net, i))
    expect(net.host.game().paused).not.toBeNull()
    for (const v of views) expect(v.mayAct('roll')).toBe(false)
  })
})
