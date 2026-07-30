// Registry de efeitos de carta. Handlers MUTAM o estado (clone que o chamador detém).
// Handlers ausentes = efeitos DEFERIDOS (ofensivas/reação/temporários) → no-op seguro (FR-013).
//
// SIMPLIFICAÇÃO (006): cartas de movimento mudam a posição (e bônus de GO p/ frente),
// mas NÃO auto-resolvem a casa de destino — refinamento deferido (SRS §10.6 "resolve a casa").
import { BOARD, boardSize, jailPos } from '@/lib/boardData'
import type { Square, PropertySquare } from '@/lib/boardData'
import type { GameState, Player } from '../turn/types'
import type { TurnPorts } from '../turn/resolution'
import { advance } from '../turn/turnMachine'
import { buildCost, cityLevel, HANGAR_COST } from '../economy/construction'
import { addTempEffect, isPlayerImmune } from '../economy/tempEffects'
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
      if (p.id !== id) logEvent(s, { kind: 'card-collect', who: p.id, name: 'Boom Economico', delta: 200, due: 200, counterpartId: 'bank' })
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
      if (isPlayerImmune(s, p.id)) continue // Imunidade Total (D-064): não é alvo de cobrança de carta alheia
      const paid = chargePlayer(s, p.id, id, 50, 'obligation')
      if (paid > 0) logEvent(s, { kind: 'card-collect', who: p.id, name: 'Aniversario', delta: -paid, due: 50, counterpartId: id })
    }
  },
  honorarios: (s, id, ports) => {
    if (isPlayerImmune(s, id)) return // Imunidade Total (D-064): imposto algum
    const p = pl(s, id)
    const paid = Math.min(50, p.cash)
    p.cash -= paid
    ports.onPayToCenter(s, paid)
  },
  // Credor é o POTE, não um jogador: truncagem MANTIDA por decisão explícita (§9.1/D-061) —
  // ninguém é privado de receita a que a regra lhe deu direito, e cobrança incondicional que
  // pode falir transforma azar em eliminação. O que mudou é que os OUTROS jogadores deixam de
  // pagar em silêncio (D-063).
  //
  // D-064: quem SACOU não paga (o azar já foi dele) e a alíquota subiu de 5% para 10%.
  criseImobiliaria: (s, id, ports) => {
    for (const p of s.players) {
      if (p.id === id || p.eliminated) continue
      if (isPlayerImmune(s, p.id)) continue // Imunidade Total (D-064)
      const owed = Math.round(netWorth(s, p.id) * 0.1)
      const paid = Math.min(owed, p.cash)
      p.cash -= paid
      ports.onPayToCenter(s, paid)
      if (paid > 0) logEvent(s, { kind: 'card-collect', who: p.id, name: 'Crise Imobiliaria', delta: -paid, due: owed, counterpartId: 'bank' })
    }
  },
  consertoImoveis: (s, id, ports) => {
    if (isPlayerImmune(s, id)) return // Imunidade Total (D-064)
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
  // D-064 — Desvalorização Cambial: 10% do CAIXA (não do patrimônio) à Loteria.
  desvalorizacaoCambial: (s, id, ports) => {
    if (isPlayerImmune(s, id)) return
    const p = pl(s, id)
    const paid = Math.round(p.cash * 0.1)
    p.cash -= paid
    ports.onPayToCenter(s, paid)
  },
  // D-064 — Multa Ambiental: $50 + $50 por hotel/2º hotel/arranha-céu, à Loteria.
  multaAmbiental: (s, id, ports) => {
    if (isPlayerImmune(s, id)) return
    let units = 0
    for (const sq of BOARD) {
      const t = s.titles[sq.pos]
      if (sq.kind !== 'property' || t?.ownerId !== id) continue
      units += (t.hotel ? 1 : 0) + (t.hotel2 ? 1 : 0) + (t.skyscraper ? 1 : 0)
    }
    const p = pl(s, id)
    const paid = Math.min(50 + units * 50, p.cash)
    p.cash -= paid
    ports.onPayToCenter(s, paid)
  },
  // D-064 — Resgate do Pote: metade da Loteria (piso), o resto permanece.
  resgateDoPote: (s, id) => {
    const half = Math.floor(s.centerPot / 2)
    s.centerPot -= half
    pl(s, id).cash += half
  },
  // D-064 — Incentivo Fiscal: $50 por propriedade hipotecada (alívio de quem está mal).
  incentivoFiscal: (s, id) => {
    const n = BOARD.filter((sq) => 'price' in sq && s.titles[sq.pos]?.ownerId === id && s.titles[sq.pos]?.mortgaged).length
    pl(s, id).cash += n * 50
  },
  // D-064 — Obra Relâmpago: a próxima construção (casa/hotel/arranha-céu/Hangar) sai grátis.
  obraRelampago: (s, id) => {
    pl(s, id).nextBuildFree = true
  },
  // D-064 — Obras na Pista: vai ao aeroporto mais próximo à frente (credita GO ao cruzar);
  // o pouso resolve como movimento de carta (cardResolve) e o aluguel, se houver, é DOBRADO.
  obrasNaPista: (s, id, ports) => {
    const p = pl(s, id)
    const steps = BOARD.filter((sq) => sq.kind === 'airport')
      .map((sq) => (sq.pos - p.pos + BOARD.length) % BOARD.length)
      .filter((d) => d > 0)
      .reduce((a, b) => Math.min(a, b))
    p.doubleRentOnce = true // consumido (ou descartado) na resolução do pouso
    advance(s, p, steps, ports)
  },
  voltaGo: (s, id, ports) => {
    const p = pl(s, id)
    p.pos = 0
    p.cash += ports.onPassGo(s, p.id) * 2 // cai exatamente no GO → $400 (2×)
    p.completouPrimeiraVolta = true
  },
  vaPrisao: (s, id) => {
    const p = pl(s, id)
    p.pos = jailPos()
    p.jail = { inJail: true, attempts: 0 }
  },
  avance3: (s, id, ports) => advance(s, pl(s, id), 3, ports),
  volte3: (s, id) => {
    const p = pl(s, id)
    p.pos = (p.pos - 3 + boardSize()) % boardSize() // ré: sem bônus de GO (SRS §10.6)
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
  // D-064 — Greve (funde Apagão + Greve nas Utilidades): os DOIS efeitos por 1 volta.
  // Registra os dois kinds existentes — consumidores (resolveRentable/taxMan) inalterados.
  greve: (s, id) => {
    addTempEffect(s, { kind: 'apagao', ownerId: id, pos: null, lapsRemaining: 1 }) // Hangares inativos (§10.6)
    addTempEffect(s, { kind: 'greve', ownerId: id, pos: null, lapsRemaining: 1 }) // utilidades sem aluguel
  },
  // D-064 — Estatização: por 2 voltas, todo aluguel da mesa vai à Loteria (resolveRentable).
  estatizacao: (s, id) => {
    addTempEffect(s, { kind: 'estatizacao', ownerId: id, pos: null, lapsRemaining: 2 })
  },
}

// Aplica o efeito da carta. Efeito deferido (sem handler) = no-op seguro.
export function applyEffect(effect: string, state: GameState, playerId: string, ports: TurnPorts): void {
  handlers[effect]?.(state, playerId, ports)
}
