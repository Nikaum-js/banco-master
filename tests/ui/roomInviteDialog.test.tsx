// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ROOM_SHARE_TEXT, ROOM_SHARE_TITLE, roomShareData } from '@/net/invite'
import { RoomInviteDialog } from '@/net/ui/RoomInviteDialog'

const link = 'https://magnata-imobiliario.vercel.app/play?room=fc532036e9'

function setShare(share?: (data?: ShareData) => Promise<void>): void {
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: share,
  })
}

function setClipboard(writeText = vi.fn().mockResolvedValue(undefined)): typeof writeText {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  return writeText
}

afterEach(() => {
  cleanup()
  setShare(undefined)
  vi.restoreAllMocks()
})

describe('diálogo de convite', () => {
  it('envia título, texto e URL corretos ao compartilhamento nativo', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShare(share)
    setClipboard()

    render(<RoomInviteDialog link={link} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar pelo dispositivo' }))

    await waitFor(() => expect(share).toHaveBeenCalledWith(roomShareData(link)))
    expect(share).toHaveBeenCalledWith({
      title: ROOM_SHARE_TITLE,
      text: ROOM_SHARE_TEXT,
      url: link,
    })
  })

  it('trata cancelamento como silêncio e anuncia uma falha real', async () => {
    const share = vi.fn()
      .mockRejectedValueOnce(new DOMException('cancelado', 'AbortError'))
      .mockRejectedValueOnce(new Error('bloqueado'))
    setShare(share)
    setClipboard()

    render(<RoomInviteDialog link={link} onClose={vi.fn()} />)
    const action = screen.getByRole('button', { name: 'Compartilhar pelo dispositivo' })

    fireEvent.click(action)
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.click(action)
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível abrir o compartilhamento.')
  })

  it('oferece clipboard, WhatsApp e orientação para Discord sem Web Share API', async () => {
    setShare(undefined)
    const writeText = setClipboard()

    render(<RoomInviteDialog link={link} onClose={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Compartilhar pelo dispositivo' })).toBeNull()
    const whatsapp = screen.getByRole('link', { name: 'Abrir no WhatsApp' }) as HTMLAnchorElement
    expect(new URL(whatsapp.href).searchParams.get('text')).toBe(`${ROOM_SHARE_TEXT} ${link}`)
    expect(screen.getByText(/cole o link copiado no Discord/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Copiar link da sala' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link))
    expect(screen.getByRole('status').textContent).toContain('Link copiado')
  })

  it('fecha com Escape e devolve o foco ao gatilho', async () => {
    setShare(undefined)
    setClipboard()

    function Harness() {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Compartilhar sala</button>
          {open && <RoomInviteDialog link={link} onClose={() => setOpen(false)} />}
        </>
      )
    }

    const React = await import('react')
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Compartilhar sala' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(dialog, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })
})
