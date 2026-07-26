import { describe, it, expect } from 'vitest'
import { logIcon } from '@/game/ui/log/logIcon'
import { ALL_LOG_KINDS } from '@/game/economy/types'

describe('logIcon — exaustividade por kind (040, FR-021/FR-024/FR-026)', () => {
  it('todo kind tem ícone decidido — só "legacy" é null, e por decisão explícita', () => {
    for (const kind of ALL_LOG_KINDS) {
      const icon = logIcon(kind)
      if (kind === 'legacy') expect(icon).toBeNull()
      else expect(icon).not.toBeNull()
    }
  })

  it('SC-002: os padrões antes inalcançáveis de logEventIcon agora têm kind que os produz', () => {
    // constru|hangar|hotel|arranha|vendeu — família build, nunca logada antes desta fatia.
    expect(logIcon('build')).not.toBeNull()
    expect(logIcon('build-hangar')).not.toBeNull()
    expect(logIcon('sell-building')).not.toBeNull()
    expect(logIcon('sell-hangar')).not.toBeNull()
    // hipotec — mortgage/unmortgage, idem.
    expect(logIcon('mortgage')).not.toBeNull()
    expect(logIcon('unmortgage')).not.toBeNull()
    // leil — leilão comum e pregão, idem.
    expect(logIcon('auction-won')).not.toBeNull()
    expect(logIcon('auction-unsold')).not.toBeNull()
    expect(logIcon('lot-won')).not.toBeNull()
    expect(logIcon('lot-unsold')).not.toBeNull()
    // pote — Free Parking, idem.
    expect(logIcon('free-parking')).not.toBeNull()
    // fian — fiança, idem.
    expect(logIcon('jail-fine')).not.toBeNull()
  })

  it('ALL_LOG_KINDS cobre exatamente as 26 variantes — sem sobra nem falta', () => {
    expect(ALL_LOG_KINDS.length).toBe(26)
    expect(new Set(ALL_LOG_KINDS).size).toBe(26) // sem duplicata
  })
})
