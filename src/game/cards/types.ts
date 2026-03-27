// Tipos do Sistema de Cartas (006). Módulo folha — não importa de turn/economy
// (evita ciclo: turn/types e economy/types importam DAQUI).

export type DeckId = 'acaso' | 'tesouro'
// 043, D-037/data-model §4 — id de carta e o slot que a representa numa perspectiva alheia:
// `null` = "há uma carta aqui, e ela não é minha". Nem cor, nem efeito, nem deck de origem
// além daquele em que está (FR-027) — `null` é `null`.
export type CardId = string
export type CardSlot = CardId | null
// Quatro níveis desde a D-075 (era três). A ordem aqui é a hierarquia: da mais rara para a
// mais comum. `epica` entrou NO MEIO — não no topo —, empurrando os dois níveis de baixo para
// cima: o que era rara virou épica, e o que era comum de 1 cópia virou rara.
export type Rarity = 'lendaria' | 'epica' | 'rara' | 'comum'
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
