// Sessão anônima por link (spec 037/043, FR-003, D-035). A identidade é o `uid` emitido pela
// sessão anônima do Supabase (src/net/supabaseClient.ts), não mais um UUID de `localStorage`:
// quem persiste a sessão entre reloads agora é o próprio supabase-js, e é essa persistência que
// sobrevive ao F5. O que sobra aqui é só o link — a credencial de *entrada*, não a identidade.

function newToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback (ambientes sem WebCrypto): suficiente p/ unicidade de sala.
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export interface RoomLink {
  roomId: string | null // ?room=<id> → entrar; null → sem sala
  createHost: boolean // ?host=1 → criar sala
}

export function parseRoomLink(search: string): RoomLink {
  const q = new URLSearchParams(search)
  return { roomId: q.get('room'), createHost: q.get('host') === '1' }
}

// Link compartilhável de uma sala (FR-001).
export function roomLink(roomId: string, origin = ''): string {
  return `${origin}/?room=${encodeURIComponent(roomId)}`
}

// Id de sala novo — curto, suficiente p/ o MVP (colisão desprezível no free tier).
export function newRoomId(): string {
  return newToken().replace(/-/g, '').slice(0, 10)
}

// Aceita tanto o link inteiro quanto o código cru — colar a URL é o caso comum, mas
// ninguém deveria errar por ter copiado só o pedaço final.
export function extractRoomId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const fromQuery = /[?&]room=([^&\s]+)/.exec(raw)
  if (fromQuery) return decodeURIComponent(fromQuery[1])
  if (/^[A-Za-z0-9_-]{4,40}$/.test(raw)) return raw
  return null
}
