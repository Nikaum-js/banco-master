// Tokens vivos no tabuleiro — lê as posições do store (substitui os tokens mockados).
import type { CSSProperties } from 'react'
import { useGameStore } from '@/game/store'

const COLORS = ['#d4af37', '#a855f7', '#06b6d4', '#14b8a6', '#d946ef', '#f4e8d0', '#ef4444', '#22c55e']

export function LiveTokens({ gridArea }: { gridArea: (pos: number) => CSSProperties }) {
  const game = useGameStore((s) => s.game)
  const activeId = game.players[game.turnOrder[game.activeSeat]]?.id

  const groups: Record<number, number[]> = {} // pos → índices de jogadores
  game.players.forEach((p, i) => {
    if (p.eliminated) return
    ;(groups[p.pos] ??= []).push(i)
  })

  return (
    <>
      {Object.entries(groups).map(([posStr, idxs]) => (
        <div key={posStr} className="relative z-30 pointer-events-none" style={gridArea(Number(posStr))}>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-wrap justify-center gap-0.5" style={{ maxWidth: '92%' }}>
            {idxs.map((i) => {
              const p = game.players[i]
              return (
                <div
                  key={p.id}
                  title={`${p.id} · $${p.cash}`}
                  className="flex items-center justify-center rounded-full border border-black/50 text-[8px] font-bold text-black/80"
                  style={{
                    width: 15,
                    height: 15,
                    background: COLORS[i % COLORS.length],
                    boxShadow: p.id === activeId ? '0 0 0 2px #fff, 0 0 6px rgba(255,255,255,0.6)' : undefined,
                  }}
                >
                  {i + 1}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
