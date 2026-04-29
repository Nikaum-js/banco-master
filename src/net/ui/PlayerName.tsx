// Identidade de jogador na tela (spec 038, US2). Componente — e não hook solto — porque a
// UI precisa nomear jogadores dentro de listas (`map`), onde chamar hook por item é proibido.
//
// Fonte: a SALA (nome e cor escolhidos no lobby). Sem sala, cai no rótulo padrão
// (`Jogador N`) — nunca o id técnico `p1..p8` (FR-009).
import { cn } from '@/lib/utils'
import { useIdentity } from '@/net/roomStore'

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
