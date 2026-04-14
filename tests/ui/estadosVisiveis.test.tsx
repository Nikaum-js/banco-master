// @vitest-environment jsdom
// 058/US4 e US5 — imunidades com escopo e efeitos ativos com alvo.
//
// Antes: `immune?: boolean` na linha do jogador com `title="Imunidade ativa"`, e efeitos em
// prosa fixa ("Alvo sem construir", sem nomear o alvo — porque a função nem recebia a sala).
// Os dois relatos são o mesmo defeito: a interface tinha o estado e mostrava um rótulo.
import { act } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PlayersPanel } from '@/boards/shared'
import { createSeedState } from '@/game/setup'
import { useGameStore } from '@/game/store'
import { immunitiesOf, immunityDurationLabel } from '@/game/ui/panels/immunityView'
import { effectsView } from '@/game/ui/panels/effectsView'
import type { Room } from '@/net/room'
import { useRoomStore } from '@/net/roomStore'

afterEach(() => {
  cleanup()
  useRoomStore.getState().reset()
})

const SALA: Room = {
  id: 'estados',
  status: 'playing',
  seats: [
    { playerId: 'p1', uid: 'u1', name: 'Ana', color: '#3b8bd0', isHost: true, connected: true, reentryCode: 'A1' },
    { playerId: 'p2', uid: 'u2', name: 'Pedro', color: '#b665a2', isHost: false, connected: true, reentryCode: 'P2' },
  ],
}

describe('escopo das imunidades (058/US4)', () => {
  it('separa imunidade POR PROPRIEDADE de imunidade TOTAL', () => {
    const game = createSeedState(['p1', 'p2'])
    game.immunities = [{ beneficiaryId: 'p2', granterId: 'p1', pos: 1, lapsRemaining: 3 }]
    game.tempEffects = [{ kind: 'imunidade-total', ownerId: 'p2', pos: null, lapsRemaining: 1 }]

    const view = immunitiesOf(game, 'p2', SALA)
    expect(view.count).toBe(2)
    expect(view.hasTotal).toBe(true)
    expect(view.propertyCount).toBe(1)

    const porPropriedade = view.rows.find((r) => r.scope === 'propriedade')!
    if (porPropriedade.scope !== 'propriedade') throw new Error('escopo errado')
    expect(porPropriedade.beneficiary.name).toBe('Pedro')
    expect(porPropriedade.granter?.name).toBe('Ana')
    expect(porPropriedade.pos).toBe(1)
  })

  it('permanente é um ESTADO, nunca "0 voltas" nem prazo em branco', () => {
    expect(immunityDurationLabel(null)).toBe('Permanente')
    expect(immunityDurationLabel(1)).toBe('resta 1 volta')
    expect(immunityDurationLabel(3)).toBe('restam 3 voltas')
  })

  it('omite o concedente quando a regra não registrou vínculo', () => {
    const game = createSeedState(['p1', 'p2'])
    game.immunities = [{ beneficiaryId: 'p2', pos: 1, lapsRemaining: null }]
    const row = immunitiesOf(game, 'p2', SALA).rows[0]
    if (row.scope !== 'propriedade') throw new Error('escopo errado')
    expect(row.granter).toBeNull()
  })

  it('o detalhe abre por clique e nomeia beneficiário, propriedade, concedente e prazo', () => {
    const game = createSeedState(['p1', 'p2'])
    game.immunities = [{ beneficiaryId: 'p2', granterId: 'p1', pos: 1, lapsRemaining: 3 }]
    act(() => {
      useGameStore.setState({ game })
      useRoomStore.setState({ room: SALA, myUid: 'u1' })
    })

    render(<PlayersPanel />)
    // O selo é curto na linha (divide espaço com o caixa); o NOME ACESSÍVEL carrega o
    // escopo por extenso, que é o canal que não depende de espaço nem de cor.
    fireEvent.click(screen.getByRole('button', { name: /Pedro: 1 imunidade de propriedade/ }))

    expect(screen.getByText(/Imunidade de aluguel/)).toBeTruthy()
    expect(screen.getByText('restam 3 voltas')).toBeTruthy()
    // O nome do concedente aparece no corpo — "contra quem" a imunidade vale.
    expect(screen.getByText(/concedida por/)).toBeTruthy()
  })
})

describe('efeitos ativos com alvo, alcance e duração (058/US5)', () => {
  it('Estatização é da MESA inteira e diz para onde o aluguel vai', () => {
    const [row] = effectsView([{ kind: 'estatizacao', ownerId: 'p1', pos: null, lapsRemaining: 1 }], SALA)
    expect(row.scope).toBe('mesa')
    expect(row.consequence).toMatch(/aluguéis da mesa/i)
    expect(row.lapsRemaining).toBe(1)
  })

  it('Embargo NOMEIA o jogador afetado — que é o alvo, não quem jogou a carta', () => {
    const [row] = effectsView(
      [{ kind: 'embargo', ownerId: 'p1', pos: null, lapsRemaining: 2, targetId: 'p2' }],
      SALA,
    )
    expect(row.scope).toBe('jogador')
    expect(row.subject?.name).toBe('Pedro')
    expect(row.consequence).toBe('Pedro não pode construir')
  })

  it('Boicote nomeia a PROPRIEDADE', () => {
    const [row] = effectsView([{ kind: 'boicote', ownerId: 'p1', pos: 1, lapsRemaining: 2 }], SALA)
    expect(row.scope).toBe('propriedade')
    expect(row.pos).toBe(1)
    expect(row.consequence).toContain(row.place!)
  })

  it('nenhum efeito exibe id técnico de jogador, nem sem sala', () => {
    const rows = effectsView(
      [
        { kind: 'embargo', ownerId: 'p1', pos: null, lapsRemaining: 2, targetId: 'p2' },
        { kind: 'imunidade-total', ownerId: 'p2', pos: null, lapsRemaining: 1 },
      ],
      null,
    )
    for (const row of rows) expect(row.consequence).not.toMatch(/\bp\d+\b/)
  })

  it('a duração vem do ESTADO — é o que fez a D-080 não exigir edição de texto', () => {
    const uma = effectsView([{ kind: 'estatizacao', ownerId: 'p1', pos: null, lapsRemaining: 1 }], SALA)[0]
    const duas = effectsView([{ kind: 'estatizacao', ownerId: 'p1', pos: null, lapsRemaining: 2 }], SALA)[0]
    expect(uma.lapsRemaining).toBe(1)
    expect(duas.lapsRemaining).toBe(2)
    expect(uma.consequence).toBe(duas.consequence) // a frase não repete o número
  })

  it('o painel mostra alcance e prazo, com plural correto', () => {
    const game = createSeedState(['p1', 'p2'])
    game.tempEffects = [{ kind: 'estatizacao', ownerId: 'p1', pos: null, lapsRemaining: 1 }]
    act(() => {
      useGameStore.setState({ game })
      useRoomStore.setState({ room: SALA, myUid: 'u1' })
    })

    render(<PlayersPanel />)
    expect(screen.getByText('Estatização')).toBeTruthy()
    expect(screen.getByText('Mesa inteira')).toBeTruthy()
    expect(screen.getByText('resta 1 volta')).toBeTruthy()
  })
})
