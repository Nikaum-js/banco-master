// Identidade de exibição (spec 038, US2). O que se prova aqui:
//   • nome/cor/peça vêm da SALA e nunca do GameState (D-019 — a fronteira é testada);
//   • nomes duplicados continuam permitidos e distinguíveis por cor e peça (FR-011);
//   • sem sala há fallback exibível, então `p1..p8` não vaza para a UI em modo algum (FR-009);
//   • a peça é única por sala e o catálogo cobre os 8 assentos (FR-022/023).
import { describe, expect, it } from 'vitest'
import { availablePieces, fallbackIdentity, identityOf, PIECES } from '@/net/identity'
import { createRoom, joinRoom, MAX_SEATS, SEAT_COLORS, type Room } from '@/net/room'
import { createSeedState } from '@/game/setup'

function salaCom(nomes: { nome: string; cor: string; peca?: string }[]): Room {
  let room = createRoom('r1', { token: 'tok-0', name: nomes[0].nome, color: nomes[0].cor, piece: nomes[0].peca })
  for (const [i, n] of nomes.slice(1).entries()) {
    const r = joinRoom(room, { token: `tok-${i + 1}`, name: n.nome, color: n.cor, piece: n.peca })
    if (!r.ok) throw new Error(r.reason)
    room = r.room
  }
  return room
}

describe('identidade a partir da sala', () => {
  it('usa nome, cor e peça escolhidos no lobby', () => {
    const room = salaCom([
      { nome: 'Nik', cor: SEAT_COLORS[0], peca: 'aviao' },
      { nome: 'Ana', cor: SEAT_COLORS[1], peca: 'navio' },
    ])

    expect(identityOf(room, 'p1')).toMatchObject({ name: 'Nik', color: SEAT_COLORS[0], piece: 'aviao' })
    expect(identityOf(room, 'p2')).toMatchObject({ name: 'Ana', color: SEAT_COLORS[1], piece: 'navio' })
  })

  it('nomes duplicados são permitidos e seguem distinguíveis por cor e peça (FR-011)', () => {
    const room = salaCom([
      { nome: 'Ana', cor: SEAT_COLORS[0], peca: 'aviao' },
      { nome: 'Ana', cor: SEAT_COLORS[1], peca: 'navio' },
    ])
    const a = identityOf(room, 'p1')
    const b = identityOf(room, 'p2')

    expect(a.name).toBe(b.name)
    expect(a.color).not.toBe(b.color)
    expect(a.piece).not.toBe(b.piece)
  })

  it('nome em branco cai no rótulo padrão em vez de renderizar vazio (FR-012)', () => {
    const room = salaCom([{ nome: '   ', cor: SEAT_COLORS[0] }])
    expect(identityOf(room, 'p1').name.trim()).not.toBe('')
  })

  it('assento ainda não publicado usa o fallback (sala carregando)', () => {
    const room = salaCom([{ nome: 'Nik', cor: SEAT_COLORS[0] }])
    expect(identityOf(room, 'p5').name).toBe('Jogador 5')
  })
})

describe('fallback sem sala (cliente único) — FR-009/FR-029', () => {
  it('todo assento tem nome, cor e peça exibíveis', () => {
    for (let i = 1; i <= MAX_SEATS; i++) {
      const id = fallbackIdentity(`p${i}`)
      expect(id.name).toBe(`Jogador ${i}`)
      expect(id.color).toBeTruthy()
      expect(id.piece).toBeTruthy()
    }
  })

  it('nenhum rótulo exibível contém o id técnico do assento', () => {
    for (let i = 1; i <= MAX_SEATS; i++) {
      expect(identityOf(null, `p${i}`).name).not.toMatch(/^p\d+$/)
    }
  })

  it('cores e peças do fallback não se repetem entre os 8 assentos', () => {
    const ids = Array.from({ length: MAX_SEATS }, (_, i) => fallbackIdentity(`p${i + 1}`))
    expect(new Set(ids.map((i) => i.color)).size).toBe(MAX_SEATS)
    expect(new Set(ids.map((i) => i.piece)).size).toBe(MAX_SEATS)
  })
})

describe('peças (§12.5 / FR-022/023)', () => {
  it('o catálogo cobre a sala cheia', () => {
    expect(PIECES.length).toBeGreaterThanOrEqual(MAX_SEATS)
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length)
  })

  it('peça já ocupada some das opções', () => {
    const room = salaCom([{ nome: 'Nik', cor: SEAT_COLORS[0], peca: 'aviao' }])
    expect(availablePieces(room)).not.toContain('aviao')
    expect(availablePieces(room)).toContain('navio')
  })

  it('pedir uma peça já tomada é recusado', () => {
    const room = salaCom([{ nome: 'Nik', cor: SEAT_COLORS[0], peca: 'aviao' }])
    const r = joinRoom(room, { token: 'tok-x', name: 'Ana', color: SEAT_COLORS[1], piece: 'aviao' })
    expect(r).toEqual({ ok: false, reason: 'piece-taken' })
  })
})

describe('fronteira com o GameState (D-019)', () => {
  it('o estado de jogo serializado não carrega nome, cor, peça nem token', () => {
    const room = salaCom([
      { nome: 'Nikolas', cor: SEAT_COLORS[0], peca: 'aviao' },
      { nome: 'Ana', cor: SEAT_COLORS[1], peca: 'navio' },
    ])
    const game = createSeedState(room.seats.map((s) => s.playerId))
    const json = JSON.stringify(game)

    for (const seat of room.seats) {
      expect(json).not.toContain(seat.name)
      expect(json).not.toContain(seat.token)
      expect(json).not.toContain(seat.piece!)
    }
    // O que o jogo conhece são apenas os ids posicionais.
    expect(game.players.map((p) => p.id)).toEqual(['p1', 'p2'])
  })
})
