// SoundLayer (spec 035) — ponte headless entre o estado React e as duas bordas
// impuras de áudio. Toda a projeção incremental vive no módulo puro `project`.
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/game/store'
import { useAudioPrefs } from './prefs'
import { ensureUnlockListener, play, setMasterGain } from './engine'
import { createSoundProjector } from './project'

export function SoundLayer() {
  const game = useGameStore((s) => s.game)
  const projector = useRef(createSoundProjector())

  // Destrava o áudio no 1º gesto e aplica o ganho inicial das prefs uma vez —
  // as mudanças seguintes são cobertas pelos setters do store e pelo rehydrate.
  useEffect(() => {
    ensureUnlockListener()
    const { volume, muted } = useAudioPrefs.getState()
    setMasterGain(volume, muted)
  }, [])

  useEffect(() => {
    for (const cue of projector.current.project(game)) play(cue)
  }, [game])

  return null
}
