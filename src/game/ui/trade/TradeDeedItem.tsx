import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { deedPresentation } from '@/game/ui/deed/presentation'
import { SquareIcon } from '@/boards/glyphs/squares'
import { money } from '@/lib/money'
import { CountryFlag } from '@/boards/glyphs/flags'
import { activeBoard } from '@/game/ui/theme/boardTheme'

function TradeDeedAvatar({ pos, compact }: { pos: number; compact: boolean }) {
  const square = activeBoard()[pos]
  const deed = deedPresentation(square)
  const size = compact ? 28 : 36

  if (!deed) return null
  if (deed.flagCode) {
    return (
      <span className="trade-deed-item__avatar" style={{ width: size, height: size }}>
        <CountryFlag
          code={deed.flagCode}
          fill
        />
      </span>
    )
  }

  return (
    <span className="trade-deed-item__avatar trade-deed-item__avatar--glyph" style={{ width: size, height: size }}>
      <SquareIcon square={square} size={size * 0.64} />
    </span>
  )
}

export function TradeDeedItem({ pos, compact = false }: { pos: number; compact?: boolean }) {
  const deed = deedPresentation(activeBoard()[pos])

  if (!deed) return null

  return (
    <div
      className={cn('trade-deed-item', compact && 'trade-deed-item--compact')}
      style={{ '--trade-deed-accent': deed.accent } as CSSProperties}
    >
      <span className="trade-deed-item__rail" aria-hidden />
      <TradeDeedAvatar pos={pos} compact={compact} />

      <div className="trade-deed-item__identity">
        <p className="trade-deed-item__name">{deed.name}</p>
        <p className="trade-deed-item__subtitle">{deed.subtitle}</p>
      </div>

      <dl className="trade-deed-item__facts">
        <div>
          <dt>Preço</dt>
          <dd>{money(deed.price)}</dd>
        </div>
      </dl>
    </div>
  )
}
