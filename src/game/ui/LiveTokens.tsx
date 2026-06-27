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
import { play } from '@/game/ui/sound/engine'
import { PlayerFace, PLAYER_COLORS } from '@/boards/shared'

const BOARD_SIZE = 48
const STEP_MS = 150 // tempo entre passos
const WALK_MAX = 12 // distância máx. (horária) que anima passo a passo; acima disso, snap

// Hook: posição exibida por jogador, andando de 1 em 1 até a posição real.
// `paused` (dados rolando): congela o peão — só anda quando o dado para.
function useWalkedPositions(targets: Record<string, number>, paused: boolean): Record<string, number> {
  const [shown, setShown] = useState<Record<string, number>>(targets)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (paused) return // dados em arremesso: não anda ainda
    const next: Record<string, number> = {}
    let moving = false
    let walked = false
    for (const id of Object.keys(targets)) {
      const cur = shown[id]
      const tgt = targets[id]
      if (cur === undefined) { next[id] = tgt; continue } // jogador novo: entra na posição
      if (cur === tgt) { next[id] = cur; continue }
      const fwd = (tgt - cur + BOARD_SIZE) % BOARD_SIZE
      if (fwd >= 1 && fwd <= WALK_MAX) { next[id] = (cur + 1) % BOARD_SIZE; moving = true; walked = true } // anda 1
      else { next[id] = tgt; moving = true } // teleporte/para trás: snap (sem tick — só chegada)
    }
    if (walked) play('step-tick') // um tick por batida de STEP_MS, mesmo com N peões (035)
    // Remove ids que sumiram (eliminados não importam aqui).
    const changed = Object.keys(next).some((id) => next[id] !== shown[id]) || Object.keys(shown).length !== Object.keys(next).length
    if (changed) {
      timer.current = setTimeout(() => setShown(next), moving ? STEP_MS : 0)
      return () => { if (timer.current) clearTimeout(timer.current) }
    }
  }, [targets, shown, paused])

  return shown
}

export function LiveTokens({ gridArea }: { gridArea: (pos: number) => CSSProperties }) {
  const game = useGameStore((s) => s.game)
  const rolling = useTokenAnim((s) => s.rolling)
  const activeId = game.players[game.turnOrder[game.activeSeat]]?.id

  // Alvo de posição por jogador (não-eliminado).
  const targets: Record<string, number> = {}
  game.players.forEach((p) => { if (!p.eliminated) targets[p.id] = p.pos })
  const shown = useWalkedPositions(targets, rolling)

  // Sinaliza ao GameDriver se o peão do jogador da vez ainda está andando —
  // o driver segura a resolução da casa até o peão chegar (024.1).
  useEffect(() => {
    const walking = activeId != null && shown[activeId] !== undefined && shown[activeId] !== targets[activeId]
    useTokenAnim.getState().set(walking)
  }, [shown, targets, activeId])

  // "Plop" de chegada: tick por jogador que incrementa quando ele PARA de andar
  // (a transição andando→parado). O wrapper com key={tick} replay a escala.
  const [pop, setPop] = useState<Record<string, number>>({})
  const prevWalking = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const landed: string[] = []
    for (const id of Object.keys(targets)) {
      const w = shown[id] !== undefined && shown[id] !== targets[id]
      if (prevWalking.current[id] && !w) landed.push(id) // chegou
      prevWalking.current[id] = w
    }
    if (landed.length) {
      setPop((cur) => {
        const next = { ...cur }
        for (const id of landed) next[id] = (next[id] ?? 0) + 1
        return next
      })
      play('step-land') // um som por chegada, mesmo com N peões (035)
    }
  }, [shown, targets])

  // Casa de destino do jogador da vez, enquanto ele anda — recebe um realce.
  const activeTarget = activeId != null ? targets[activeId] : undefined
  const activeWalking = activeId != null && shown[activeId] !== undefined && shown[activeId] !== targets[activeId]

  // Empilhamento: quem está em cada casa EXIBIDA.
  const groups: Record<number, string[]> = {}
  for (const id of Object.keys(shown)) {
    if (targets[id] === undefined) continue // eliminado
    ;(groups[shown[id]] ??= []).push(id)
  }

  return (
    <>
      {/* Realce pulsante na casa de destino enquanto o peão da vez caminha */}
      {activeWalking && activeTarget !== undefined && (
        <motion.div
          key="dest-highlight"
          className="relative z-20 pointer-events-none"
          style={gridArea(activeTarget)}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.85, 0.4] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="absolute inset-0.5 rounded-[3px] ring-2 ring-gold/80 shadow-[0_0_12px_rgba(212,175,55,0.6)]" />
        </motion.div>
      )}

      {game.players.map((p, i) => {
        if (p.eliminated) return null
        const pos = shown[p.id] ?? p.pos
        const group = groups[pos] ?? [p.id]
        const n = group.length
        const size = tokenSize(n)
        const off = stackOffset(group.indexOf(p.id), n, size)
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
              {/* key={tick} remonta e replay a escala a cada CHEGADA (plop) */}
              <motion.div
                key={`pop-${pop[p.id] ?? 0}`}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.22, 1] }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <PlayerFace color={PLAYER_COLORS[i % PLAYER_COLORS.length]} size={size} active={p.id === activeId} />
              </motion.div>
            </div>
          </motion.div>
        )
      })}
    </>
  )
}

// Token encolhe quando vários dividem a casa (evita ficar "um dentro do outro").
function tokenSize(n: number): number {
  if (n <= 1) return 32
  if (n <= 2) return 27
  if (n <= 4) return 23
  return 19
}

// Empilhamento: 1 fileira até 4 tokens; grade de 2 fileiras de 5 a 8. Centralizado.
function stackOffset(i: number, n: number, size: number): { x: number; y: number } {
  if (n <= 1) return { x: 0, y: 0 }
  const cols = n <= 4 ? n : Math.ceil(n / 2)
  const rows = n <= 4 ? 1 : 2
  const col = i % cols
  const row = Math.floor(i / cols)
  const colsInRow = row === rows - 1 ? n - cols * (rows - 1) : cols
  const gx = size * 0.7
  const gy = size * 0.64
  return {
    x: (col - (colsInRow - 1) / 2) * gx,
    y: rows === 1 ? 0 : (row - (rows - 1) / 2) * gy,
  }
}
