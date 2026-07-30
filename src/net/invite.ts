import { encode } from 'uqr'

export const ROOM_SHARE_TITLE = 'Magnata Imobiliário'
export const ROOM_SHARE_TEXT = 'Entre na minha sala privada do Magnata Imobiliário:'

export interface RoomShareData {
  title: string
  text: string
  url: string
}

export interface RoomQr {
  payload: string
  matrix: boolean[][]
  size: number
}

export function roomShareData(link: string): RoomShareData {
  return {
    title: ROOM_SHARE_TITLE,
    text: ROOM_SHARE_TEXT,
    url: link,
  }
}

export function roomQr(link: string): RoomQr {
  // `border: 0` mantém a matriz como QR puro; a quiet zone obrigatória é desenhada pelo
  // componente como quatro módulos brancos e não depende do tema do lobby.
  const encoded = encode(link, { ecc: 'M', boostEcc: true, border: 0 })
  return {
    payload: link,
    matrix: encoded.data,
    size: encoded.size,
  }
}

export function whatsappShareUrl(link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${ROOM_SHARE_TEXT} ${link}`)}`
}

export function isShareCancellation(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError')
    || (
      typeof error === 'object'
      && error !== null
      && 'name' in error
      && error.name === 'AbortError'
    )
  )
}
