// Sessão anônima por link (spec 037/043, FR-003, D-042). A identidade é o `uid` emitido pela
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
  publicListingId: string | null // ?public=<listingId> → identidade e admissão server-side
  createHost: boolean // ?host=1 → criar sala
}

export function parseRoomLink(search: string): RoomLink {
  const q = new URLSearchParams(search)
  return {
    roomId: q.get('room'),
    publicListingId: q.get('public'),
    createHost: q.get('host') === '1',
  }
}

// Link compartilhável de uma sala (FR-001). Desde a 051 o app vive em `/play` — a raiz
// é a landing pública. Convites antigos (`/?room=`) continuam entrando: a borda redireciona
// pra cá com a query intacta (vercel.json + middleware de dev, spec 051/FR-004).
export function roomLink(roomId: string, origin = ''): string {
  return `${origin}/play?room=${encodeURIComponent(roomId)}`
}

// Id de sala novo — curto, suficiente p/ o MVP (colisão desprezível no free tier).
export function newRoomId(): string {
  return newToken().replace(/-/g, '').slice(0, 10)
}

// Nome do jogador, lembrado entre telas e entre sessões. A home pergunta uma vez e a tela
// de identidade já nasce preenchida — sem isso, o mesmo fluxo pediria o nome duas vezes.
// Precisa ser armazenamento, não estado de React: a home NAVEGA (troca `location.search`)
// e o componente seguinte monta numa página nova.
const NAME_KEY = 'bm.player-name'
export const NAME_MAX = 16

export function rememberPlayerName(name: string): void {
  const clean = name.trim().slice(0, NAME_MAX)
  try {
    if (clean) localStorage.setItem(NAME_KEY, clean)
    else localStorage.removeItem(NAME_KEY)
  } catch {
    // Armazenamento bloqueado (aba privada, cookies de terceiros): o nome só não persiste.
  }
}

export function recallPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY)?.slice(0, NAME_MAX) ?? ''
  } catch {
    return ''
  }
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
