// FR-003/SC-003 — mesma seed produz o MESMO resultado em execuções distintas (036/US2).
import { describe, expect, it } from 'vitest'
import { runGame } from './runGame'

// Timeout explícito pelo mesmo motivo que o `vitest.config.ts` exclui os lotes headless: são
// duas partidas COMPLETAS de 200 rodadas por caso, e no run generalista elas disputam CPU com
// ~130 outros arquivos. Sozinho o arquivo fecha em ~4,5s — colado no default de 5s, então uma
// máquina ocupada o derruba por relógio, não por resultado. Medido em 2026-07-29: a trava de
// contrapartida da 050 não mudou esse tempo (5,05s antes, 4,85s depois).
describe('determinismo por seed', () => {
  it.each([2, 3, 6])('roundtrip idêntico para %i jogadores', (playerCount) => {
    const a = runGame(20260705, playerCount, 200)
    const b = runGame(20260705, playerCount, 200)
    // durationMs é relógio de parede real (não faz parte do resultado determinístico)
    const { durationMs: _a, ...restA } = a
    const { durationMs: _b, ...restB } = b
    expect(restB).toEqual(restA)
  }, 60_000)
})
