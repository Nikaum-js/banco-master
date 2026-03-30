// Tokens vivos no tabuleiro — leem as posições do store. Cada jogador é um
// motion.div com key estável + `layout`: o framer-motion anima o deslize entre
// células do grid. Para o peão ANDAR casa a casa (022.1), guardamos uma posição
// "exibida" por jogador e a avançamos de 1 em 1 até a posição real — cada passo
// é uma transição curta. Movimentos grandes/para trás (teleporte, volte-3) dão
// snap direto, evitando dar a volta pelo caminho errado.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import { useGameStore } from '@/game/store'
import { useTokenAnim } from '@/game/ui/tokenAnim'
import { PlayerFace, PLAYER_COLORS } from '@/boards/shared'

const BOARD_SIZE = 48
const STEP_MS = 150 // tempo entre passos
const WALK_MAX = 12 // distância máx. (horária) que anima passo a passo; acima disso, snap

// Hook: posição exibida por jogador, andando de 1 em 1 até a posição real.
function useWalkedPositions(targets: Record<string, number>): Record<string, number> {
  const [shown, setShown] = useState<Record<string, number>>(targets)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const next: Record<string, number> = {}
    let moving = false
    for (const id of Object.keys(targets)) {
      const cur = shown[id]
      const tgt = targets[id]
      if (cur === undefined) { next[id] = tgt; continue } // jogador novo: entra na posição
      if (cur === tgt) { next[id] = cur; continue }
      const fwd = (tgt - cur + BOARD_SIZE) % BOARD_SIZE
      if (fwd >= 1 && fwd <= WALK_MAX) { next[id] = (cur + 1) % BOARD_SIZE; moving = true } // anda 1
      else { next[id] = tgt; moving = true } // teleporte/para trás: snap
    }
    // Remove ids que sumiram (eliminados não importam aqui).
    const changed = Object.keys(next).some((id) => next[id] !== shown[id]) || Object.keys(shown).length !== Object.keys(next).length
    if (changed) {
      timer.current = setTimeout(() => setShown(next), moving ? STEP_MS : 0)
      return () => { if (timer.current) clearTimeout(timer.current) }
    }
  }, [targets, shown])

  return shown
}

export function LiveTokens({ gridArea }: { gridArea: (pos: number) => CSSProperties }) {
  const game = useGameStore((s) => s.game)
  const activeId = game.players[game.turnOrder[game.activeSeat]]?.id

  // Alvo de posição por jogador (não-eliminado).
  const targets: Record<string, number> = {}
  game.players.forEach((p) => { if (!p.eliminated) targets[p.id] = p.pos })
  const shown = useWalkedPositions(targets)

  // Sinaliza ao GameDriver se o peão do jogador da vez ainda está andando —
  // o driver segura a resolução da casa até o peão chegar (024.1).
  useEffect(() => {
    const walking = activeId != null && shown[activeId] !== undefined && shown[activeId] !== targets[activeId]
    useTokenAnim.getState().set(walking)
  }, [shown, targets, activeId])

  // Empilhamento: quem está em cada casa EXIBIDA.
  const groups: Record<number, string[]> = {}
  for (const id of Object.keys(shown)) {
    if (targets[id] === undefined) continue // eliminado
    ;(groups[shown[id]] ??= []).push(id)
  }

  return (
    <>
      {game.players.map((p, i) => {
        if (p.eliminated) return null
        const pos = shown[p.id] ?? p.pos
        const group = groups[pos] ?? [p.id]
        const off = stackOffset(group.indexOf(p.id), group.length)
        return (
          <motion.div
            key={p.id}
            layout
            transition={{ duration: 0.14, ease: 'easeInOut' }}
            className="relative z-30 pointer-events-none"
            style={gridArea(pos)}
          >
            <div
              title={`${p.id} · $${p.cash}`}
              className="absolute left-1/2 top-1/2"
              style={{ transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))` }}
            >
              <PlayerFace color={PLAYER_COLORS[i % PLAYER_COLORS.length]} size={24} active={p.id === activeId} />
            </div>
          </motion.div>
        )
      })}
    </>
  )
}

// Pequeno leque de offset (px) para empilhar vários tokens na mesma casa.
function stackOffset(i: number, n: number): { x: number; y: number } {
  if (n <= 1) return { x: 0, y: 0 }
  const spread = 9
  return { x: (i - (n - 1) / 2) * spread, y: (i % 2 === 0 ? -1 : 1) * 3 }
}
