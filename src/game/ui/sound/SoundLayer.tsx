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
import type { GameState } from '@/game/turn/types'
import type { LogEntry, Title } from '@/game/economy/types'

// "Nível" de construção de um título (soma para detectar build/sell por delta).
function buildLevel(t: Title): number {
  return t.houses + (t.hotel ? 1 : 0) + (t.hotel2 ? 1 : 0) + (t.skyscraper ? 1 : 0) + (t.hangar ? 1 : 0)
}

interface Prev {
  roll: GameState['turn']['lastRoll']
  resKind: string | null
  noticeKind: string | null
  jail: Record<string, boolean>
  phase: string
  loans: number
  landAuction: boolean
  landBids: number
  lastLog: LogEntry | null
  titles: Record<number, { level: number; mortgaged: boolean }>
}

function snapshotTitles(g: GameState): Record<number, { level: number; mortgaged: boolean }> {
  const out: Record<number, { level: number; mortgaged: boolean }> = {}
  for (const [pos, t] of Object.entries(g.titles)) out[+pos] = { level: buildLevel(t), mortgaged: t.mortgaged }
  return out
}

function snapshot(g: GameState): Prev {
  const jail: Record<string, boolean> = {}
  g.players.forEach((p) => (jail[p.id] = p.jail.inJail))
  return {
    roll: g.turn.lastRoll,
    resKind: g.resolution?.kind ?? null,
    noticeKind: g.notice?.kind ?? null,
    jail,
    phase: g.phase,
    loans: g.loans.length,
    landAuction: g.landAuction !== null,
    landBids: g.landAuction ? g.landAuction.lots.reduce((s, l) => s + (l.currentBid > 0 ? 1 : 0), 0) : 0,
    lastLog: g.log.length ? g.log[g.log.length - 1] : null,
    titles: snapshotTitles(g),
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

    // — Canal 1: transições tipadas —
    // Rolagem (objeto novo a cada rollDice).
    if (game.turn.lastRoll && game.turn.lastRoll !== p.roll) play(cueForRoll(game.turn.lastRoll))

    // Resolução (borda de subida do kind).
    if (game.resolution && game.resolution.kind !== p.resKind) {
      const cue = cueForResolution(game.resolution.kind)
      if (cue) play(cue)
    }

    // Notice (borda de subida).
    if (game.notice && game.notice.kind !== p.noticeKind) {
      const cue = cueForNotice(game.notice.kind)
      if (cue) play(cue)
    }

    // Prisão (entrar/sair) por jogador.
    for (const [id, inJail] of Object.entries(next.jail)) {
      const was = p.jail[id] ?? false
      if (inJail && !was) play('jail-in')
      else if (!inJail && was) play('jail-out')
    }

    // Fim de jogo.
    if (next.phase === 'ended' && p.phase !== 'ended') play('win')

    // Empréstimo concedido.
    if (next.loans > p.loans) play('loan-granted')

    // Pregão de terrenos: novo lance / fechamento.
    if (next.landAuction && next.landBids > p.landBids) play('auction-bid')
    if (!next.landAuction && p.landAuction) play('auction-close')

    // Deltas de construção/hipoteca (C2) — ação inferida pelo estado compartilhado.
    for (const [pos, cur] of Object.entries(next.titles)) {
      const before = p.titles[+pos]
      if (!before) continue
      if (cur.level > before.level) play('build')
      else if (cur.level < before.level) play('sell')
      if (cur.mortgaged && !before.mortgaged) play('mortgage')
      else if (!cur.mortgaged && before.mortgaged) play('unmortgage')
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
        if (cue) play(cue)
      }
    }
  }, [game])

  return null
}
