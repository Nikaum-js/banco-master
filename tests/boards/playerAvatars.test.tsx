// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlayerFace } from '@/boards/PlayerFace'
import {
  AVATARS,
  DEFAULT_AVATAR,
  normalizeAvatar,
} from '@/boards/playerAvatarCatalog'
import {
  DEFAULT_SKIN,
  SKINS,
  normalizeSkin,
} from '@/boards/playerSkinCatalog'

describe('avatares canônicos do jogador', () => {
  it('fecha o catálogo nas cinco formas finais', () => {
    expect(AVATARS.map((avatar) => avatar.id)).toEqual([
      'classic-alive',
      'orbital-eyes',
      'single-line',
      'prism-face',
      'totem-face',
    ])
    expect(AVATARS.some((avatar) => avatar.label.includes('Líquida'))).toBe(false)
  })

  it('normaliza ausência e valor desconhecido para Clássico Vivo', () => {
    expect(normalizeAvatar(undefined)).toBe(DEFAULT_AVATAR)
    expect(normalizeAvatar('liquid-form')).toBe(DEFAULT_AVATAR)
    expect(normalizeAvatar('totem-face')).toBe('totem-face')
  })

  it('fecha o catálogo nas oito skins anteriores', () => {
    expect(SKINS.map((skin) => skin.id)).toEqual([
      'careca',
      'cavanhaque',
      'topete',
      'cartola',
      'safari',
      'aviador',
      'robo',
      'astronauta',
    ])
  })

  it('normaliza ausência e valor desconhecido para Careca', () => {
    expect(normalizeSkin(undefined)).toBe(DEFAULT_SKIN)
    expect(normalizeSkin('liquid-form')).toBe(DEFAULT_SKIN)
    expect(normalizeSkin('cartola')).toBe('cartola')
  })

  it.each(AVATARS.flatMap((avatar) => SKINS.map((skin) => ({ avatar, skin }))))(
    'PlayerFace renderiza $avatar.label + $skin.label',
    ({ avatar, skin }) => {
      const { container, unmount } = render(
        <PlayerFace color="#d9a650" avatar={avatar.id} skin={skin.id} size={32} />,
      )
      const face = container.querySelector(`[data-avatar="${avatar.id}"][data-skin="${skin.id}"]`)
      expect(face).toBeTruthy()
      expect(container.querySelector('.avatar-expressive')).toBeTruthy()
      if (skin.id !== 'careca') {
        expect(container.querySelector(`[class*="skin-"]`)).toBeTruthy()
      }
      unmount()
    },
  )

  it.each(AVATARS)('preserva a skin ao trocar para $label', ({ id }) => {
    const { container } = render(
      <PlayerFace color="#d9a650" avatar={id} skin="aviador" size={32} />,
    )
    expect(container.querySelector(`[data-avatar="${id}"][data-skin="aviador"]`)).toBeTruthy()
  })

  it('mantém a silhueta escolhida no estado falido e troca a expressão', () => {
    const { container } = render(
      <PlayerFace color="#d9a650" avatar="prism-face" skin="cartola" asleep size={24} />,
    )
    expect(container.querySelector('[data-avatar="prism-face"][data-skin="cartola"]')).toBeTruthy()
    expect(container.querySelector('.avatar-asleep-face')).toBeTruthy()
  })

  it.each([16, 24, 32, 72])('preserva o viewBox e o tamanho canônico em %ipx', (size) => {
    const { container } = render(
      <PlayerFace color="#d9a650" avatar="totem-face" size={size} />,
    )
    const face = container.querySelector('svg')
    expect(face?.getAttribute('viewBox')).toBe('0 0 160 160')
    expect(face?.getAttribute('width')).toBe(String(size))
    expect(face?.getAttribute('height')).toBe(String(size))
  })
})
