// Curva de patrimônio da simulação (item 3 do backlog da auditoria).
//
// Por que existe: o `report.ts` contava MECANISMOS (quantas vezes o aluguel rodou), o que prova
// que o motor foi exercitado mas não diz nada sobre o FORMATO da partida. Duas perguntas abertas
// dependem desse formato:
//   • princípio IV (catch-up é discreto) — se quem lidera na metade da partida vence quase
//     sempre, o catch-up não está discreto, está ausente;
//   • o espólio da 039 (D-031) favorece quem tem caixa, ou seja, empurra CONTRA o catch-up.
//
// A medida do patrimônio é `netWorth` de `@/game/cards/effects` — a MESMA que a Auditoria Fiscal
// cobra em jogo. Uma fórmula paralela aqui mediria uma economia que não é a do produto.
import { netWorth } from '@/game/cards/effects'
import type { GameState } from '@/game/turn/types'

/** Patrimônio de todos os jogadores ao fim de uma rodada. Ordem = `game.players` (p1..pN). */
export interface WealthSample {
  round: number
  netWorth: number[]
}

export function sampleWealth(game: GameState, round: number): WealthSample {
  return { round, netWorth: game.players.map((p) => netWorth(game, p.id)) }
}

/**
 * Gini do patrimônio: 0 = todos iguais, → 1 = tudo num jogador. É a medida de CONCENTRAÇÃO;
 * a subida dela ao longo da partida é o efeito bola-de-neve que o princípio IV quer contido.
 *
 * Definição usada (a de sempre, sobre a média das diferenças absolutas):
 *   G = Σᵢ Σⱼ |xᵢ - xⱼ| / (2 n² μ)
 *
 * Eliminado entra como 0 e isso é proposital: ele faz parte da distribuição da mesa. Sem ele o
 * Gini CAIRIA a cada eliminação, exatamente quando a mesa ficou mais desigual.
 */
export function gini(values: number[]): number {
  const n = values.length
  if (n === 0) return 0
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0 // mesa toda zerada: não há desigualdade a medir
  let sumDiff = 0
  for (const a of values) for (const b of values) sumDiff += Math.abs(a - b)
  return sumDiff / (2 * n * total) // 2n²μ, com μ = total/n
}

/** Fatia do patrimônio total na mão do líder (1/n = mesa perfeitamente igual, 1 = monopólio). */
export function leaderShare(values: number[]): number {
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  return Math.max(...values) / total
}

/** Índice do líder; -1 se a mesa está zerada. Empate resolve pelo primeiro (determinístico). */
export function leaderIndex(values: number[]): number {
  let best = -1
  let bestVal = 0
  for (const [i, v] of values.entries()) {
    if (v > bestVal) {
      bestVal = v
      best = i
    }
  }
  return best
}

/**
 * Amostra do decil `d` (1..10) de PROGRESSO da partida — não da rodada absoluta.
 *
 * A normalização é o que torna partidas de 40 e de 900 rodadas comparáveis: "decil 10" é o fim
 * de jogo das duas. Sem isso, uma média por rodada absoluta seria dominada pelas partidas longas
 * justamente na faixa que interessa (o fim).
 */
export function sampleAtDecile(samples: WealthSample[], decile: number): WealthSample | null {
  if (samples.length === 0) return null
  const idx = Math.ceil((decile / 10) * samples.length) - 1
  return samples[Math.max(0, Math.min(idx, samples.length - 1))]
}
