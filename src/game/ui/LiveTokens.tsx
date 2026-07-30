// Tokens vivos no tabuleiro — leem as posições do store. Cada jogador é um
// motion.div com key estável + `layout`: o framer-motion anima o deslize entre
// células do grid. Para o peão ANDAR casa a casa (022.1), guardamos uma posição
// "exibida" por jogador e a avançamos de 1 em 1 até a posição real — cada passo
// é uma transição curta. Movimentos grandes/para trás (teleporte, volte-3) dão
// snap direto, evitando dar a volta pelo caminho errado.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '@/game/store'
import { useTokenAnim } from '@/game/ui/tokenAnim'
import { play } from '@/game/ui/sound/engine'
import { PlayerFace } from '@/boards/PlayerFace'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { useRoomStore } from '@/net/roomStore'
import { identityOf } from '@/net/identity'

// Tamanho do tabuleiro ATIVO (D-070) — era o literal 48, que fazia o peão dar a volta
// errada na Fuligem (40 casas).
import { boardSize } from '@/lib/boardData'

const STEP_MS = 150 // tempo entre passos
const WALK_MAX = 12 // distância máx. (horária) que anima passo a passo; acima disso, snap

// Estado da caminhada: posição EXIBIDA por jogador + contador de "plop" por chegada.
// Os dois moram na MESMA slice de propósito: a chegada é a transição andando→parado, e
// detectá-la num efeito separado (comparando `shown` com `targets` a cada render) era
// setState em efeito — um render a mais e uma segunda fonte de verdade para o mesmo evento.
// Aqui o passo que faz o peão chegar já incrementa o `pop` no mesmo commit.
type Walk = { shown: Record<string, number>; pop: Record<string, number> }

// Hook: posição exibida por jogador, andando de 1 em 1 até a posição real.
// `paused` (dados rolando): congela o peão — só anda quando o dado para.
// `reduced` (044/US5, D7 — FR-030): com movimento reduzido o peão CHEGA
// INSTANTANEAMENTE — nada de passo a passo nem do intervalo de STEP_MS. O handshake com
// `tokenAnim` (animating→GameDriver segura a resolução) continua valendo: `arrived` ainda
// dispara, só que no mesmo commit, e o `set(walking)` do efeito abaixo cai pra `false` no
// próximo render — o modal de compra não abre antes da hora, só não tem mais o passeio.
function useWalkedPositions(targets: Record<string, number>, paused: boolean, reduced: boolean): Walk {
  const [walk, setWalk] = useState<Walk>(() => ({ shown: targets, pop: {} }))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shown = walk.shown

  useEffect(() => {
    if (paused) return // dados em arremesso: não anda ainda
    const next: Record<string, number> = {}
    const arrived: string[] = [] // chegaram NESTE passo (andando→parado)
    let moving = false
    let walked = false
    for (const id of Object.keys(targets)) {
      const cur = shown[id]
      const tgt = targets[id]
      if (cur === undefined) { next[id] = tgt; continue } // jogador novo: entra na posição
      if (cur === tgt) { next[id] = cur; continue }
      const size = boardSize()
      const fwd = (tgt - cur + size) % size
      if (!reduced && fwd >= 1 && fwd <= WALK_MAX) {
        next[id] = (cur + 1) % size // anda 1
        moving = true
        walked = true
        if (next[id] === tgt) arrived.push(id)
      } else {
        next[id] = tgt // reduzido, teleporte ou recuo: chega de uma vez (sem tick)
        moving = true
        arrived.push(id)
      }
    }
    if (walked) play('step-tick') // um tick por batida de STEP_MS, mesmo com N peões (035)
    // Remove ids que sumiram (eliminados não importam aqui).
    const changed = Object.keys(next).some((id) => next[id] !== shown[id]) || Object.keys(shown).length !== Object.keys(next).length
    if (changed) {
      const delay = reduced ? 0 : (moving ? STEP_MS : 0)
      timer.current = setTimeout(() => {
        setWalk((cur) => {
          if (!arrived.length) return { shown: next, pop: cur.pop }
          const pop = { ...cur.pop }
          for (const id of arrived) pop[id] = (pop[id] ?? 0) + 1
          return { shown: next, pop }
        })
        if (arrived.length) play('step-land') // um som por chegada, mesmo com N peões (035)
      }, delay)
      return () => { if (timer.current) clearTimeout(timer.current) }
    }
  }, [targets, shown, paused, reduced])

  return walk
}

export function LiveTokens({ gridArea }: { gridArea: (pos: number) => CSSProperties }) {
  // O peão não depende de log, cartas, negociações ou resolução da casa. Assinar
  // `s.game` inteiro fazia esta árvore animada renderizar em todo comando do motor.
  // Os reducers clonam o GameState profundamente; por isso também não basta selecionar
  // `players`: extraímos apenas os primitivos que mudam a representação dos peões.
  const ids = useGameStore(useShallow((s) => s.game.players.map((p) => p.id)))
  const positions = useGameStore(useShallow((s) => s.game.players.map((p) => p.pos)))
  const eliminated = useGameStore(useShallow((s) => s.game.players.map((p) => p.eliminated)))
  const cash = useGameStore(useShallow((s) => s.game.players.map((p) => p.cash)))
  const turnOrder = useGameStore(useShallow((s) => s.game.turnOrder))
  const activeSeat = useGameStore((s) => s.game.activeSeat)
  const room = useRoomStore((s) => s.room)
  const rolling = useTokenAnim((s) => s.rolling)
  const activeId = ids[turnOrder[activeSeat]]
  const { reduced } = useMotion()

  // Alvo de posição por jogador (não-eliminado). Memoizado: é a dependência dos efeitos
  // da caminhada, e um objeto novo a cada render os reexecutaria sem nada ter mudado.
  const targets = useMemo(() => {
    const t: Record<string, number> = {}
    ids.forEach((id, index) => {
      if (!eliminated[index]) t[id] = positions[index]
    })
    return t
  }, [ids, positions, eliminated])
  const { shown, pop } = useWalkedPositions(targets, rolling, reduced)

  // Sinaliza ao GameDriver se o peão do jogador da vez ainda está andando —
  // o driver segura a resolução da casa até o peão chegar (024.1).
  useEffect(() => {
    const walking = activeId != null && shown[activeId] !== undefined && shown[activeId] !== targets[activeId]
    useTokenAnim.getState().set(walking)
  }, [shown, targets, activeId])

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
      {/* Realce na casa de destino enquanto o peão da vez caminha. O pulso ambiente
          (0.9s, fora do vocabulário — não é enter/exit) some sob movimento reduzido; e
          como o peão agora chega instantaneamente (`reduced`), esta casa quase nunca fica
          tempo suficiente na tela pra o pulso importar — o realce fixo é só defensivo. */}
      {activeWalking && activeTarget !== undefined && (
        <motion.div
          key="dest-highlight"
          className="relative z-20 pointer-events-none"
          style={gridArea(activeTarget)}
          initial={{ opacity: 0 }}
          animate={reduced ? { opacity: 0.6 } : { opacity: [0.4, 0.85, 0.4] }}
          exit={{ opacity: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="absolute inset-0.5 rounded-[3px] ring-2 ring-gold/80 shadow-[0_0_12px_color-mix(in_srgb,var(--color-brass)_60%,transparent)]" />
        </motion.div>
      )}

      {ids.map((id, index) => {
        if (eliminated[index]) return null
        const identity = identityOf(room, id)
        const pos = shown[id] ?? positions[index]
        // `rolling` fica de fora do gate: com o dado no ar o peão está SEGURADO
        // (não em marcha) — sem isso ele levantava da chapa antes de andar.
        const walking = !rolling && targets[id] !== undefined && pos !== targets[id]
        const group = groups[pos] ?? [id]
        const n = group.length
        const size = tokenSize(n)
        const off = stackOffset(group.indexOf(id), n, size)
        return (
          <motion.div
            key={id}
            layout
            // Passo INTERMEDIÁRIO desliza linear com a MESMA duração do intervalo entre
            // passos (STEP_MS): um passo emenda no outro sem o anda-e-para do ease
            // padrão (120ms de curva + 30ms parado, medido como "esquisito"). Só o
            // passo de CHEGADA desacelera (emphasis) — o pouso fica macio.
            transition={
              reduced ? { duration: 0 }
              : walking ? { duration: STEP_MS / 1000, ease: 'linear' }
              : { duration: MOTION.base, ease: EASE.emphasis }
            }
            className="relative z-30 pointer-events-none"
            style={gridArea(pos)}
          >
            <div
              title={`${id} · $${cash[index]}`}
              className="absolute left-1/2 top-1/2"
              style={{ transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))` }}
            >
              {/* Em marcha, o token levanta da mesa (sombra da chapa fica pra trás) e
                  assenta na chegada — o plop abaixo completa o pouso. */}
              <motion.div
                animate={reduced || !walking ? { y: 0, scale: 1 } : { y: -4, scale: 1.08 }}
                transition={{ duration: MOTION.fast, ease: EASE.standard }}
              >
                {/* key={tick} remonta e replay a escala a cada CHEGADA (plop) — some sob
                    movimento reduzido: a chegada em si já está no `shown` (o FATO fica). */}
                <motion.div
                  key={`pop-${pop[id] ?? 0}`}
                  className="board-live-token"
                  initial={{ scale: 1 }}
                  animate={reduced ? { scale: 1 } : { scale: [1, 1.22, 1] }}
                  transition={{ duration: MOTION.base, ease: EASE.standard }}
                >
                  <PlayerFace
                    color={identity.color}
                    avatar={identity.avatar}
                    skin={identity.skin}
                    size={size}
                    active={id === activeId}
                  />
                </motion.div>
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
