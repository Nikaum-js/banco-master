import { describe, expect, it, vi } from 'vitest'
import { roomLink } from '@/net/session'
import {
  ROOM_SHARE_TEXT,
  ROOM_SHARE_TITLE,
  isShareCancellation,
  roomQr,
  roomShareData,
  whatsappShareUrl,
} from '@/net/invite'

describe('contrato do convite da sala', () => {
  it('mantém roomLink como fonte da URL canônica compartilhada', () => {
    const link = roomLink('sala 42', 'https://magnata-imobiliario.vercel.app')

    expect(link).toBe('https://magnata-imobiliario.vercel.app/play?room=sala%2042')
    expect(roomShareData(link)).toEqual({
      title: ROOM_SHARE_TITLE,
      text: ROOM_SHARE_TEXT,
      url: link,
    })
  })

  it('gera localmente uma matriz QR cujo payload é exatamente o link', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const link = roomLink('fc532036e9', 'https://magnata-imobiliario.vercel.app')
    const qr = roomQr(link)

    expect(qr.payload).toBe(link)
    expect(qr.size).toBeGreaterThanOrEqual(21)
    expect(qr.matrix).toHaveLength(qr.size)
    expect(qr.matrix.every((row) => row.length === qr.size)).toBe(true)
    expect(qr.matrix.flat().some(Boolean)).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('monta o fallback do WhatsApp com mensagem e URL codificadas uma vez', () => {
    const link = roomLink('abc/123', 'https://example.test')
    const url = new URL(whatsappShareUrl(link))

    expect(url.origin).toBe('https://wa.me')
    expect(url.searchParams.get('text')).toBe(`${ROOM_SHARE_TEXT} ${link}`)
    expect(url.href).toContain(encodeURIComponent(link))
  })

  it('distingue cancelamento de falha real do compartilhamento', () => {
    expect(isShareCancellation(new DOMException('cancelado', 'AbortError'))).toBe(true)
    expect(isShareCancellation({ name: 'AbortError' })).toBe(true)
    expect(isShareCancellation(new Error('sem permissão'))).toBe(false)
  })
})
