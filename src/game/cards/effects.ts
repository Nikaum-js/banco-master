// Registry de efeitos de carta. Handlers MUTAM o estado (clone que o chamador detém).
// Handlers ausentes = efeitos DEFERIDOS (ofensivas/reação/temporários) → no-op seguro (FR-013).
//
// SIMPLIFICAÇÃO (006): cartas de movimento mudam a posição (e bônus de GO p/ frente),
// mas NÃO auto-resolvem a casa de destino — refinamento deferido (SRS §10.6 "resolve a casa").
import { BOARD } from '@/lib/boardData'
import type { Square, PropertySquare } from '@/lib/boardData'
import type { GameState, Player } from '../turn/types'
import type { TurnPorts } from '../turn/resolution'
import { advance, JAIL_POS } from '../turn/turnMachine'
import { buildCost, cityLevel, HANGAR_COST } from '../economy/construction'

type Handler = (state: GameState, playerId: string, ports: TurnPorts) => void

function priceOf(sq: Square): number {
  return 'price' in sq ? sq.price : 0
}

function pl(state: GameState, id: string): Player {
  return state.players.find((p) => p.id === id)!
}

// Patrimônio líquido (clarificação): caixa + preços (hipotecada ÷2) + custos de construção.
export function netWorth(state: GameState, playerId: string): number {
  let total = pl(state, playerId).cash
  for (const sq of BOARD) {
    const t = state.titles[sq.pos]
    if (!t || t.ownerId !== playerId) continue
    total += t.mortgaged ? Math.round(priceOf(sq) / 2) : priceOf(sq)
    if (sq.kind === 'property') {
      const units = cityLevel(t) // 0–7: casas/hotel/2º hotel/Skyscraper, cada nível = buildCost (011)
      total += units * buildCost(sq as PropertySquare)
    }
    if (sq.kind === 'airport' && t.hangar) total += HANGAR_COST // Hangar (011)
  }
  return total
}

const handlers: Record<string, Handler> = {
  boomEconomico: (s) => {
    for (const p of s.players) if (!p.eliminated) p.cash += 200
  },
  erroBanco: (s, id) => {
    pl(s, id).cash += 200
  },
  aniversario: (s, id) => {
    const me = pl(s, id)
    for (const p of s.players) {
      if (p.id !== id && !p.eliminated) {
        p.cash -= 50
        me.cash += 50
      }
    }
  },
  honorarios: (s, id, ports) => {
    pl(s, id).cash -= 50
    ports.onPayToCenter(s, 50)
  },
  criseImobiliaria: (s, _id, ports) => {
    for (const p of s.players) {
      if (p.eliminated) continue
      const amt = Math.round(netWorth(s, p.id) * 0.05)
      p.cash -= amt
      ports.onPayToCenter(s, amt)
    }
  },
  consertoImoveis: (s, id, ports) => {
    let total = 0
    for (const sq of BOARD) {
      const t = s.titles[sq.pos]
      if (sq.kind === 'property' && t?.ownerId === id) total += t.hotel ? 100 : t.houses * 25
    }
    if (total > 0) {
      pl(s, id).cash -= total
      ports.onPayToCenter(s, total)
    }
  },
  voltaGo: (s, id, ports) => {
    const p = pl(s, id)
    p.pos = 0
    p.cash += ports.onPassGo(s, p.id)
    p.completouPrimeiraVolta = true
  },
  vaPrisao: (s, id) => {
    const p = pl(s, id)
    p.pos = JAIL_POS
    p.jail = { inJail: true, attempts: 0 }
  },
  avance3: (s, id, ports) => advance(s, pl(s, id), 3, ports),
  volte3: (s, id) => {
    const p = pl(s, id)
    p.pos = (p.pos - 3 + 48) % 48 // ré: sem bônus de GO (SRS §10.6)
  },
  saiaPrisao: (s, id) => {
    pl(s, id).jail = { inJail: false, attempts: 0 }
  },
  investidorAnjo: (s, id) => {
    pl(s, id).nextPurchaseDiscount = 0.2
  },
  passagemOnibus: (s, id) => {
    pl(s, id).busTickets += 1
  },
  refinanciamento: (s, id) => {
    const p = pl(s, id)
    const sq = BOARD.find((b) => 'price' in b && s.titles[b.pos]?.ownerId === id && s.titles[b.pos]?.mortgaged)
    if (!sq) return // sem hipoteca → no-op (§10.6 nota)
    const cost = Math.round(Math.round(priceOf(sq) / 2) * 1.05) // deshipoteca a 5% (em vez de 10%)
    if (p.cash < cost) return
    p.cash -= cost
    s.titles[sq.pos].mortgaged = false
  },
}

// Aplica o efeito da carta. Efeito deferido (sem handler) = no-op seguro.
export function applyEffect(effect: string, state: GameState, playerId: string, ports: TurnPorts): void {
  handlers[effect]?.(state, playerId, ports)
}

export function isImplemented(effect: string): boolean {
  return effect in handlers
}
