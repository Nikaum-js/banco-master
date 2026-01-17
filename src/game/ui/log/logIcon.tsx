// Ícone do log por `kind` (040/D-032, T029) — substitui `logEventIcon(what)` de
// `shared.tsx`, cujos 8 padrões (constru|hangar|hotel|arranha|vendeu, hipotec, leil, pote,
// fian) nunca disparavam: os eventos que os produziriam nunca eram logados (defeito 1).
// Fora de `shared.tsx` por lint, não estética — exportar não-componente de arquivo de
// componente reabre o aviso de `react-refresh` que a sessão de 2026-07-25 zerou (contrato §4).
import type { ReactNode } from 'react'
import type { LogEntry } from '@/game/economy/types'
import { CardGlyph } from '@/boards/glyphs/squares'
import { CoinIcon, DiceIcon, GavelIcon, HouseIcon, ShopIcon } from '@/game/ui/icons'

function assertNever(x: never): never {
  throw new Error(`LogKind não tratado pelo seletor de ícone: ${JSON.stringify(x)}`)
}

// Total sobre `LogKind` (FR-021/FR-024): todo `kind` tem ícone DECIDIDO — `'legacy'` é a
// única exceção, e por decisão explícita (dado velho, sem kind real por trás).
export function logIcon(kind: LogEntry['kind']): ReactNode {
  switch (kind) {
    case 'roll':
      return <DiceIcon size={11} />
    case 'buy':
    case 'trade':
      return <ShopIcon size={11} />
    case 'card-draw':
    case 'card-immediate':
      return <CardGlyph size={11} />
    case 'build':
    case 'build-hangar':
    case 'sell-building':
    case 'sell-hangar':
      return <HouseIcon size={11} />
    case 'smoke-tax':
      return <CoinIcon size={11} /> // D-072: somente log histórico
    case 'rail-hop':
      return <DiceIcon size={11} /> // D-070: é movimento, mesma família das jogadas
    case 'auction-won':
    case 'auction-unsold':
    case 'lot-won':
    case 'lot-unsold':
    case 'bankruptcy':
    case 'concede':
    case 'sell-to-bank':
    case 'hostile-takeover':
    case 'evict':
    case 'swap':
    case 'reaction-blocked': // 058/US2 — jogada de força: carta atravessou a mesa e mudou um destino
      return <GavelIcon size={11} />
    case 'go':
    case 'rent':
    case 'tax':
    case 'bus-ticket-gain':
    case 'mortgage':
    case 'unmortgage':
    case 'free-parking':
    case 'jail-fine':
    case 'debt-open':
    case 'debt-paid':
    case 'tax-man':
    case 'audit':
    case 'card-collect':
    case 'loan-interest':
    case 'loan-interest-short':
    case 'loan-due':
    case 'loan-due-short':
      return <CoinIcon size={11} />
    case 'legacy':
      return null // única exceção — decisão explícita, não omissão (FR-021)
    default:
      return assertNever(kind)
  }
}
