// FR-003/SC-003 — mesma seed produz o MESMO resultado em execuções distintas (036/US2).
import { describe, expect, it } from 'vitest'
import { runGame } from './runGame'

describe('determinismo por seed', () => {
  it.each([2, 3, 6])('roundtrip idêntico para %i jogadores', (playerCount) => {
    const a = runGame(20260705, playerCount, 200)
    const b = runGame(20260705, playerCount, 200)
    // durationMs é relógio de parede real (não faz parte do resultado determinístico)
    const { durationMs: _a, ...restA } = a
    const { durationMs: _b, ...restB } = b
    expect(restB).toEqual(restA)
  })
})
