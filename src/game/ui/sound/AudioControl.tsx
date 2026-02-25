// Controle de áudio (spec 035, US2) — botão de mute + slider de volume, fixo no
// canto. Lê/escreve useAudioPrefs (persistido). Sempre visível (independe do HUD).
import { Volume2, VolumeX } from 'lucide-react'
import { useAudioPrefs } from './prefs'

export function AudioControl() {
  const muted = useAudioPrefs((s) => s.muted)
  const volume = useAudioPrefs((s) => s.volume)

  // `audio-control` só carrega o posicionamento vertical (index.css). Ele já precisou subir
  // para não cobrir a cobrança de dívida, que ocupava a base da tela (D-056); desde a D-066 a
  // cobrança mora no miolo do tabuleiro e a base voltou a ser só dele.
  return (
    <div className="audio-control group fixed left-3 z-[55] flex items-center gap-2">
      <button
        type="button"
        aria-label={muted ? 'Ativar som' : 'Silenciar'}
        onClick={() => useAudioPrefs.getState().setMuted(!muted)}
        className="grid h-9 w-9 place-items-center rounded-full bg-coffee-950/70 text-cream shadow-md backdrop-blur transition hover:bg-coffee-950/90"
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={(e) => {
          const v = Number(e.target.value)
          const { setMuted, setVolume } = useAudioPrefs.getState()
          if (muted && v > 0) setMuted(false)
          setVolume(v)
        }}
        aria-label="Volume"
        className="hidden h-9 w-28 cursor-pointer accent-gold group-focus-within:block group-hover:block"
      />
    </div>
  )
}
