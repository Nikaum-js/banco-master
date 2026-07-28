// Identidade de exibição (spec 038 + 046): playerId → nome, cor, avatar e skin.
//
// Vive na SALA, nunca no `GameState` (D-019): o snapshot é persistido a cada comando, e
// nome dentro de `Player` viraria PII em repouso sem necessidade. A junção acontece na
// hora de renderizar.
//
// O fallback sintético existe para que NENHUMA superfície precise de `if (multiplayer)`:
// com ou sem sala, a UI pede a identidade e recebe algo exibível — que é como `p1..p8`
// some da interface inteira de uma vez (FR-009).
// O VOCABULÁRIO de assento (cores e a regra de unicidade delas) vive em `./room`. Aqui fica
// só a projeção de EXIBIÇÃO: playerId → o que aparece na tela.
import { SEAT_COLORS, type Room } from './room'
import { DEFAULT_AVATAR, normalizeAvatar, type AvatarId } from '@/boards/playerAvatarCatalog'
import { DEFAULT_SKIN, normalizeSkin, type SkinId } from '@/boards/playerSkinCatalog'

export interface PlayerIdentity {
  playerId: string
  name: string
  color: string
  avatar: AvatarId
  skin: SkinId
}

// Índice do assento a partir do id serializável ('p3' → 2). O motor só conhece esses ids.
function seatIndexOf(playerId: string): number {
  const n = Number.parseInt(playerId.replace(/^p/, ''), 10)
  return Number.isFinite(n) && n > 0 ? n - 1 : 0
}

// Identidade padrão sem sala (cliente único) — nunca expõe o id técnico.
export function fallbackIdentity(playerId: string): PlayerIdentity {
  const i = seatIndexOf(playerId)
  return {
    playerId,
    name: `Jogador ${i + 1}`,
    color: SEAT_COLORS[i % SEAT_COLORS.length],
    avatar: DEFAULT_AVATAR,
    skin: DEFAULT_SKIN,
  }
}

// Identidade de um jogador. Sem sala, ou assento ainda não publicado → fallback.
export function identityOf(room: Room | null, playerId: string): PlayerIdentity {
  const seat = room?.seats.find((s) => s.playerId === playerId)
  if (!seat) return fallbackIdentity(playerId)
  const fb = fallbackIdentity(playerId)
  return {
    playerId,
    name: seat.name.trim() || fb.name, // nome vazio nunca chega à tela (FR-012)
    color: seat.color || fb.color,
    avatar: normalizeAvatar(seat.avatar),
    skin: normalizeSkin(seat.skin),
  }
}
