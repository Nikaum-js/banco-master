// Hook do delta de caixa flutuante (024.1; extraído em 044/T020). Vive num arquivo à
// parte de `primitives.tsx` (que só exporta componentes) porque um hook export ao lado de
// componentes quebra o Fast Refresh (`react-refresh/only-export-components`) — `MoneyPulse`
// (a casca visual) continua em `primitives.tsx`; só o estado mudou de endereço.
import { useEffect, useRef, useState } from 'react'

// Guarda o valor anterior e devolve o pulso atual (id + delta) sempre que `value` muda.
// `id` garante remount (key) mesmo se dois deltas seguidos tiverem o mesmo sinal/tamanho.
export function useMoneyPulse(value: number, holdMs = 1200): { id: number; d: number } | null {
  const [pulse, setPulse] = useState<{ id: number; d: number } | null>(null)
  const prev = useRef(value)
  const pulseId = useRef(0)
  useEffect(() => {
    if (value !== prev.current) {
      const d = value - prev.current
      prev.current = value
      pulseId.current += 1
      setPulse({ id: pulseId.current, d })
      const t = setTimeout(() => setPulse(null), holdMs)
      return () => clearTimeout(t)
    }
  }, [value, holdMs])
  return pulse
}
