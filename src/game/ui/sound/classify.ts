// Classificadores PUROS evento→cue (spec 035). Sem Web Audio, sem GameState —
// só mapeiam dados em SoundCue (testáveis em ambiente node). Os imports são
// type-only: este módulo não tem dependência de runtime sobre o motor nem o engine.
import type { SoundCue } from './cues'
import type { LogEntry, ResolutionSlice } from '@/game/economy/types'
import type { Roll, Notice } from '@/game/turn/types'

// Rolagem → cue, ramificando face Ônibus / dupla / Speed Die / base (FR-001).
export function cueForRoll(roll: Roll): SoundCue {
  if (roll.special === 'onibus') return 'dice-bus'
  if (roll.isDouble) return 'dice-double'
  if (roll.speed !== null) return 'dice-speed'
  return 'dice-roll'
}

// Borda de subida de resolução → cue (FR-003/FR-004). `auction` aqui = abertura.
// `purchase` (prompt de compra ao cair na casa) é SILENCIOSO — o cha-ching do `buy`
// toca só na compra CONFIRMADA (log `comprou ...`), não na oferta.
export function cueForResolution(kind: ResolutionSlice['kind']): SoundCue | null {
  switch (kind) {
    case 'auction': return 'auction-bid'
    case 'card-reveal': return 'card-reveal'
    case 'card-shortcut': return 'card-shortcut'
    case 'card-discard': return 'card-discard'
    case 'debt': return 'debt'
    case 'reaction-diplomacia':
    case 'reaction-bunker': return 'reaction'
    default: return null
  }
}

// Notice → cue (FR-005/FR-004). free-parking é neutro (catch-up discreto, FR-017).
export function cueForNotice(kind: Notice['kind']): SoundCue | null {
  switch (kind) {
    case 'free-parking': return 'free-parking'
    case 'hostile-takeover': return 'hostile-takeover'
    default: return null
  }
}

// Chave de VALOR de uma entrada de log. O motor clona o estado inteiro a cada
// ação (structuredClone) — identidade de objeto nunca sobrevive; qualquer
// comparação do log tem que ser por valor.
export function logKey(e: LogEntry): string {
  return `${e.who}|${e.what}`
}

// Quantas entradas NOVAS existem no fim de `keys` em relação a `prevKeys`.
// O log é append-only com shift no teto de 50: descontadas as `d` novas, o
// prefixo restante de `keys` tem que casar com o sufixo de `prevKeys`.
// Log inteiramente irreconhecível (reset/reconexão) → 0: não re-tocar
// histórico (FR-011).
export function countNewLogEntries(prevKeys: string[], keys: string[]): number {
  for (let d = 0; d <= keys.length; d++) {
    const keep = keys.length - d
    if (keep > prevKeys.length) continue
    if (keep === 0) return prevKeys.length === 0 ? keys.length : 0
    const off = prevKeys.length - keep
    let ok = true
    for (let i = 0; i < keep; i++) {
      if (prevKeys[off + i] !== keys[i]) { ok = false; break }
    }
    if (ok) return d
  }
  return 0
}

// Classifica UMA entrada de log nova → cue (ou null). Por prefixo/substring estável
// das emissões reais do motor (spec 021). Eventos já cobertos por canais tipados
// (compra, rolagem, dívida) retornam null aqui para não tocar duas vezes (FR-007).
// `card-draw` é GENÉRICO — nunca varia por raridade (privacidade, FR-016).
export function classifyLogEntry(e: LogEntry): SoundCue | null {
  const w = e.what
  if (w.startsWith('comprou ')) return 'buy' // compra CONFIRMADA (não o prompt)
  if (w.includes('de imposto')) return 'tax-paid'
  if (w.includes('de aluguel a')) return 'rent-paid'
  if (w.includes('pelo GO') || w.includes('no GO')) return 'go-bonus'
  if (w.includes('juros')) return 'loan-interest'
  if (w.includes('Bus Ticket')) return 'busticket-gain'
  if (w === 'faliu') return 'bankruptcy'
  if (w.startsWith('sacou ')) return 'card-draw'
  return null
}
