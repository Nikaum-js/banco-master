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

// PESO DE SAQUE POR CARTA — regido pela RARIDADE, com hierarquia SUAVE.
//
// Duas correções em cima do desenho original, e a segunda é sobre magnitude.
//
// 1. O EIXO. Antes o peso vinha do `mode`: `imediato` valia 14, carta de mão 1 ou 3. Boom
//    Econômico, que é RARA mas é evento imediato, pesava 14 — igual a uma comum. O sistema de
//    raridade da §10.2 promete hierarquia de chance e o peso entregava outra coisa.
//
// 2. A MAGNITUDE. A primeira tentativa usou 1 · 4 · 14, e isso é mão pesada demais: punha lendária
//    em 0,5%, ou seja 1 em 200 saques. Hierarquia não pede abismo, pede ORDEM.
//
// O teto honesto: com 2 lendárias em 18 cartas, peso IGUAL para todas já dá 5,6% por lendária. Se
// ela precisa ser a mais rara, fica necessariamente ABAIXO disso — não existe desenho em que
// lendária tenha 6% E seja a mais improvável, porque são poucas lendárias e muitas comuns. Então o
// alvo é encostar no valor de peso igual, não afundar: 9 · 10 · 11 manteve a ordem estrita com
// diferença de ~10% entre níveis vizinhos, e deixou lendária em 4,1% (Acaso) e 4,7% (Tesouro) —
// patamar que a escada de quatro degraus abaixo preserva.
//
// A intenção antiga ("evento é frequente, carta de mão é rara") sobrevive como CONSEQUÊNCIA, e não
// como causa: no catálogo toda comum é imediata e toda lendária é de mão.
//
// 3. O QUARTO DEGRAU (D-075). Com a entrada da ÉPICA a escala foi multiplicada por 10 — 9·10·11
//    viraria 9 · x · 10 · 11 e não há inteiro entre 9 e 10. Em escala de 100, os degraus antigos
//    seriam 90 · 100 · 110; os novos são 90 · 104 · 107 · 109.
//
// O que essa escolha faz, e é exatamente o pedido: a ÉPICA sobe (5,3% → 5,5% no Tesouro), RARA e
// COMUM cedem (5,8% → 5,6% e 11,6% → 11,5%), e a LENDÁRIA fica parada onde estava (4,7%).
//
// O ESPAÇAMENTO MÍNIMO É REQUISITO, não estética. A vitrine (spec 057) arredonda para UMA casa
// decimal, então dois níveis a menos de ~2 unidades de peso um do outro saem com o MESMO número na
// tela — e "épica e rara empatadas em 5,6%" é o mesmo defeito que a D-074 existe para curar, só
// que com outros dois níveis. Daí o degrau de 3 e 2 entre os de cima, e não de 1: o piso não é a
// ordem aritmética, é a ordem VISÍVEL.
export const RARITY_WEIGHT = { lendaria: 90, epica: 104, rara: 107, comum: 109 } as const

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
