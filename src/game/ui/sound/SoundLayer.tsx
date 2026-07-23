// SoundLayer (spec 035) — componente headless (sem render) que observa o estado
// compartilhado e dispara cues. Espelha GameDriver/NoticeLayer. Não escreve no
// GameState (FR-018). Cada cue pertence a UM canal → idempotência (FR-007).
//
// Canal 1: transições tipadas (rolagem, resolução, notice, prisão, fim, pregão,
//          empréstimo, deltas de construção/hipoteca).
// Canal 2: tail do log (imposto/aluguel/GO/juros/falência/saque), por identidade
//          de objeto — robusto ao bound/shift de 50 do log.
// No 1º render só SNAPSHOT (sem tocar) → sem replay de histórico na reconexão (FR-011).
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/game/store'
import { useAudioPrefs } from './prefs'
import { ensureUnlockListener, play, setMasterGain } from './engine'
import { classifyLogEntry, cueForResolution, cueForRoll, cueForNotice } from './classify'
import type { SoundCue } from './cues'
import type { GameState } from '@/game/turn/types'
import type { LogEntry, Title } from '@/game/economy/types'

// Cues que JÁ sonorizam uma movimentação de dinheiro. Se algum tocou no tick,
// o canal de delta de caixa fica mudo (evita dobrar som no mesmo evento, FR-007).
const MONEY_CUES: ReadonlySet<SoundCue> = new Set([
  'buy', 'sell', 'build', 'mortgage', 'unmortgage', 'rent-paid', 'tax-paid',
  'go-bonus', 'free-parking', 'loan-granted', 'loan-interest', 'debt',
  'auction-close', 'bankruptcy', 'hostile-takeover', 'jail-out', 'win',
])

// "Nível" de construção de um título (soma para detectar build/sell por delta).
function buildLevel(t: Title): number {
  return t.houses + (t.hotel ? 1 : 0) + (t.hotel2 ? 1 : 0) + (t.skyscraper ? 1 : 0) + (t.hangar ? 1 : 0)
}

interface Prev {
  roll: GameState['turn']['lastRoll']
  seat: number
  resKind: string | null
  noticeKind: string | null
  jail: Record<string, boolean>
  phase: string
  loans: number
  landAuction: boolean
  landBids: number
  lastLog: LogEntry | null
  titles: Record<number, { level: number; mortgaged: boolean }>
  cash: Record<string, number>
}

function snapshotTitles(g: GameState): Record<number, { level: number; mortgaged: boolean }> {
  const out: Record<number, { level: number; mortgaged: boolean }> = {}
  for (const [pos, t] of Object.entries(g.titles)) out[+pos] = { level: buildLevel(t), mortgaged: t.mortgaged }
  return out
}

function snapshot(g: GameState): Prev {
  const jail: Record<string, boolean> = {}
  const cash: Record<string, number> = {}
  g.players.forEach((p) => {
    jail[p.id] = p.jail.inJail
    cash[p.id] = p.cash
  })
  return {
    roll: g.turn.lastRoll,
    seat: g.turn.seat,
    resKind: g.resolution?.kind ?? null,
    noticeKind: g.notice?.kind ?? null,
    jail,
    phase: g.phase,
    loans: g.loans.length,
    landAuction: g.landAuction !== null,
    landBids: g.landAuction ? g.landAuction.lots.reduce((s, l) => s + (l.currentBid > 0 ? 1 : 0), 0) : 0,
    lastLog: g.log.length ? g.log[g.log.length - 1] : null,
    titles: snapshotTitles(g),
    cash,
  }
}

export function SoundLayer() {
  const game = useGameStore((s) => s.game)
  const prev = useRef<Prev | null>(null)

  // Destrava o áudio no 1º gesto e aplica o ganho inicial das prefs uma vez —
  // as mudanças seguintes são cobertas pelos setters do store e pelo rehydrate.
  useEffect(() => {
    ensureUnlockListener()
    const { volume, muted } = useAudioPrefs.getState()
    setMasterGain(volume, muted)
  }, [])

  useEffect(() => {
    const next = snapshot(game)
    const p = prev.current
    prev.current = next
    if (p === null) return // 1º render: só snapshot, sem tocar (FR-011)

    // Registra o que tocou no tick — o canal de delta de caixa (C3) consulta isso.
    const played: SoundCue[] = []
    const fire = (cue: SoundCue) => {
      played.push(cue)
      play(cue)
    }

    // — Canal 1: transições tipadas —
    // Rolagem (objeto novo a cada rollDice).
    if (game.turn.lastRoll && game.turn.lastRoll !== p.roll) fire(cueForRoll(game.turn.lastRoll))

    // Turno finalizado (a vez passou de assento) — os dados recolhidos da mesa.
    // TODO(multiplayer): quando existir jogador local (Supabase), disparar também
    // 'your-turn' (sino de balcão) no cliente cujo assento === next.seat.
    if (next.seat !== p.seat && next.phase !== 'ended') fire('turn-end')

    // Resolução (borda de subida do kind).
    if (game.resolution && game.resolution.kind !== p.resKind) {
      const cue = cueForResolution(game.resolution.kind)
      if (cue) fire(cue)
    }

    // Notice (borda de subida).
    if (game.notice && game.notice.kind !== p.noticeKind) {
      const cue = cueForNotice(game.notice.kind)
      if (cue) fire(cue)
    }

    // Prisão (entrar/sair) por jogador.
    for (const [id, inJail] of Object.entries(next.jail)) {
      const was = p.jail[id] ?? false
      if (inJail && !was) fire('jail-in')
      else if (!inJail && was) fire('jail-out')
    }

    // Fim de jogo.
    if (next.phase === 'ended' && p.phase !== 'ended') fire('win')

    // Empréstimo concedido.
    if (next.loans > p.loans) fire('loan-granted')

    // Pregão de terrenos: novo lance / fechamento.
    if (next.landAuction && next.landBids > p.landBids) fire('auction-bid')
    if (!next.landAuction && p.landAuction) fire('auction-close')

    // Deltas de construção/hipoteca (C2) — ação inferida pelo estado compartilhado.
    for (const [pos, cur] of Object.entries(next.titles)) {
      const before = p.titles[+pos]
      if (!before) continue
      if (cur.level > before.level) fire('build')
      else if (cur.level < before.level) fire('sell')
      if (cur.mortgaged && !before.mortgaged) fire('mortgage')
      else if (!cur.mortgaged && before.mortgaged) fire('unmortgage')
    }

    // — Canal 2: tail do log (por identidade de objeto; robusto ao shift de 50) —
    const log = game.log
    if (log.length && next.lastLog !== p.lastLog) {
      let start = 0
      if (p.lastLog) {
        const idx = log.lastIndexOf(p.lastLog)
        start = idx >= 0 ? idx + 1 : Math.max(0, log.length - 1) // fallback: só a última
      }
      for (let i = start; i < log.length; i++) {
        const cue = classifyLogEntry(log[i])
        if (cue) fire(cue)
      }
    }

    // — Canal 3: delta de caixa (ganhar ≠ perder dinheiro) —
    // Cobre movimentações SEM cue próprio (cartas de Tesouro/Acaso que pagam ou
    // cobram, trocas, credor recebendo dívida). Se qualquer cue de dinheiro já
    // tocou neste tick, o evento já foi sonorizado → silêncio (FR-007).
    if (!played.some((c) => MONEY_CUES.has(c))) {
      const gained = Object.entries(next.cash).some(([id, c]) => c > (p.cash[id] ?? c))
      const lost = Object.entries(next.cash).some(([id, c]) => c < (p.cash[id] ?? c))
      if (gained) fire('money-gain')
      else if (lost) fire('money-loss')
    }
  }, [game])

  return null
}
