// Vocabulário de faces do Speed Die na UI (SRS §13.2) — separado de `dice.tsx`
// porque aquele módulo exporta SÓ componentes (fast refresh); consumidores de
// constante/mapeador importam daqui.
export type SpeedFace = 'one' | 'two' | 'three' | 'mr' | 'bus'

// Face do Speed Die do motor (1|2|3|'mr-banco'|'onibus') → face visual.
export function toUiSpeedFace(speed: number | 'mr-banco' | 'onibus'): SpeedFace {
  if (speed === 1) return 'one'
  if (speed === 2) return 'two'
  if (speed === 3) return 'three'
  if (speed === 'mr-banco') return 'mr'
  return 'bus' // 'onibus'
}
