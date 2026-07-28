// Projeção de áudio (spec 035): transforma uma sequência de snapshots do jogo em
// cues sem depender de React nem Web Audio. O estado anterior fica encapsulado no
// projector; a interface pública é uma única operação incremental.
import type { SoundCue } from './cues'
import {
  classifyLogEntry,
  countNewLogEntries,
  cueForNotice,
  cueForResolution,
  cueForRoll,
  logKey,
} from './classify'
import type { Title } from '@/game/economy/types'
import type { GameState } from '@/game/turn/types'

// Cues que JÁ sonorizam uma movimentação de dinheiro. Se algum foi projetado no
// tick, o canal de delta de caixa fica mudo (evita dobrar som, FR-007).
const MONEY_CUES: ReadonlySet<SoundCue> = new Set([
  'buy', 'sell', 'build', 'mortgage', 'unmortgage', 'rent-paid', 'tax-paid',
  'go-bonus', 'free-parking', 'loan-granted', 'loan-interest', 'debt',
  'auction-close', 'bankruptcy', 'hostile-takeover', 'jail-out', 'win',
])

function buildLevel(title: Title): number {
  return title.houses
    + (title.hotel ? 1 : 0)
    + (title.hotel2 ? 1 : 0)
    + (title.skyscraper ? 1 : 0)
    + (title.hangar ? 1 : 0)
}

// O motor clona o GameState inteiro a cada ação. A projeção guarda somente
// primitivos e chaves derivadas; identidade de objeto nunca participa do diff.
interface SoundSnapshot {
  seat: number
  resolutionKind: string | null
  noticeKind: string | null
  jail: Record<string, boolean>
  phase: string
  loans: number
  landAuction: boolean
  landBids: number
  logKeys: string[]
  titles: Record<number, { level: number; mortgaged: boolean }>
  cash: Record<string, number>
}

function snapshotTitles(game: GameState): SoundSnapshot['titles'] {
  const titles: SoundSnapshot['titles'] = {}
  for (const [pos, title] of Object.entries(game.titles)) {
    titles[+pos] = { level: buildLevel(title), mortgaged: title.mortgaged }
  }
  return titles
}

function snapshot(game: GameState): SoundSnapshot {
  const jail: Record<string, boolean> = {}
  const cash: Record<string, number> = {}
  for (const player of game.players) {
    jail[player.id] = player.jail.inJail
    cash[player.id] = player.cash
  }
  return {
    seat: game.turn.seat,
    resolutionKind: game.resolution?.kind ?? null,
    noticeKind: game.notice?.kind ?? null,
    jail,
    phase: game.phase,
    loans: game.loans.length,
    landAuction: game.landAuction !== null,
    landBids: game.landAuction?.lots.reduce((sum, lot) => sum + (lot.currentBid > 0 ? 1 : 0), 0) ?? 0,
    logKeys: game.log.map(logKey),
    titles: snapshotTitles(game),
    cash,
  }
}

export interface SoundProjector {
  project(game: GameState): SoundCue[]
}

export function createSoundProjector(): SoundProjector {
  let previous: SoundSnapshot | null = null

  return {
    project(game) {
      const next = snapshot(game)
      const before = previous
      previous = next
      if (before === null) return [] // reconexão/mount: snapshot sem replay (FR-011)

      const cues: SoundCue[] = []
      const emit = (cue: SoundCue) => cues.push(cue)

      if (game.resolution && game.resolution.kind !== before.resolutionKind) {
        const cue = cueForResolution(game.resolution.kind)
        if (cue) emit(cue)
      }

      if (game.notice && game.notice.kind !== before.noticeKind) {
        const cue = cueForNotice(game.notice.kind)
        if (cue) emit(cue)
      }

      for (const [id, inJail] of Object.entries(next.jail)) {
        const wasInJail = before.jail[id] ?? false
        if (inJail && !wasInJail) emit('jail-in')
        else if (!inJail && wasInJail) emit('jail-out')
      }

      if (next.phase === 'ended' && before.phase !== 'ended') emit('win')
      if (next.loans > before.loans) emit('loan-granted')
      if (next.landAuction && next.landBids > before.landBids) emit('auction-bid')
      if (!next.landAuction && before.landAuction) emit('auction-close')

      for (const [pos, current] of Object.entries(next.titles)) {
        const prior = before.titles[+pos]
        if (!prior) continue
        if (current.level > prior.level) emit('build')
        else if (current.level < prior.level) emit('sell')
        if (current.mortgaged && !prior.mortgaged) emit('mortgage')
        else if (!current.mortgaged && prior.mortgaged) emit('unmortgage')
      }

      const freshLogEntries = countNewLogEntries(before.logKeys, next.logKeys)
      for (let index = game.log.length - freshLogEntries; index < game.log.length; index++) {
        const entry = game.log[index]
        if (entry.kind === 'roll') {
          if (game.turn.lastRoll) emit(cueForRoll(game.turn.lastRoll))
          continue
        }
        const cue = classifyLogEntry(entry)
        if (cue) emit(cue)
      }

      if (!cues.some((cue) => MONEY_CUES.has(cue))) {
        const gained = Object.entries(next.cash).some(([id, cash]) => cash > (before.cash[id] ?? cash))
        const lost = Object.entries(next.cash).some(([id, cash]) => cash < (before.cash[id] ?? cash))
        if (gained) emit('money-gain')
        else if (lost) emit('money-loss')
      }

      // TODO(multiplayer): projetar também 'your-turn' no cliente cujo assento
      // local seja `next.seat` quando essa identidade estiver no estado da UI.
      if (next.seat !== before.seat && next.phase !== 'ended' && cues.length === 0) emit('turn-end')

      return cues
    },
  }
}
