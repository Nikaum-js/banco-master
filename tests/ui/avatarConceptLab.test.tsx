// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_AVATAR, type AvatarId } from '@/boards/playerAvatarCatalog'
import { DEFAULT_SKIN, type SkinId } from '@/boards/playerSkinCatalog'
import { AvatarConceptLab } from '@/net/ui/AvatarConceptLab'
import { IdentityForm } from '@/net/ui/LobbyScreen'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function ControlledLab() {
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR)
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN)
  return (
    <AvatarConceptLab
      color="#d7aa50"
      avatar={avatar}
      skin={skin}
      onAvatarChange={setAvatar}
      onSkinChange={setSkin}
    />
  )
}

describe('catálogo final de avatares', () => {
  it('oferece separadamente os cinco avatares e as oito skins', () => {
    render(<ControlledLab />)

    const labels = ['Clássico Vivo', 'Olhos Orbitais', 'Linha Única', 'Prisma', 'Totem']
    expect(screen.getAllByRole('button', { name: /^Escolher avatar / })).toHaveLength(5)
    expect(screen.getAllByRole('button', { name: /^Escolher skin / })).toHaveLength(8)
    expect(screen.queryByText(/Forma Líquida/i)).toBeNull()

    for (const label of labels) {
      const option = screen.getByRole('button', { name: `Escolher avatar ${label}` })
      fireEvent.click(option)
      expect(option.getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByRole('img', { name: `Avatar ${label} com skin Careca` }).getAttribute('data-avatar')).toBe(
        option.getAttribute('data-avatar'),
      )
    }

    const astronaut = screen.getByRole('button', { name: 'Escolher skin Astronauta' })
    fireEvent.click(astronaut)
    expect(astronaut.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('img', { name: 'Avatar Totem com skin Astronauta' }).getAttribute('data-skin')).toBe('astronauta')
  })

  it('submete nome, cor, avatar e skin como uma identidade única', () => {
    const onSubmit = vi.fn()
    render(
      <IdentityForm
        title="Criar sala"
        room={null}
        cta="Criar sala"
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: 'Nik' } })
    fireEvent.click(screen.getByRole('button', { name: 'Escolher avatar Totem' }))
    fireEvent.click(screen.getByRole('button', { name: 'Escolher skin Cavanhaque' }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }))

    expect(onSubmit).toHaveBeenCalledWith('Nik', expect.any(String), 'totem-face', 'cavanhaque')
  })
})
