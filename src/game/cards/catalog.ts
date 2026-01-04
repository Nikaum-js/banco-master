// Catálogo das 39 cartas (dado estático). Composição segue SRS §10.4-10.5 (v1.26, D-064).
//
// RARIDADE É PROBABILIDADE, NÃO RÓTULO (D-074). Até esta revisão as `copies` contrariavam o
// próprio sistema de raridade: Boom Econômico e Bunker Fiscal (RARAS, 2 cópias) saíam a 11,1%,
// o DOBRO de Diplomacia e Imunidade (LENDÁRIAS, 1 cópia); e no Acaso a Aquisição Hostil, lendária
// com 2 cópias, era a carta MAIS provável do baralho. O sistema da §10.2 prometia hierarquia e o
// dado entregava o inverso — a vitrine de probabilidades (spec 057) só tornou visível.
//
// A regra agora: nenhuma carta pode ser mais provável que uma de nível MAIS RARO. Ordenação
// estrita entre os três níveis é aritmeticamente impossível com os tamanhos fixos de baralho
// (exigiria lendária 1 · rara 2 · comum 3 = 34 cartas no Tesouro, contra as 18 do SRS), então
// lendárias e raras ficam todas em 1 cópia e o excedente vai para as COMUNS. Empate entre
// lendária e rara é aceito; inversão, não.
//
// As comuns duplicadas foram escolhidas entre as de menor peso decisório (movimento e caixa
// pequeno) justamente para a duplicação não distorcer estratégia: Atalho, Avance 3 e Volte 3 no
// Acaso; Investidor Anjo, Bilhete, Erro do Banco e Aniversário no Tesouro.
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

// — Deck ACASO (21) —
const ACASO: CardDef[] = [
  { base: 'aquisicao-hostil', copies: 1, deck: 'acaso', rarity: 'lendaria', mode: 'mao', timing: 'proprio-turno', effect: 'aquisicaoHostil', status: 'implementado' },
  { base: 'confisco-geral', copies: 1, deck: 'acaso', rarity: 'lendaria', mode: 'mao', timing: 'proprio-turno', effect: 'confiscoGeral', status: 'implementado' },
  { base: 'imposto-federal', copies: 1, deck: 'acaso', rarity: 'lendaria', mode: 'mao', timing: 'proprio-turno', effect: 'impostoFederal', status: 'implementado' },
  { base: 'permuta-forcada', copies: 1, deck: 'acaso', rarity: 'lendaria', mode: 'mao', timing: 'proprio-turno', effect: 'permutaForcada', status: 'implementado' },
  { base: 'boicote', copies: 1, deck: 'acaso', rarity: 'rara', mode: 'mao', timing: 'proprio-turno', effect: 'boicote', status: 'implementado' },
  { base: 'embargo-obras', copies: 1, deck: 'acaso', rarity: 'rara', mode: 'mao', timing: 'proprio-turno', effect: 'embargoDeObras', status: 'implementado' },
  { base: 'crise-imobiliaria', copies: 1, deck: 'acaso', rarity: 'rara', mode: 'imediato', timing: null, effect: 'criseImobiliaria', status: 'implementado' },
  { base: 'estatizacao', copies: 1, deck: 'acaso', rarity: 'rara', mode: 'imediato', timing: null, effect: 'estatizacao', status: 'implementado' },
  { base: 'atalho', copies: 2, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'atalho', status: 'implementado' },
  { base: 'greve', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'greve', status: 'implementado' },
  { base: 'desvalorizacao-cambial', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'desvalorizacaoCambial', status: 'implementado' },
  { base: 'obras-na-pista', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'obrasNaPista', status: 'implementado' },
  { base: 'multa-ambiental', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'multaAmbiental', status: 'implementado' },
  { base: 'va-prisao', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'vaPrisao', status: 'implementado' },
  { base: 'volta-go', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'voltaGo', status: 'implementado' },
  { base: 'conserto-imoveis', copies: 1, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'consertoImoveis', status: 'implementado' },
  { base: 'avance-3', copies: 2, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'avance3', status: 'implementado' },
  { base: 'volte-3', copies: 2, deck: 'acaso', rarity: 'comum', mode: 'imediato', timing: null, effect: 'volte3', status: 'implementado' },
]

// — Deck TESOURO (18) —
const TESOURO: CardDef[] = [
  { base: 'diplomacia', copies: 1, deck: 'tesouro', rarity: 'lendaria', mode: 'mao', timing: 'reacao', effect: 'diplomacia', status: 'implementado' },
  { base: 'imunidade', copies: 1, deck: 'tesouro', rarity: 'lendaria', mode: 'mao', timing: 'proprio-turno', effect: 'imunidade', status: 'implementado' },
  { base: 'saia-prisao', copies: 1, deck: 'tesouro', rarity: 'rara', mode: 'mao', timing: 'preso', effect: 'saiaPrisao', status: 'implementado' },
  { base: 'bunker-fiscal', copies: 1, deck: 'tesouro', rarity: 'rara', mode: 'mao', timing: 'reacao', effect: 'bunkerFiscal', status: 'implementado' },
  { base: 'boom-economico', copies: 1, deck: 'tesouro', rarity: 'rara', mode: 'imediato', timing: null, effect: 'boomEconomico', status: 'implementado' },
  { base: 'valorizacao', copies: 1, deck: 'tesouro', rarity: 'rara', mode: 'mao', timing: 'proprio-turno', effect: 'valorizacao', status: 'implementado' },
  { base: 'investidor-anjo', copies: 2, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'investidorAnjo', status: 'implementado' },
  { base: 'passagem-onibus', copies: 2, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'passagemOnibus', status: 'implementado' },
  { base: 'resgate-pote', copies: 1, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'resgateDoPote', status: 'implementado' },
  { base: 'obra-relampago', copies: 1, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'obraRelampago', status: 'implementado' },
  { base: 'incentivo-fiscal', copies: 1, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'incentivoFiscal', status: 'implementado' },
  { base: 'erro-banco', copies: 2, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'erroBanco', status: 'implementado' },
  { base: 'aniversario', copies: 2, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'aniversario', status: 'implementado' },
  { base: 'honorarios', copies: 1, deck: 'tesouro', rarity: 'comum', mode: 'imediato', timing: null, effect: 'honorarios', status: 'implementado' },
]

/** As DEFINIÇÕES do catálogo, antes de `expand()` desagregar as cópias (spec 057).
 *
 * É esta a fonte da composição do baralho — quantas cópias de cada efeito existem. A vitrine
 * de probabilidades precisa disso, e reconstruí-la a partir de `CARDS` seria agrupar de volta
 * o que o próprio módulo acabou de desagregar: uma inferência que pode discordar da definição
 * em silêncio. Exportar a definição custa uma linha e não tem como divergir de si mesma. */
export const CARD_DEFS: readonly CardDef[] = [...ACASO, ...TESOURO]

export type { CardDef }

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
