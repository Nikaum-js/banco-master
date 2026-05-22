// Tipos do Sistema de Cartas (006). Módulo folha — não importa de turn/economy
// (evita ciclo: turn/types e economy/types importam DAQUI).

export type DeckId = 'acaso' | 'tesouro'
export type Rarity = 'lendaria' | 'rara' | 'comum'
export type CardMode = 'imediato' | 'mao'
export type Timing = 'proprio-turno' | 'reacao' | 'preso'
export type EffectId = string // chave no registry de efeitos

export interface Card {
  id: string // único (cópias recebem sufixo: aquisicao-hostil-1)
  deck: DeckId
  rarity: Rarity
  mode: CardMode
  timing: Timing | null // só para cartas de mão
  effect: EffectId
  status: 'implementado' | 'deferido'
}
