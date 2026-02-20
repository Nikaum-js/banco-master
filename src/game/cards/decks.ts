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

// Peso de saque por carta: EVENTOS (imediatos) saem com frequência; cartas de MÃO
// são raras (e lendárias raríssimas). Quanto maior o peso, mais cedo tende a sair.
function cardWeight(id: string): number {
  const c = cardById(id)
  if (c.mode === 'imediato') return 14 // evento — comum no saque
  return c.rarity === 'lendaria' ? 1 : 3 // carta de mão: rara; lendária raríssima
}

// Embaralhamento PONDERADO (Efraimidis–Spirakis): a chave de cada carta é
// rng()^(1/peso). Eventos (peso alto) tendem ao topo; cartas de mão tendem ao fundo
// → o jogador pega muito mais EVENTO do que carta, sem mudar a composição do deck.
export function weightedShuffle(ids: string[], rng: RNG): string[] {
  return ids
    .map((id) => ({ id, key: Math.pow(rng() || 1e-9, 1 / cardWeight(id)) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.id)
}
