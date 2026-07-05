// Catálogo de sondas inválidas (036/FR-005) — cada entrada aplicável é de fato um no-op
// (sem exceção, sem mutação) quando disparada no estado onde é inválida.
import { describe, expect, it } from 'vitest'
import { createSimSession } from './driver'
import { INVALID_PROBE_CATALOG, applyProbe } from './invalidProbe'

describe('catálogo de sondas inválidas — cada entrada aplicável é no-op', () => {
  for (const probe of INVALID_PROBE_CATALOG) {
    it(`"${probe.name}" não muta o estado quando aplicável`, () => {
      const session = createSimSession(1, ['p1', 'p2'])
      if (!probe.isApplicable(session.game)) return // não aplicável no estado inicial — ok
      const result = applyProbe(session, probe)
      expect(result.ok, result.detail).toBe(true)
    })
  }

  it('sondas de dívida/leilão são aplicáveis mesmo com resoluções pendentes distintas', () => {
    const session = createSimSession(1, ['p1', 'p2'])
    session.game.resolution = { kind: 'debt', amount: 50, creditorId: null }
    const probe = INVALID_PROBE_CATALOG.find((p) => p.name === 'comprar-sem-oferta-pendente')!
    expect(probe.isApplicable(session.game)).toBe(true)
    const result = applyProbe(session, probe)
    expect(result.ok, result.detail).toBe(true)
  })
})
