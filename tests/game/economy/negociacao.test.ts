import { describe, it, expect } from 'vitest'
import { executeTrade, validateTrade, proposeTrade, acceptTrade } from '@/game/economy/trade'
import type { Trade } from '@/game/economy/types'
import { transferKeepFee } from '@/game/economy/mortgage'
import { createSeedState } from '@/game/setup'
import type { GameState } from '@/game/turn/types'
import { BOARD } from '@/lib/boardData'
import { pausedBy } from '../../net/harness'
import { THEME } from '@/game/theme'

// Caixa inicial vem do THEME: um literal aqui trava o balanceamento no teste (D-076).
const CASH0 = THEME.INITIAL_CASH

const AIRPORT = BOARD.find((s) => s.kind === 'airport')!.pos

// p1 dono da pos 1 (Roma), p2 dono da pos 3 (Veneza).
function twoOwners(): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.titles[1].ownerId = 'p1'
  g.titles[3].ownerId = 'p2'
  return g
}

describe('Negociação — troca (US1)', () => {
  it('SC-001: troca propriedades + caixa entre dois jogadores', () => {
    const g = twoOwners()
    const out = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 100, toProps: [3], toCash: 0 })
    expect(out.titles[1].ownerId).toBe('p2')
    expect(out.titles[3].ownerId).toBe('p1')
    expect(out.players[0].cash).toBe(CASH0 - 100)
    expect(out.players[1].cash).toBe(CASH0 + 100)
  })

  // §8.5 (D-058) mantém proibido o "presente" que esta spec permitia: entregar e não receber
  // nada é doação pura. A troca válida abaixo guarda o resto do que o caso original provava.
  it('SC-001/§8.5: oferta unilateral é recusada; com contrapartida passa e não toca mão/Bus Tickets', () => {
    const g = twoOwners()
    expect(executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 50, toProps: [], toCash: 0 })).toBe(g)

    const out = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 30 })
    expect(out.titles[1].ownerId).toBe('p2')
    expect(out.players[0].cash).toBe(CASH0 + 30)
    expect(out.players[1].cash).toBe(CASH0 - 30)
    expect(out.players[0].hand).toEqual(g.players[0].hand) // cartas não mudam (SC-005)
    expect(out.players[0].busTickets).toBe(g.players[0].busTickets)
  })

  it('SC-006: troca fora do turno do proponente é processada', () => {
    const g = createSeedState(['p1', 'p2', 'p3']) // ativo = p1
    g.titles[5].ownerId = 'p2'
    const out = executeTrade(g, { fromId: 'p2', toId: 'p3', fromProps: [5], fromCash: 0, toProps: [], toCash: 200 })
    expect(out.titles[5].ownerId).toBe('p3')
    expect(out.players[1].cash).toBe(CASH0 + 200) // p2 recebe
    expect(out.players[2].cash).toBe(CASH0 - 200) // p3 paga
    expect(out.activeSeat).toBe(0) // turno não muda
  })

  it('SC-002: rejeições deixam o estado inalterado (atômico)', () => {
    const g = twoOwners()
    expect(executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [3], fromCash: 0, toProps: [], toCash: 0 })).toBe(g) // p1 não possui pos 3
    expect(executeTrade(g, { fromId: 'p1', toId: 'p1', fromProps: [1], fromCash: 0, toProps: [], toCash: 0 })).toBe(g) // mesmo jogador
    const semCaixa = twoOwners()
    semCaixa.players[0].cash = 50
    expect(executeTrade(semCaixa, { fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 100, toProps: [], toCash: 0 })).toBe(semCaixa) // oferece mais do que tem
    const elim = twoOwners()
    elim.players[1].eliminated = true
    expect(executeTrade(elim, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 0 })).toBe(elim)
    const pausado = { ...twoOwners(), paused: pausedBy('disconnect') }
    expect(executeTrade(pausado, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 0 })).toBe(pausado)
  })

  it('SC-002: cidade com construção bloqueia a troca daquela propriedade', () => {
    const g = twoOwners()
    g.titles[1].houses = 1 // Roma com 1 casa
    expect(executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 0 })).toBe(g)
  })
})

describe('Negociação — hipoteca e Hangar (US2)', () => {
  it('SC-003: hipotecada trocada chega hipotecada e cobra 10% do recebedor', () => {
    const g = twoOwners()
    g.titles[3].mortgaged = true // Veneza (price 80) hipotecada, de p2
    const fee = transferKeepFee(BOARD[3]) // round((80/2)*0.1) = 4
    // Os $20 de contrapartida tiram a proposta do caso "doação pura" (§8.5).
    const out = executeTrade(g, { fromId: 'p2', toId: 'p1', fromProps: [3], fromCash: 0, toProps: [], toCash: 20 })
    expect(out.titles[3].ownerId).toBe('p1')
    expect(out.titles[3].mortgaged).toBe(true) // continua hipotecada
    expect(out.players[0].cash).toBe(CASH0 - fee - 20) // p1 (recebedor) paga a taxa
    expect(out.players[1].cash).toBe(CASH0 + 20) // p2 não paga taxa
  })

  it('SC-003: recebedor sem caixa para a taxa → no-op', () => {
    const g = twoOwners()
    g.titles[3].mortgaged = true
    g.players[0].cash = 2 // < fee 4
    expect(executeTrade(g, { fromId: 'p2', toId: 'p1', fromProps: [3], fromCash: 0, toProps: [], toCash: 0 })).toBe(g)
  })

  it('SC-004: aeroporto com Hangar trocado mantém o Hangar no novo dono', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[AIRPORT].ownerId = 'p1'
    g.titles[AIRPORT].hangar = true
    const out = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [AIRPORT], fromCash: 0, toProps: [], toCash: 100 }) // contrapartida real (§8.5: não é doação)
    expect(out.titles[AIRPORT].ownerId).toBe('p2')
    expect(out.titles[AIRPORT].hangar).toBe(true)
  })
})

describe('Negociação durante dívida pendente (§9.1 — proteção do credor)', () => {
  // p1 (ativo) deve 150; caixa 200 + Roma (hipoteca $30) → liquidationValue 230: solvente.
  function debtorState(): GameState {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p1'
    g.players[0].cash = 200
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'debt', amount: 150, creditorId: 'p2' }
    return g
  }

  it('bloqueia doação de ativos que tornaria o devedor incapaz de pagar (asset dumping)', () => {
    const g = debtorState()
    // p1 doa Roma + $100: sobraria caixa 100 < dívida 150 → o credor da dívida seria lesado.
    const dump = { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 100, toProps: [], toCash: 0 }
    expect(executeTrade(g, dump)).toBe(g) // inválida → no-op
  })

  it('permite troca que LEVANTA caixa (venda legítima para quitar a dívida)', () => {
    const g = debtorState()
    const rescue = { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 100 }
    const out = executeTrade(g, rescue)
    expect(out.titles[1].ownerId).toBe('p2')
    expect(out.players[0].cash).toBe(300) // 200 + 100 — agora cobre a dívida com folga
  })

  it('troca entre TERCEIROS segue livre durante a dívida do jogador ativo', () => {
    const g = createSeedState(['p1', 'p2', 'p3']) // ativo = p1 (devedor)
    g.resolution = { kind: 'debt', amount: 500, creditorId: null }
    g.titles[3].ownerId = 'p2'
    const out = executeTrade(g, { fromId: 'p2', toId: 'p3', fromProps: [3], fromCash: 0, toProps: [], toCash: 50 })
    expect(out.titles[3].ownerId).toBe('p3') // não envolve o devedor → não bloqueia
  })
})

// Bus Tickets negociáveis (D-028, SRS §8.2/§10.7 v1.4) — contadores trocam de
// mão sem taxa; validade exige posse suficiente de cada lado.
describe('Negociação — Bus Tickets (D-028)', () => {
  it('transfere tickets junto com propriedades/caixa', () => {
    const g = twoOwners()
    g.players[0].busTickets = 3
    g.players[1].busTickets = 1
    // p1 entrega Roma ($60) + 2 tickets ($200) = $260 → precisa receber ao menos $130;
    // recebe 1 ticket ($100) + $30 em caixa (§8.5).
    const out = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 30, fromBusTickets: 2, toBusTickets: 1 })
    expect(out.titles[1].ownerId).toBe('p2')
    expect(out.players[0].busTickets).toBe(2) // 3 − 2 + 1
    expect(out.players[1].busTickets).toBe(2) // 1 − 1 + 2
  })

  it('troca só de tickets por caixa é válida (proposta não-vazia)', () => {
    const g = twoOwners()
    g.players[0].busTickets = 1
    const out = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 50, fromBusTickets: 1 })
    expect(out.players[0].busTickets).toBe(0)
    expect(out.players[1].busTickets).toBe(1)
    expect(out.players[0].cash).toBe(CASH0 + 50) // recebeu os 50 de p2
  })

  it('rejeita tickets além da posse ou valores inválidos (atômico)', () => {
    const g = twoOwners()
    g.players[0].busTickets = 1
    expect(executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 0, fromBusTickets: 2 })).toBe(g) // só tem 1
    expect(executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 0, fromBusTickets: -1 })).toBe(g)
    expect(executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 0, fromBusTickets: 1.5 })).toBe(g)
    expect(executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 0, toBusTickets: 1 })).toBe(g) // p2 não tem ticket
  })

  it('payload sem os campos (trades antigas) segue funcionando — tickets intactos', () => {
    const g = twoOwners()
    g.players[0].busTickets = 2
    const out = executeTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: 30 })
    expect(out.titles[1].ownerId).toBe('p2') // a troca aconteceu de verdade
    expect(out.players[0].busTickets).toBe(2)
    expect(out.players[1].busTickets).toBe(0)
  })
})

// Trava de esvaziamento (§8.5, D-058 — substitui o piso proporcional da D-055): troca é
// livre em qualquer proporção; só doação pura e a troca que reduz o patrimônio a menos de
// um terço são recusadas.
describe('Negociação — trava de esvaziamento (§8.5)', () => {
  // p1 dono de Roma, Veneza, Pisa e JFK — os títulos, mais o caixa inicial. Os VALORES saem do
  // tabuleiro e do THEME: a trava é sobre a FRAÇÃO do patrimônio que sobra (um terço), então
  // fixar cifras aqui prende a regra ao balanceamento de preços (D-076 mexeu no JFK).
  function rich(): GameState {
    const g = createSeedState(['p1', 'p2', 'p3'])
    for (const pos of [1, 3, 5, AIRPORT]) g.titles[pos].ownerId = 'p1'
    return g
  }
  // O mesmo tabuleiro com o caixa zerado: os títulos são TODO o patrimônio de p1.
  function broke(): GameState {
    const g = rich()
    g.players[0].cash = 0
    return g
  }
  const TITULOS = [1, 3, 5, AIRPORT].reduce((sum, pos) => sum + (BOARD[pos] as { price: number }).price, 0)
  const terco = (patrimonio: number) => Math.ceil(patrimonio / 3)
  const dump = (over: Partial<Trade> = {}): Trade => ({
    fromId: 'p1', toId: 'p2', fromProps: [1, 3, 5, AIRPORT], fromCash: 0, toProps: [], toCash: 0, ...over,
  })

  it('FR-013: doar o patrimônio sem contrapartida é recusado', () => {
    const g = rich()
    expect(validateTrade(g, dump())).toBe(false)
    expect(executeTrade(g, dump())).toBe(g)
    expect(proposeTrade(g, dump())).toBe(g) // nem enviar
  })

  it('FR-013: doar junto com o próprio caixa também é recusado', () => {
    const g = rich()
    expect(validateTrade(g, dump({ fromCash: 500 }))).toBe(false)
  })

  it('D-058: troca desequilibrada é livre quando não esvazia — 4 títulos por $1 com caixa cheio', () => {
    const g = rich() // p1 fica com o caixa quase inteiro de um patrimônio de caixa + títulos
    expect(validateTrade(g, dump({ toCash: 1 }))).toBe(true)
  })

  it('D-058: quem entrega quase tudo precisa ficar com ao menos um terço', () => {
    const g = broke() // patrimônio = só os títulos → piso = um terço deles
    const piso = terco(TITULOS)
    expect(validateTrade(g, dump({ toCash: 1 }))).toBe(false)
    expect(validateTrade(g, dump({ toCash: piso - 1 }))).toBe(false)
    expect(validateTrade(g, dump({ toCash: piso }))).toBe(true)
  })

  it('D-058: o esvaziamento conta o caixa que sai junto', () => {
    const g = rich() // entrega os títulos E o caixa inteiro → sobraria $1
    expect(validateTrade(g, dump({ fromCash: CASH0, toCash: 1 }))).toBe(false)
  })

  it('FR-015: pagar caro em dinheiro continua livre — até o ponto em que o pagamento esvazia', () => {
    const g = rich()
    const roma = (BOARD[1] as { price: number }).price
    // p2 paga um terço do caixa por Roma: sobra bem acima do piso — livre.
    expect(validateTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: Math.floor(CASH0 / 3) })).toBe(true)
    // Pagar até sobrar MENOS que um terço do que teria é o despejo de caixa com folha de figueira.
    const espremido = CASH0 + roma - terco(CASH0) + 1 // piso é ⌈patrimônio ANTES / 3⌉
    expect(validateTrade(g, { fromId: 'p1', toId: 'p2', fromProps: [1], fromCash: 0, toProps: [], toCash: espremido })).toBe(false)
    // ...e entregar sem receber NADA nunca é troca, nem quando o que sai é só dinheiro
    const meio = Math.floor(CASH0 / 2)
    expect(validateTrade(g, { fromId: 'p2', toId: 'p1', fromProps: [], fromCash: meio, toProps: [], toCash: 0 })).toBe(false)
    expect(validateTrade(g, { fromId: 'p2', toId: 'p1', fromProps: [], fromCash: meio, toProps: [1], toCash: 0 })).toBe(true) // recebeu Roma
  })

  it('FR-014: hipotecada vale metade também no patrimônio', () => {
    const g = broke()
    g.titles[AIRPORT].mortgaged = true // hipotecada entra pela METADE no patrimônio
    const aeroporto = (BOARD[AIRPORT] as { price: number }).price
    const piso = terco(TITULOS - Math.round(aeroporto * THEME.MORTGAGE_RATIO))
    expect(validateTrade(g, dump({ toCash: piso - 1 }))).toBe(false)
    expect(validateTrade(g, dump({ toCash: piso }))).toBe(true)
  })

  it('D-058: conceder imunidades sem pedir nada é válido — imunidade não é patrimônio', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[1].ownerId = 'p1'
    g.titles[3].ownerId = 'p1'
    const trade: Trade = {
      fromId: 'p1', toId: 'p2', fromProps: [], fromCash: 0, toProps: [], toCash: 0,
      fromImmunities: [{ pos: 1, laps: 5 }, { pos: 3, laps: null }],
    }
    expect(validateTrade(g, trade)).toBe(true)
  })

  it('D-058: imunidade não é contrapartida para quem entrega o último ativo', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[44].ownerId = 'p1' // Paris ($430)
    g.players[0].cash = 0 // Paris é TODO o patrimônio de p1
    g.titles[1].ownerId = 'p2'
    expect(validateTrade(g, {
      fromId: 'p1', toId: 'p2', fromProps: [44], fromCash: 0, toProps: [], toCash: 0,
      toImmunities: [{ pos: 1, laps: null }],
    })).toBe(false) // imunidade evapora com quem sai (§9.4) — não paga um abandono
  })

  it('§8.4: propriedade por imunidade segue válida para quem mantém patrimônio', () => {
    const g = createSeedState(['p1', 'p2'])
    g.titles[44].ownerId = 'p1' // Paris ($430) — mas p1 mantém os $2.000 em caixa
    for (const pos of [37, 38, 40]) g.titles[pos].ownerId = 'p2'
    expect(validateTrade(g, {
      fromId: 'p1', toId: 'p2', fromProps: [44], fromCash: 0, toProps: [], toCash: 0,
      toImmunities: [37, 38, 40].map((pos) => ({ pos, laps: 3 })),
    })).toBe(true)
  })

  it('FR-016: proposta válida que passa a esvaziar antes da aceitação não é processada', () => {
    const g = rich()
    const s = proposeTrade(g, dump({ toCash: 1 })) // válida: p1 mantém os $2.000 em caixa
    expect(s.tradeProposals).toHaveLength(1)
    s.players[0].cash = 0 // o caixa foi embora — agora a mesma troca esvazia p1
    const after = acceptTrade(s, s.tradeProposals[0].id)
    expect(after).toBe(s) // no-op — permanece disponível para recusa
    expect(after.tradeProposals).toHaveLength(1)
  })

  it('FR-018: a trava soma-se à proteção de credor, sem substituí-la', () => {
    const g = broke()
    g.turn.state = 'casa-a-resolver'
    g.turn.pendingResolve = true
    g.resolution = { kind: 'debt', amount: 400, creditorId: 'p3' } // p1 é o devedor ativo
    // $200 por $440 em ativos passa na trava (p1 ficaria com $200 ≥ ⌈440/3⌉ = $147),
    // mas o deixaria incapaz de cobrir a dívida (§9.1).
    expect(validateTrade(g, dump({ toCash: 200 }))).toBe(false)
  })
})
