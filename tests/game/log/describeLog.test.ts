import { describe, it, expect } from 'vitest'
import { describeLogEntry, type LogFragment } from '@/game/ui/log/describeLog'
import { ALL_LOG_KINDS, type LogEntry, type LogKind } from '@/game/economy/types'
import type { Room, Seat } from '@/net/room'

function sampleFor(kind: LogKind): LogEntry {
  switch (kind) {
    case 'roll': return { kind, who: 'p1', white: [3, 4], isDouble: false, special: null, speed: null, attempt: false }
    case 'go': return { kind, who: 'p1', amount: 200, landed: false }
    case 'buy': return { kind, who: 'p1', pos: 1, price: 60 }
    case 'rent': return { kind, who: 'p1', pos: 1, amount: 2, ownerId: 'p2' }
    case 'tax': return { kind, who: 'p1', amount: 200 }
    case 'bus-ticket-gain': return { kind, who: 'p1' }
    case 'card-draw': return { kind, who: 'p1', deck: 'acaso' }
    case 'card-immediate': return { kind, who: 'p1', deck: 'tesouro', name: 'Investidor Anjo', delta: 0 }
    case 'build': return { kind, who: 'p1', pos: 1, level: 1, cost: 100 }
    case 'build-hangar': return { kind, who: 'p1', pos: 9, cost: 100 }
    case 'sell-building': return { kind, who: 'p1', pos: 1, level: 0, amount: 50 }
    case 'sell-hangar': return { kind, who: 'p1', pos: 9, amount: 50 }
    case 'mortgage': return { kind, who: 'p1', pos: 1, amount: 30 }
    case 'unmortgage': return { kind, who: 'p1', pos: 1, cost: 33 }
    case 'auction-won': return { kind, who: 'bank', pos: 1, amount: 60, winnerId: 'p1' }
    case 'auction-unsold': return { kind, who: 'bank', pos: 1 }
    case 'lot-won': return { kind, who: 'bank', pos: 1, amount: 60, winnerId: 'p1', origin: 'bankruptcy' }
    case 'lot-unsold': return { kind, who: 'bank', pos: 1, origin: 'scarcity' }
    case 'free-parking': return { kind, who: 'p1', amount: 500 }
    case 'jail-fine': return { kind, who: 'p1', amount: 50 }
    case 'debt-paid': return { kind, who: 'p1', amount: 50, creditorId: 'p2' }
    case 'bankruptcy': return { kind, who: 'p1' }
    case 'concede': return { kind, who: 'p1' }
    case 'trade': return { kind, who: 'p1', toId: 'p2', fromDelta: -100, toDelta: 100 }
    case 'loan-interest': return { kind, who: 'p1', amount: 10, creditorId: 'p2' }
    case 'loan-interest-short': return { kind, who: 'p1', amount: 5, creditorId: 'p2', shortfall: 5 }
    case 'loan-due': return { kind, who: 'p1', amount: 110, creditorId: 'p2', principal: 100, interest: 10 }
    case 'loan-due-short': return { kind, who: 'p1', amount: 40, creditorId: 'p2', shortfall: 70 }
    case 'sell-to-bank': return { kind, who: 'p1', pos: 1, amount: 0 }
    case 'debt-open': return { kind, who: 'p1', amount: 7, creditorId: 'p2', cause: 'obligation' }
    case 'tax-man': return { kind, who: 'p1', pos: 1, amount: 200, due: 200 }
    case 'hostile-takeover': return { kind, who: 'p1', pos: 1, amount: 66, victimId: 'p2' }
    case 'audit': return { kind, who: 'p1', targetId: 'p2', amount: 120 }
    case 'evict': return { kind, who: 'p1', pos: 1, victimId: 'p2' }
    case 'card-collect': return { kind, who: 'p2', name: 'Aniversario', delta: -50, due: 50, counterpartId: 'p1' }
    case 'swap': return { kind, who: 'p1', posGiven: 1, posTaken: 3, victimId: 'p2' }
    case 'reaction-blocked': return { kind, who: 'p2', attackerId: 'p1', effect: 'aquisicaoHostil', reaction: 'diplomacia', targetPos: 1, targetPlayer: null }
    case 'legacy': return { kind, who: 'p1', what: 'evento antigo' }
  }
}

function seat(playerId: string, name: string, color: string): Seat {
  return { playerId, uid: `tok-${playerId}`, name, color, isHost: playerId === 'p1', connected: true, reentryCode: '' }
}

const ROOM: Room = {
  id: 'room-1',
  status: 'playing',
  seats: [seat('p1', 'Ana', '#ff0000'), seat('p2', 'Beto', '#00ff00')],
}

// "id de jogador" no texto: 'p' seguido de dígito, dentro ou fora de fragmento — é
// exatamente o padrão que SC-001 proíbe em qualquer estado da partida.
const PLAYER_ID_PATTERN = /\bp\d+\b/

function textOf(sentence: LogFragment[]): string {
  return sentence
    .map((f) => (f.t === 'text' ? f.text : f.t === 'player' ? f.identity.name : f.t === 'place' ? `#${f.pos}` : `$${f.amount}`))
    .join('')
}

describe('describeLogEntry — contrato do descritor (040, §2)', () => {
  it('SC-001: nenhum fragmento contém id de jogador, com sala', () => {
    for (const kind of ALL_LOG_KINDS) {
      const sentence = describeLogEntry(sampleFor(kind), ROOM)
      for (const f of sentence) {
        if (f.t === 'text') expect(f.text).not.toMatch(PLAYER_ID_PATTERN)
      }
      expect(textOf(sentence)).not.toMatch(PLAYER_ID_PATTERN)
    }
  })

  it('SC-001: nenhum fragmento contém id de jogador, sem sala (room: null)', () => {
    for (const kind of ALL_LOG_KINDS) {
      const sentence = describeLogEntry(sampleFor(kind), null)
      expect(textOf(sentence)).not.toMatch(PLAYER_ID_PATTERN)
    }
  })

  // 058/US2 — a frase precisa nomear os quatro elementos, senao o log volta a nao explicar
  // por que a carta do atacante "nao fez efeito".
  it('058: a reacao anulada nomeia reator, reacao, ofensiva, atacante e alvo', () => {
    const comPropriedade = textOf(describeLogEntry(sampleFor('reaction-blocked'), ROOM))
    expect(comPropriedade).toContain('Beto')      // reator
    expect(comPropriedade).toContain('Diplomacia')
    expect(comPropriedade).toContain('anulou')
    expect(comPropriedade).toContain('Aquisição Hostil')
    expect(comPropriedade).toContain('Ana')       // atacante
    expect(comPropriedade).toContain('#1')        // propriedade alvo

    // Ofensiva que mira GENTE (Imposto Federal, Embargo): nomeia o jogador, sem inventar casa.
    const comJogador = textOf(describeLogEntry(
      { kind: 'reaction-blocked', who: 'p2', attackerId: 'p1', effect: 'impostoFederal', reaction: 'diplomacia', targetPos: null, targetPlayer: 'p2' },
      ROOM,
    ))
    expect(comJogador).toContain('Imposto Federal')
    expect(comJogador).not.toMatch(/#\d+/)

    // Sem alvo nenhum: a frase para no atacante, sem " contra " orfao.
    const semAlvo = textOf(describeLogEntry(
      { kind: 'reaction-blocked', who: 'p2', attackerId: 'p1', effect: 'boicote', reaction: 'diplomacia', targetPos: null, targetPlayer: null },
      ROOM,
    ))
    expect(semAlvo).not.toContain('contra')
  })

  it('FR-017: sem sala, jogador cai no fallback "Jogador N"', () => {
    const sentence = describeLogEntry(sampleFor('tax'), null)
    const playerFrag = sentence.find((f) => f.t === 'player')
    expect(playerFrag).toMatchObject({ t: 'player', identity: { name: 'Jogador 1' } })
  })

  it('com sala, resolve o nome do assento', () => {
    const sentence = describeLogEntry(sampleFor('tax'), ROOM)
    const playerFrag = sentence.find((f) => f.t === 'player')
    expect(playerFrag).toMatchObject({ t: 'player', identity: { name: 'Ana', color: '#ff0000' } })
  })

  it("'bank' produz texto \"Banco\", nunca fragmento de jogador", () => {
    const sentence = describeLogEntry(sampleFor('auction-won'), ROOM)
    expect(sentence.some((f) => f.t === 'player' && f.identity.playerId === 'bank')).toBe(false)
    expect(sentence.some((f) => f.t === 'text' && f.text.includes('Banco'))).toBe(false) // 'auction-won' não menciona 'who' na frase
    // bank aparece como autor implícito de 'auction-unsold', que SÓ tem texto de leilão + place
    const unsold = describeLogEntry({ kind: 'auction-unsold', who: 'bank', pos: 1 }, ROOM)
    expect(unsold.some((f) => f.t === 'player')).toBe(false)
  })

  it("kind 'legacy' produz texto solto, sem resolução de identidade nem ícone", () => {
    const sentence = describeLogEntry({ kind: 'legacy', who: 'p1', what: 'comprou Roma por $60' }, ROOM)
    expect(sentence).toEqual([{ t: 'text', text: 'comprou Roma por $60' }])
  })

  it('jogador que saiu da sala cai no fallback em vez de expor id', () => {
    const soleSeatRoom: Room = { id: 'r2', status: 'playing', seats: [seat('p1', 'Ana', '#ff0000')] }
    const sentence = describeLogEntry({ kind: 'tax', who: 'p2', amount: 10 }, soleSeatRoom) // p2 nunca teve assento
    const playerFrag = sentence.find((f) => f.t === 'player')
    expect(playerFrag).toMatchObject({ t: 'player', identity: { name: 'Jogador 2' } })
  })

  it('jogador eliminado ainda resolve nome pela sala (describeLogEntry não sabe de eliminação)', () => {
    // Eliminação é campo de GameState.players, não da Room — describeLogEntry só recebe
    // Room, então o nome resolve igual esteja o jogador eliminado ou não.
    const sentence = describeLogEntry({ kind: 'bankruptcy', who: 'p2' }, ROOM)
    const playerFrag = sentence.find((f) => f.t === 'player')
    expect(playerFrag).toMatchObject({ t: 'player', identity: { name: 'Beto' } })
  })

  it('valores monetários chegam como fragmento `money`, pronto para a fonte única (FR-020)', () => {
    const sentence = describeLogEntry({ kind: 'tax', who: 'p1', amount: 200 }, ROOM)
    expect(sentence.some((f) => f.t === 'money' && f.amount === 200)).toBe(true)
  })

  it('Boom Econômico explica que o crédito de $200 vale para todos ainda na partida', () => {
    const sentence = describeLogEntry({
      kind: 'card-immediate',
      who: 'p2',
      deck: 'tesouro',
      name: 'Boom Economico',
      delta: 200,
    }, ROOM)

    expect(textOf(sentence)).toBe('Beto: Boom econômico: todos que ainda estão na partida receberam $200')
  })

  it('Aniversário informa os mesmos R$ 50 por adversário definidos no SRS', () => {
    const sentence = describeLogEntry({
      kind: 'card-immediate',
      who: 'p1',
      deck: 'tesouro',
      name: 'Aniversario',
      delta: 50,
    }, ROOM)

    expect(textOf(sentence)).toBe('Ana: recebeu $50 de aniversário (cada adversário paga $50)')
  })
})
