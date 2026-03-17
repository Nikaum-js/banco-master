/**
 * CARD 02 — "Restante da transferência de R$ 50 desaparece" (§9.1, D-061).
 *
 * Incidente relatado: o jogador caiu no Tesouro e sacou uma carta que cobra $50 de cada
 * adversário. Um adversário tinha $43. Entregou os $43 e os $7 restantes DESAPARECERAM —
 * não foram ao banco, não ficaram devidos, deixaram de existir.
 *
 * Este arquivo reproduz esse incidente e SÓ ele. Os relatos de perda de dinheiro fora da vez
 * (CARDs 04/05/09) têm causa raiz diferente — o Fiscal mudo — e vivem em
 * `tests/game/balancing/taxManNarracao.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { createSeedState, buildPorts } from '@/game/setup'
import { applyEffect } from '@/game/cards/effects'
import { payDebt, declareBankruptcy, debtorOf, isBankrupt } from '@/game/falencia/falencia'
import { promoteObligation, obligationTotalFor } from '@/game/economy/obligation'
import { applyCommand } from '@/game/commands'
import { ctxWith } from '../turn/_helpers'
import type { GameState } from '@/game/turn/types'

const ports = buildPorts()

// A mesa do incidente: p1 saca o Aniversário, p2 tem exatamente os $43 do relato.
function aniversarioComAdversarioCurto(cashP2 = 43): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.players[0].cash = 1_000
  g.players[1].cash = cashP2
  return g
}

describe('CARD 02 — obrigação a outro jogador não é truncada (§9.1/D-061)', () => {
  it('o incidente exato: adversário com $43 paga $43 e CONTINUA devendo $7', () => {
    const g = aniversarioComAdversarioCurto(43)
    applyEffect('aniversario', g, 'p1', ports)

    expect(g.players[1].cash).toBe(0) // entregou tudo o que tinha
    expect(g.players[0].cash).toBe(1_043) // o aniversariante recebeu o parcial
    // Antes da D-061 esta era a linha que falhava: os $7 sumiam e a fila ficava vazia.
    expect(obligationTotalFor(g, 'p2')).toBe(7)
  })

  it('a obrigação é do ADVERSÁRIO, não do jogador da vez — e ele não fica com caixa negativo', () => {
    const g = aniversarioComAdversarioCurto(43)
    applyEffect('aniversario', g, 'p1', ports)
    promoteObligation(g)

    expect(g.resolution).toEqual({ kind: 'debt', amount: 7, creditorId: 'p1', debtorId: 'p2', cause: 'obligation' })
    expect(debtorOf(g)).toBe('p2') // p1 é o jogador da vez; quem deve é p2
    expect(g.players[1].cash).toBe(0) // nunca negativo no estado (FR-004a segue valendo)
  })

  it('credor e devedor enxergam o valor pendente, e o fato está no log', () => {
    const g = aniversarioComAdversarioCurto(43)
    applyEffect('aniversario', g, 'p1', ports)

    // O que o devedor deve e o que o credor tem a receber são o MESMO número, lido do estado —
    // não duas contas paralelas que podem divergir.
    expect(obligationTotalFor(g, 'p2')).toBe(7)
    expect(g.obligations).toEqual([{ debtorId: 'p2', creditorId: 'p1', amount: 7, cause: 'obligation' }])
    expect(g.log).toEqual(expect.arrayContaining([
      { kind: 'card-collect', who: 'p2', name: 'Aniversario', delta: -43, due: 50, counterpartId: 'p1' },
      { kind: 'debt-open', who: 'p2', amount: 7, creditorId: 'p1', cause: 'obligation' },
    ]))
  })

  it('pagamento INTEGRAL não enfileira nada (o caso que já funcionava, protegido)', () => {
    const g = aniversarioComAdversarioCurto(500)
    applyEffect('aniversario', g, 'p1', ports)

    expect(g.players[1].cash).toBe(450)
    expect(g.players[0].cash).toBe(1_050)
    expect(g.obligations).toEqual([])
    expect(g.log.some((e) => e.kind === 'debt-open')).toBe(false)
  })

  it('o valor É pago quando o devedor levanta recursos', () => {
    const g = aniversarioComAdversarioCurto(43)
    applyEffect('aniversario', g, 'p1', ports)
    promoteObligation(g)

    g.players[1].cash = 7 // levantou (hipotecou/vendeu no tabuleiro)
    const after = payDebt(g)

    expect(after.players[1].cash).toBe(0)
    expect(after.players[0].cash).toBe(1_050) // 1000 + 43 + 7 = o valor CHEIO da carta
    expect(after.resolution).toBeNull()
    expect(after.log.at(-1)).toEqual({ kind: 'debt-paid', who: 'p2', amount: 7, creditorId: 'p1' })
  })

  it('quitar dívida de quem NÃO é o da vez não mexe no turno de quem está jogando', () => {
    const g = aniversarioComAdversarioCurto(43)
    g.turn.state = 'aguardando-finalizacao' // p1 no meio do turno dele
    applyEffect('aniversario', g, 'p1', ports)
    promoteObligation(g)
    g.players[1].cash = 7

    const after = payDebt(g)

    // `completeResolution` mandaria o turno para 'aguardando-finalizacao' e zeraria
    // `pendingResolve` — abortaria a jogada de p1, que não tem nada a ver com a dívida de p2.
    expect(after.turn.state).toBe('aguardando-finalizacao')
    expect(after.activeSeat).toBe(0)
  })

  it('falência funciona quando a dívida não pode ser resolvida, sem passar a vez de quem joga', () => {
    const g = aniversarioComAdversarioCurto(43)
    applyEffect('aniversario', g, 'p1', ports)
    promoteObligation(g)
    // p2 sem caixa e sem patrimônio: nem liquidando tudo cobre os $7 (§9.1).
    expect(isBankrupt(g, 'p2', 7)).toBe(true)

    const after = declareBankruptcy(g, ctxWith([3, 4]))

    expect(after.players[1].eliminated).toBe(true)
    expect(after.log.some((e) => e.kind === 'bankruptcy' && e.who === 'p2')).toBe(true)
    // Mesa de 2: sobra 1 → §9.5 encerra. E a vez nunca passou por causa da falência de p2.
    expect(after.phase).toBe('ended')
  })

  it('vários devedores curtos entram na FILA — o slot de decisão é um, as dívidas não', () => {
    const g = createSeedState(['p1', 'p2', 'p3', 'p4'])
    g.players[0].cash = 1_000
    g.players[1].cash = 10
    g.players[2].cash = 0
    g.players[3].cash = 50 // paga integral

    applyEffect('aniversario', g, 'p1', ports)

    expect(obligationTotalFor(g, 'p2')).toBe(40)
    expect(obligationTotalFor(g, 'p3')).toBe(50)
    expect(obligationTotalFor(g, 'p4')).toBe(0)
    expect(g.players[0].cash).toBe(1_060) // 10 + 0 + 50 recebidos à vista
  })

  it('a fila é promovida ao slot pelo despacho, uma por vez, sem perder nenhuma', () => {
    const g = createSeedState(['p1', 'p2', 'p3'])
    g.players[0].cash = 1_000
    g.players[1].cash = 10
    g.players[2].cash = 20
    g.turn.state = 'aguardando-finalizacao'
    applyEffect('aniversario', g, 'p1', ports)

    const ctx = ctxWith([3, 4], { ports })
    // Qualquer comando reavalia a fila (não há tabela de gatilho: qualquer um pode liberar o slot).
    let s = applyCommand(g, { kind: 'dismiss-notice' }, ctx)
    expect(s.resolution?.kind).toBe('debt')
    const first = debtorOf(s)!
    expect(['p2', 'p3']).toContain(first)

    s.players.find((p) => p.id === first)!.cash = 40
    s = applyCommand(s, { kind: 'pay-debt' }, ctx)

    // Quitada a primeira, a SEGUNDA sobe no mesmo despacho — a fila não fica presa.
    expect(s.resolution?.kind).toBe('debt')
    expect(debtorOf(s)).not.toBe(first)
  })

  it('obrigação do mesmo par se ACUMULA em vez de virar duas cobranças sequenciais', () => {
    const g = aniversarioComAdversarioCurto(43)
    applyEffect('aniversario', g, 'p1', ports) // deve 7
    applyEffect('aniversario', g, 'p1', ports) // deve 50 a mais (caixa já em 0)

    expect(g.obligations).toHaveLength(1)
    expect(obligationTotalFor(g, 'p2')).toBe(57)
  })

  it('obrigação de jogador eliminado sai da fila em vez de travar o slot para sempre', () => {
    const g = aniversarioComAdversarioCurto(43)
    applyEffect('aniversario', g, 'p1', ports)
    g.players[1].eliminated = true

    promoteObligation(g)

    expect(g.obligations).toEqual([])
    expect(g.resolution).toBeNull()
  })
})

describe('CARD 02 — o que CONTINUA truncando, por decisão explícita (§9.1/D-061)', () => {
  it('Honorários (credor = pote) trunca e não abre dívida', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].cash = 20
    applyEffect('honorarios', g, 'p1', ports)

    expect(g.players[0].cash).toBe(0)
    expect(g.obligations).toEqual([]) // pote não é parte lesada — ninguém foi privado de receita
    expect(g.centerPot).toBe(500 + 20)
  })

  it('Crise Imobiliária (credor = pote) trunca, mas o débito dos OUTROS deixa de ser mudo', () => {
    const g = createSeedState(['p1', 'p2'])
    g.players[0].cash = 1_000
    g.players[1].cash = 5
    // Patrimônio grande e caixa mínimo: é a única forma de a cobrança de 5% passar do caixa e
    // o truncamento ser realmente exercitado (com uma propriedade só, 5% dá menos que $5).
    for (const pos of [1, 3, 6, 8, 9, 11, 13, 14]) if (g.titles[pos]) g.titles[pos].ownerId = 'p2'
    applyEffect('criseImobiliaria', g, 'p1', ports)

    expect(g.players[1].cash).toBe(0)
    expect(g.obligations).toEqual([])
    expect(g.log.some((e) => e.kind === 'card-collect' && e.who === 'p2')).toBe(true)
  })
})
