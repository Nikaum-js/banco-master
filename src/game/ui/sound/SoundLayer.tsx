// SoundLayer (spec 035) — ponte headless entre o estado React e as duas bordas
// impuras de áudio. Toda a projeção incremental vive no módulo puro `project`.
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/game/store'
import { useAudioPrefs } from './prefs'
import { ensureUnlockListener, play, setMasterGain } from './engine'
import { createSoundProjector } from './project'
import type { SoundCue } from './cues'

const DICE_CUES: ReadonlySet<SoundCue> = new Set([
  'dice-roll',
  'dice-double',
  'dice-speed',
  'dice-bus',
])

// O bônus tem só 241ms e era disparado no mesmo snapshot do som dos dados (~1s),
// ficando mascarado. Separar os dois mantém o cue discreto, mas audível.
const GO_BONUS_AFTER_DICE_MS = 1_050

export function SoundLayer() {
  const game = useGameStore((s) => s.game)
  const projector = useRef(createSoundProjector())
  const delayed = useRef(new Set<ReturnType<typeof setTimeout>>())

  // Destrava o áudio no 1º gesto e aplica o ganho inicial das prefs uma vez —
  // as mudanças seguintes são cobertas pelos setters do store e pelo rehydrate.
  useEffect(() => {
    ensureUnlockListener()
    const { volume, muted } = useAudioPrefs.getState()
    setMasterGain(volume, muted)
    const timers = delayed.current
    return () => {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  useEffect(() => {
    const cues = projector.current.project(game)
    const followsDice = cues.some((cue) => DICE_CUES.has(cue))

    for (const cue of cues) {
      if (cue !== 'go-bonus' || !followsDice) {
        play(cue)
        continue
      }

      const timer = setTimeout(() => {
        delayed.current.delete(timer)
        play(cue)
      }, GO_BONUS_AFTER_DICE_MS)
      delayed.current.add(timer)
    }
  }, [game])

  return null
}
