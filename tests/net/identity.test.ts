// Identidade de exibição (spec 038, US2). O que se prova aqui:
//   • nome/cor/avatar/skin vêm da SALA e nunca do GameState (D-019 — a fronteira é testada);
//   • nomes duplicados continuam permitidos e distinguíveis pela cor (FR-011);
//   • sem sala há fallback exibível, então `p1..p8` não vaza para a UI em modo algum (FR-009).
//
// D-047: avatar e skin são públicos e repetíveis; a cor segue como distinção única obrigatória.
import { describe, expect, it } from 'vitest'
import { fallbackIdentity, identityOf } from '@/net/identity'
import { createRoom, joinRoom, MAX_SEATS, SEAT_COLORS, type Room } from '@/net/room'
import { createSeedState } from '@/game/setup'

function salaCom(nomes: { nome: string; cor: string }[]): Room {
  let room = createRoom('r1', { uid: 'tok-0', name: nomes[0].nome, color: nomes[0].cor })
  for (const [i, n] of nomes.slice(1).entries()) {
    const r = joinRoom(room, { uid: `tok-${i + 1}`, name: n.nome, color: n.cor })
    if (!r.ok) throw new Error(r.reason)
    room = r.room
  }
  return room
}

describe('identidade a partir da sala', () => {
  it('usa nome e cor escolhidos no lobby', () => {
    const room = salaCom([
      { nome: 'Nik', cor: SEAT_COLORS[0] },
      { nome: 'Ana', cor: SEAT_COLORS[1] },
    ])

    expect(identityOf(room, 'p1')).toMatchObject({ name: 'Nik', color: SEAT_COLORS[0] })
    expect(identityOf(room, 'p2')).toMatchObject({ name: 'Ana', color: SEAT_COLORS[1] })
  })

  it('projeta avatar e skin do assento e aplica fallbacks para sala legada', () => {
    const room = createRoom('r1', {
      uid: 'tok-0',
      name: 'Nik',
      color: SEAT_COLORS[0],
      avatar: 'prism-face',
      skin: 'astronauta',
    })
    expect(identityOf(room, 'p1').avatar).toBe('prism-face')
    expect(identityOf(room, 'p1').skin).toBe('astronauta')
    const legacy = identityOf({
      ...room,
      seats: [{ ...room.seats[0], avatar: undefined, skin: undefined }],
    }, 'p1')
    expect(legacy.avatar).toBe('classic-alive')
    expect(legacy.skin).toBe('careca')
  })

  it('nomes duplicados são permitidos e seguem distinguíveis pela cor (FR-011)', () => {
    const room = salaCom([
      { nome: 'Ana', cor: SEAT_COLORS[0] },
      { nome: 'Ana', cor: SEAT_COLORS[1] },
    ])
    const a = identityOf(room, 'p1')
    const b = identityOf(room, 'p2')

    expect(a.name).toBe(b.name)
    expect(a.color).not.toBe(b.color)
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
  it('todo assento tem nome e cor exibíveis', () => {
    for (let i = 1; i <= MAX_SEATS; i++) {
      const id = fallbackIdentity(`p${i}`)
      expect(id.name).toBe(`Jogador ${i}`)
      expect(id.color).toBeTruthy()
      expect(id.avatar).toBe('classic-alive')
      expect(id.skin).toBe('careca')
    }
  })

  it('nenhum rótulo exibível contém o id técnico do assento', () => {
    for (let i = 1; i <= MAX_SEATS; i++) {
      expect(identityOf(null, `p${i}`).name).not.toMatch(/^p\d+$/)
    }
  })

  it('as cores do fallback não se repetem entre os 8 assentos', () => {
    const ids = Array.from({ length: MAX_SEATS }, (_, i) => fallbackIdentity(`p${i + 1}`))
    expect(new Set(ids.map((i) => i.color)).size).toBe(MAX_SEATS)
  })
})

describe('fronteira com o GameState (D-019)', () => {
  it('o estado de jogo serializado não carrega nome, cor nem uid', () => {
    const room = salaCom([
      { nome: 'Nikolas', cor: SEAT_COLORS[0] },
      { nome: 'Ana', cor: SEAT_COLORS[1] },
    ])
    const game = createSeedState(room.seats.map((s) => s.playerId))
    const json = JSON.stringify(game)

    for (const seat of room.seats) {
      expect(json).not.toContain(seat.name)
      expect(json).not.toContain(seat.uid)
      expect(json).not.toContain(seat.color)
    }
    // O que o jogo conhece são apenas os ids posicionais.
    expect(game.players.map((p) => p.id)).toEqual(['p1', 'p2'])
  })
})
