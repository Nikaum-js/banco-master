// Espólio do falido em REDE (spec 039, SC-006/FR-022). O `tests/game/falencia/espolio.test.ts`
// prova a regra; aqui a pergunta é outra: o pregão que a falência abre converge entre host e
// clientes?
//
// O risco concreto: o prazo dos lotes é `now + WINDOW`. Se `declareBankruptcy` lesse o relógio
// direto (`Date.now()`), cada cliente calcularia um prazo diferente ao aplicar o mesmo comando
// e o estado divergiria — silenciosamente, porque nada estoura, os lotes só fecham em momentos
// distintos. Este teste falha exatamente nesse cenário: o `now` tem que passar pelo `ctx`, que
// o `recorder` (037/FR-011) grava no host e reproduz nos clientes.
import { describe, expect, it } from 'vitest'
import { setupGame, clientOf, type NetGame } from './harness'
import type { GameState } from '@/game/turn/types'

// Deixa `p1` (host, primeira cadeira) insolvente com dívida AO BANCO e dono das propriedades,
// para chegar no ponto de decisão sem dirigir a partida inteira até lá.
//
// A mutação é aplicada a TODAS as visões (host + cada cliente), não só à do host: o objetivo
// aqui é medir convergência, então as visões têm de partir idênticas — se só o host fosse
// preparado, `serialized()` já divergiria antes de qualquer comando e o teste mediria o
// próprio setup. Mutar `game()` direto é o padrão que a suíte de rede já usa (pause.test.ts).
function armaFalencia(net: NetGame, props: number[]): void {
  const prepara = (g: GameState): void => {
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'debt', amount: 5000, creditorId: null } // credor = BANCO
    g.players[0].cash = 0
    for (const pos of props) g.titles[pos].ownerId = 'p1'
  }
  prepara(net.host.game())
  for (const p of net.players) {
    const g = p.client.game()
    if (g && g !== net.host.game()) prepara(g)
  }
  expect(new Set(net.serialized()).size).toBe(1) // o setup em si não diverge
}

describe('espólio em rede (039)', () => {
  it('SC-006: a abertura do pregão do espólio converge byte a byte', async () => {
    const net = await setupGame(3, 7)
    armaFalencia(net, [1, 3, 6])

    clientOf(net, 'p1').send({ kind: 'declare-bankruptcy' })

    const g = net.host.game()
    expect(g.landAuction).not.toBeNull()
    expect(g.landAuction!.bankruptId).toBe('p1')
    expect(g.landAuction!.lots.map((l) => l.pos).sort((a, b) => a - b)).toEqual([1, 3, 6])
    // O falido sai dos licitantes (FR-012) e a mesa segue com os dois sobreviventes.
    expect(g.landAuction!.bidders).toEqual(['p2', 'p3'])

    const views = net.serialized()
    expect(new Set(views).size).toBe(1) // host + 2 clientes idênticos
  })

  it('SC-006: o fecho dos lotes converge — lance de um cliente, arremate visto por todos', async () => {
    const net = await setupGame(3, 7)
    armaFalencia(net, [1, 3])
    clientOf(net, 'p1').send({ kind: 'declare-bankruptcy' })

    const caixaAntes = net.host.game().players[1].cash
    clientOf(net, 'p2').send({ kind: 'place-land-bid', playerId: 'p2', pos: 1, amount: 200 })
    expect(new Set(net.serialized()).size).toBe(1)

    net.advance(60_000) // estoura o prazo de todos os lotes → host fecha e difunde
    const g = net.host.game()
    expect(g.titles[1].ownerId).toBe('p2') // arrematado
    expect(g.titles[3].ownerId).toBeNull() // sem lance → livre (FR-011)
    expect(g.players[1].cash).toBe(caixaAntes - 200)
    expect(g.landAuction).toBeNull() // último lote saiu

    expect(new Set(net.serialized()).size).toBe(1)
  })

  it('FR-023: o lance no espólio só é aceito do assento do remetente', async () => {
    const net = await setupGame(3, 7)
    armaFalencia(net, [1, 3])
    clientOf(net, 'p1').send({ kind: 'declare-bankruptcy' })

    // p2 tentando licitar COMO p3 — o host confere o assento da conexão e descarta.
    const seqAntes = net.host.seq()
    clientOf(net, 'p2').send({ kind: 'place-land-bid', playerId: 'p3', pos: 1, amount: 200 })
    expect(net.host.seq()).toBe(seqAntes)
    expect(net.host.game().landAuction!.lots.find((l) => l.pos === 1)!.highBidder).toBeNull()
    expect(new Set(net.serialized()).size).toBe(1)
  })
})
