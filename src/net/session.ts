// Sessão anônima por link (spec 037, FR-003, D-019). A identidade é um token de sessão (UUID)
// guardado no `localStorage`; a credencial de acesso é o próprio link da sala. Nada aqui entra
// no `GameState` (sem PII) — o token vive só no dispositivo e na associação assento↔token da sala.
const TOKEN_KEY = 'banco:session-token'

function newToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback (ambientes sem WebCrypto): suficiente p/ unicidade de sessão.
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

// Token persistente do dispositivo — gerado na 1ª entrada e reusado para reconexão (FR-004).
export function getSessionToken(): string {
  if (typeof localStorage === 'undefined') return newToken()
  let t = localStorage.getItem(TOKEN_KEY)
  if (!t) {
    t = newToken()
    localStorage.setItem(TOKEN_KEY, t)
  }
  return t
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
