// Embaralhamento de deck — Fisher-Yates com RNG injetável (determinístico nos testes).
import type { RNG } from '../turn/dice'
import { cardById } from './catalog'

export function shuffle(ids: string[], rng: RNG): string[] {
  const a = ids.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

// PESO DE SAQUE POR CARTA — regido pela RARIDADE, e é isso que faz o rótulo valer.
//
// Antes o peso era regido pelo `mode`: `imediato` valia 14, e carta de mão valia 1 (lendária) ou
// 3. Consequência: Boom Econômico, que é RARA mas é evento imediato, pesava 14 — igual a uma
// comum. O sistema de raridade da §10.2 promete hierarquia de chance e o peso entregava outra
// coisa, então "Rara" e "Comum" apareciam com a mesma probabilidade.
//
// Agora a raridade é o eixo único: lendária sai menos que rara, que sai menos que comum, para
// TODA carta, sem exceção por modo. O efeito prático de "evento é comum, carta de mão é rara"
// continua valendo, porque no catálogo todas as comuns são imediatas e todas as lendárias são de
// mão — a intenção antiga sobrevive como consequência, em vez de ser a causa.
export const RARITY_WEIGHT = { lendaria: 1, rara: 4, comum: 14 } as const

export function cardWeight(id: string): number {
  return RARITY_WEIGHT[cardById(id).rarity]
}

// Embaralhamento PONDERADO (Efraimidis–Spirakis): a chave de cada carta é
// rng()^(1/peso). Comuns tendem ao topo; raras e lendárias tendem ao fundo, sem mudar
// a composição do deck.
export function weightedShuffle(ids: string[], rng: RNG): string[] {
  return ids
    .map((id) => ({ id, key: Math.pow(rng() || 1e-9, 1 / cardWeight(id)) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.id)
}
