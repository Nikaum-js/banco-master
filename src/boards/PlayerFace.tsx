import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { AvatarArtwork } from './playerAvatars'
import { normalizeAvatar, type AvatarId } from './playerAvatarCatalog'
import { PlayerSkinArtwork } from './playerSkins'
import { normalizeSkin, type SkinId } from './playerSkinCatalog'

// Representação canônica do avatar em lobby, token e painéis. Este componente
// permanece independente do tabuleiro para a home não importar `shared.tsx`.
function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) & 0xffff)
  return h
}

export function PlayerFace({
  color,
  size = 24,
  active = false,
  asleep = false,
  avatar,
  skin,
  className,
}: {
  color: string
  size?: number | string
  active?: boolean
  asleep?: boolean
  avatar?: AvatarId
  skin?: SkinId
  className?: string
}) {
  const head = color || 'var(--color-ink-400)'
  const resolvedAvatar = normalizeAvatar(avatar)
  const resolvedSkin = normalizeSkin(skin)
  const h = hashStr(head)
  const delay = `-${(h % 5200) / 1000}s`

  return (
    <svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      className={cn(
        'avatar-face shrink-0',
        `avatar-face--${resolvedAvatar}`,
        `avatar-skin--${resolvedSkin}`,
        asleep && 'avatar-face--asleep',
        !asleep && (active ? 'face-idle-active' : 'face-idle'),
        className,
      )}
      style={{
        filter: active ? `drop-shadow(0 0 4px color-mix(in srgb, ${head} 70%, transparent))` : undefined,
        '--face-delay': delay,
      } as CSSProperties}
      data-avatar={resolvedAvatar}
      data-skin={resolvedSkin}
      aria-hidden="true"
    >
      <PlayerSkinArtwork id={resolvedSkin} color={head} layer="behind" />
      <AvatarArtwork id={resolvedAvatar} color={head} asleep={asleep} />
      <PlayerSkinArtwork id={resolvedSkin} color={head} layer="front" />

      {active && (
        <circle
          className="face-active-ring"
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke={head}
          strokeWidth="4"
          strokeDasharray="8 8"
        />
      )}
    </svg>
  )
}
