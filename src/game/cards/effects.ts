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
import { addTempEffect } from '../economy/tempEffects'
import { chargePlayer } from '../economy/obligation'
import { logEvent } from '../log'

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
  boomEconomico: (s, id) => {
    for (const p of s.players) {
      if (p.eliminated) continue
      p.cash += 200
      // `card-immediate` registra só o delta de QUEM SACOU; sem esta linha os demais recebiam
      // $200 sem nenhum fato no histórico (D-063).
      if (p.id !== id) logEvent(s, { kind: 'card-collect', who: p.id, name: 'Boom Economico', delta: 200, counterpartId: 'bank' })
    }
  },
  erroBanco: (s, id) => {
    pl(s, id).cash += 200
  },
  // §10.6/D-061 — o credor é um JOGADOR, então a obrigação NÃO trunca: cada adversário paga o
  // que tem e o restante fica devido, entrando no fluxo de dívida do §9.1 (fora da vez dele).
  //
  // Antes desta decisão isto era `Math.min(50, p.cash)` e a diferença simplesmente deixava de
  // existir: um adversário com $43 entregava $43 e os $7 evaporavam — não iam ao banco, não
  // ficavam devidos. O aniversariante recebia menos do que a carta prometia e nada na tela
  // explicava por quê. A truncagem estava documentada (FR-004a da 036) como forma de garantir
  // "sem saldo negativo fora do fluxo de dívida"; a garantia era boa, o MEIO estava errado.
  aniversario: (s, id) => {
    for (const p of s.players) {
      if (p.id === id || p.eliminated) continue
      const paid = chargePlayer(s, p.id, id, 50, 'obligation')
      if (paid > 0) logEvent(s, { kind: 'card-collect', who: p.id, name: 'Aniversario', delta: -paid, counterpartId: id })
    }
  },
  honorarios: (s, id, ports) => {
    const p = pl(s, id)
    const paid = Math.min(50, p.cash)
    p.cash -= paid
    ports.onPayToCenter(s, paid)
  },
  // Credor é o POTE, não um jogador: truncagem MANTIDA por decisão explícita (§9.1/D-061) —
  // ninguém é privado de receita a que a regra lhe deu direito, e cobrança incondicional que
  // pode falir transforma azar em eliminação. O que mudou é que os OUTROS jogadores deixam de
  // pagar em silêncio (D-063).
  criseImobiliaria: (s, id, ports) => {
    for (const p of s.players) {
      if (p.eliminated) continue
      const owed = Math.round(netWorth(s, p.id) * 0.05)
      const paid = Math.min(owed, p.cash)
      p.cash -= paid
      ports.onPayToCenter(s, paid)
      if (p.id !== id && paid > 0) {
        logEvent(s, { kind: 'card-collect', who: p.id, name: 'Crise Imobiliaria', delta: -paid, counterpartId: 'bank' })
      }
    }
  },
  consertoImoveis: (s, id, ports) => {
    let total = 0
    for (const sq of BOARD) {
      const t = s.titles[sq.pos]
      if (sq.kind === 'property' && t?.ownerId === id) total += t.hotel ? 100 : t.houses * 25
    }
    if (total > 0) {
      const p = pl(s, id)
      const paid = Math.min(total, p.cash)
      p.cash -= paid
      ports.onPayToCenter(s, paid)
    }
  },
  voltaGo: (s, id, ports) => {
    const p = pl(s, id)
    p.pos = 0
    p.cash += ports.onPassGo(s, p.id) * 2 // cai exatamente no GO → $400 (2×)
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
  apagao: (s, id) => {
    addTempEffect(s, { kind: 'apagao', ownerId: id, pos: null, lapsRemaining: 1 }) // Hangares inativos 1 volta (§10.6)
  },
  greveUtilidades: (s, id) => {
    addTempEffect(s, { kind: 'greve', ownerId: id, pos: null, lapsRemaining: 1 }) // utilidades sem aluguel 1 volta
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
