// Controle de áudio (spec 035, US2) — botão de mute + slider de volume, fixo no
// canto. Lê/escreve useAudioPrefs (persistido). Sempre visível (independe do HUD).
import { Volume2, VolumeX } from 'lucide-react'
import { useAudioPrefs } from './prefs'

export function AudioControl() {
  const muted = useAudioPrefs((s) => s.muted)
  const volume = useAudioPrefs((s) => s.volume)

  // `audio-control` carrega posicionamento e área segura (index.css). Ele já precisou subir
  // para não cobrir a cobrança de dívida, que ocupava a base da tela (D-056); desde a D-066 a
  // cobrança mora no miolo do tabuleiro e a base voltou a ser só dele.
  return (
    <div className="audio-control group fixed z-[55] flex items-center gap-2">
      <button
        type="button"
        aria-label={muted ? 'Ativar som' : 'Silenciar'}
        onClick={() => useAudioPrefs.getState().setMuted(!muted)}
        // 44×44 de verdade, não 36: em ponteiro grosso o botão de ícone era o
        // caso que o piso só-de-altura deixava passar (medido em 740×360: 36×44).
        className="grid h-11 w-11 place-items-center rounded-full bg-coffee-950/70 text-cream shadow-md backdrop-blur transition hover:bg-coffee-950/90"
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
        // Em ponteiro FINO o slider continua aparecendo no hover/foco — o canto fica
        // limpo até alguém se interessar. Em ponteiro GROSSO não existe hover, e
        // revelar só no foco significava que a única forma de chegar ao volume era
        // apertar o mudo antes: mudar o volume exigia silenciar. Lá ele nasce
        // visível (`audio-control__slider`, index.css).
        className="audio-control__slider hidden h-11 w-28 cursor-pointer accent-gold group-focus-within:block group-hover:block"
      />
    </div>
  )
}
