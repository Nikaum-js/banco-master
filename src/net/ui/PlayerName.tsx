// Identidade de jogador na tela (spec 038, US2). Componente — e não hook solto — porque a
// UI precisa nomear jogadores dentro de listas (`map`), onde chamar hook por item é proibido.
//
// Fonte: a SALA (nome/cor/peça escolhidos no lobby). Sem sala, cai no rótulo padrão
// (`Jogador N`) — nunca o id técnico `p1..p8` (FR-009).
import { cn } from '@/lib/utils'
import { useIdentity } from '@/net/roomStore'
import { pieceOf } from '@/net/room'
import { PieceGlyph } from '@/net/ui/pieceGlyphs'

// Nome exibível. `dot` acrescenta o disco da cor do jogador antes do nome.
export function PlayerName({
  playerId,
  dot = false,
  className,
}: {
  playerId: string
  dot?: boolean
  className?: string
}) {
  const id = useIdentity(playerId)
  return (
    <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)}>
      {dot && (
        <span
          className="w-2.5 h-2.5 rounded-full border border-coffee-950/50 shrink-0"
          style={{ background: id.color }}
          aria-hidden
        />
      )}
      <span className="truncate">{id.name}</span>
    </span>
  )
}

// Peça do jogador (emblema + cor) — usada no tabuleiro e no lobby. Glifo SVG autoral
// (`pieceGlyphs`), tinta sobre a cor do assento — nunca emoji.
export function PlayerPiece({ playerId, size = 18 }: { playerId: string; size?: number }) {
  const id = useIdentity(playerId)
  const piece = pieceOf(id.piece)
  return (
    <span
      className="inline-grid place-items-center rounded-full border-2 border-coffee-950/60 shrink-0 text-coffee-950"
      style={{ background: id.color, width: size, height: size }}
      title={`${id.name} · ${piece.label}`}
      aria-label={`${id.name} (${piece.label})`}
    >
      <PieceGlyph id={piece.id} size={size * 0.62} />
    </span>
  )
}
