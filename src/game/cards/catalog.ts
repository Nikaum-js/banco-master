// Catálogo das 32 cartas (dado estático). Composição segue SRS §10.4-10.5.
// Cópias geram ids com sufixo. `effect` é a chave no registry de effects.ts.
import type { Card, DeckId, Rarity, CardMode, Timing } from './types'

interface CardDef {
  base: string
  copies: number
  deck: DeckId
  rarity: Rarity
  mode: CardMode
  timing: Timing | null
  effect: string
  status: 'implementado' | 'deferido'
}

// — Deck ACASO (16) —
const ACASO: CardDef[] = [
  { base: 'aquisicao-hostil', copies: 2, deck: 'acaso', rarity: 'lendaria', mode: 'mao', timing: 'proprio-turno', effect: 'aquisicaoHostil', status: 'deferido' },
  { base: 'despejo', copies: 1, deck: 'acaso', rarity: 'lendaria', mode: 'mao', timing: 'proprio-turno', effect: 'despejo', status: 'deferido' },
  { base: 'auditoria-fiscal', copies: 1, deck: 'acaso', rarity: 'lendaria', mode: 'mao', timing: 'proprio-turno', effect: 'auditoriaFiscal', status: 'deferido' },
  { base: 'boicote', copies: 2, deck: 'acaso', rarity: 'rara', mode: 'mao', timing: 'proprio-turno', effect: 'boicote', status: 'deferido' },
  { base: 'crise-imobiliaria', copies: 1, deck: 'acaso', rarity: 'rara', mode: 'imediato', timing: null, effect: 'criseImobiliaria', status: 'implementado' },
  { base: 'atalho', copies: 2, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'atalho', status: 'implementado' },
  { base: 'apagao', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'apagao', status: 'deferido' },
  { base: 'greve-utilidades', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'greveUtilidades', status: 'deferido' },
  { base: 'va-prisao', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'vaPrisao', status: 'implementado' },
  { base: 'volta-go', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'voltaGo', status: 'implementado' },
  { base: 'conserto-imoveis', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'consertoImoveis', status: 'implementado' },
  { base: 'avance-3', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'avance3', status: 'implementado' },
  { base: 'volte-3', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'volte3', status: 'implementado' },
]

// — Deck TESOURO (16) —
const TESOURO: CardDef[] = [
  { base: 'diplomacia', copies: 1, deck: 'tesouro', rarity: 'lendaria', mode: 'mao', timing: 'reacao', effect: 'diplomacia', status: 'deferido' },
  { base: 'imunidade', copies: 1, deck: 'tesouro', rarity: 'lendaria', mode: 'mao', timing: 'proprio-turno', effect: 'imunidade', status: 'deferido' },
  { base: 'saia-prisao', copies: 1, deck: 'tesouro', rarity: 'rara', mode: 'mao', timing: 'preso', effect: 'saiaPrisao', status: 'implementado' },
  { base: 'bunker-fiscal', copies: 2, deck: 'tesouro', rarity: 'rara', mode: 'mao', timing: 'reacao', effect: 'bunkerFiscal', status: 'deferido' },
  { base: 'boom-economico', copies: 2, deck: 'tesouro', rarity: 'rara', mode: 'imediato', timing: null, effect: 'boomEconomico', status: 'implementado' },
  { base: 'investidor-anjo', copies: 2, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'investidorAnjo', status: 'implementado' },
  { base: 'refinanciamento', copies: 2, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'refinanciamento', status: 'implementado' },
  { base: 'passagem-onibus', copies: 2, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'passagemOnibus', status: 'implementado' },
  { base: 'erro-banco', copies: 1, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'erroBanco', status: 'implementado' },
  { base: 'aniversario', copies: 1, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'aniversario', status: 'implementado' },
  { base: 'honorarios', copies: 1, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'honorarios', status: 'implementado' },
]

function expand(defs: CardDef[]): Card[] {
  const out: Card[] = []
  for (const d of defs) {
    for (let i = 1; i <= d.copies; i++) {
      out.push({ id: `${d.base}-${i}`, deck: d.deck, rarity: d.rarity, mode: d.mode, timing: d.timing, effect: d.effect, status: d.status })
    }
  }
  return out
}

export const CARDS: Card[] = [...expand(ACASO), ...expand(TESOURO)]

const BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]))

export function cardById(id: string): Card {
  return BY_ID[id]
}

export function deckCardIds(deck: DeckId): string[] {
  return CARDS.filter((c) => c.deck === deck).map((c) => c.id)
}
