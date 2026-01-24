// Engine de áudio (spec 035) — Web Audio API nativa, sem dependência. AudioContext
// lazy (criado no 1º play), GainNode master para volume/mute, buffers cacheados,
// throttle anti-spam por cue. `play` é não-bloqueante e NUNCA lança (FR-019/FR-020).
// Antes do 1º gesto do usuário, `play` é no-op (política de autoplay — FR-015).
import { CUE_SRC, CUE_VARIANTS, type SoundCue } from './cues'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'

const MIN_GAP_MS = 70 // janela de coalescência por cue (FR-009)

let ctx: AudioContext | null = null
let master: GainNode | null = null
let unlocked = false
let vol = 1
let mut = false
const buffers = new Map<string, Promise<AudioBuffer | null>>()
const lastAt = new Map<SoundCue, number>()

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = mut ? 0 : vol
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
  return ctx
}

// Aplica volume (0..1, já clampado pelo store de prefs) e mute ao ganho master.
export function setMasterGain(volume: number, muted: boolean): void {
  vol = volume
  mut = muted
  if (master) master.gain.value = mut ? 0 : vol
}

// A identidade sonora acompanha o MAPA (055/D-069): variante `<mapa>--<cue>` quando
// existe, senão o asset base. O mapa nunca muda mid-game, então resolver na hora do
// play é estável — e o cache passa a ser por URL, não por cue.
function srcFor(cue: SoundCue): string | undefined {
  return CUE_VARIANTS[useBoardTheme.getState().theme]?.[cue] ?? CUE_SRC[cue]
}

// Cacheia a PROMISE (não o buffer): plays concorrentes do mesmo cue antes do 1º
// decode terminar compartilham o mesmo fetch, e asset ausente não re-fetcha.
function load(cue: SoundCue, c: AudioContext): Promise<AudioBuffer | null> {
  const url = srcFor(cue)
  if (!url) return Promise.resolve(null)
  const cached = buffers.get(url)
  if (cached) return cached
  const p = fetch(url)
    .then((res) => res.arrayBuffer())
    .then((arr) => c.decodeAudioData(arr))
    .catch(() => null) // asset ausente/inválido: silencioso (FR-019)
  buffers.set(url, p)
  return p
}

// Toca o cue. No-op se: mutado, throttled, não-destravado, sem asset ou falha.
export function play(cue: SoundCue): void {
  if (mut) return
  const now = typeof performance !== 'undefined' ? performance.now() : 0
  const last = lastAt.get(cue) ?? -Infinity
  if (now - last < MIN_GAP_MS) return // anti-spam (FR-009)
  lastAt.set(cue, now)
  if (!unlocked) return // autoplay travado até o 1º gesto (FR-015)
  const c = ensureCtx()
  if (!c) return
  load(cue, c)
    .then((buf) => {
      if (!buf || !master) return
      const src = c.createBufferSource()
      src.buffer = buf
      src.connect(master)
      src.start()
    })
    .catch(() => {}) // nunca quebra o jogo por causa de som (FR-019)
}

// Registra (idempotente) o destrave no 1º gesto do usuário → ctx.resume() (FR-015).
export function ensureUnlockListener(): void {
  if (unlocked || typeof window === 'undefined') return
  const unlock = () => {
    if (unlocked) return // outro dos 3 eventos já destravou
    unlocked = true
    const c = ensureCtx()
    c?.resume?.().catch(() => {})
    // Warm-up: pré-carrega os assets existentes em paralelo, fora do hot path.
    if (c) for (const cue of Object.keys(CUE_SRC) as SoundCue[]) void load(cue, c)
  }
  window.addEventListener('pointerdown', unlock, { capture: true, once: true })
  window.addEventListener('keydown', unlock, { capture: true, once: true })
  window.addEventListener('touchstart', unlock, { capture: true, once: true })
}
