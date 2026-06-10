// Catálogo de cues sonoros (spec 035). Um cue é um identificador semântico; o
// asset (arquivo de áudio) é resolvido por nome. Drop de `buy.webm` em
// `src/assets/sfx/` auto-mapeia o cue `buy`. Cue sem arquivo = silencioso (FR-006).
// NÃO faz parte do GameState — apresentação pura (FR-018).

export type SoundCue =
  | 'dice-roll' | 'dice-double' | 'dice-speed' | 'dice-bus'
  | 'step-tick' | 'step-land'
  | 'go-bonus' | 'tax-paid' | 'busticket-gain'
  | 'buy' | 'decline' | 'build' | 'sell' | 'mortgage' | 'unmortgage'
  | 'rent-paid' | 'auction-bid' | 'auction-close' | 'debt'
  | 'loan-granted' | 'loan-interest'
  | 'card-draw' | 'card-reveal' | 'card-shortcut' | 'card-play' | 'card-discard'
  | 'apagao' | 'greve' | 'hostile-takeover' | 'reaction' | 'immunity'
  | 'free-parking' | 'jail-in' | 'jail-out' | 'win' | 'bankruptcy'
  | 'your-turn' | 'pause' | 'resume'

// Auto-mapa: qualquer arquivo `<cue>.{webm,mp3,ogg,wav}` em src/assets/sfx vira CUE_SRC[cue].
// import.meta.glob é do Vite (e suportado pelo vitest); em ambiente sem assets retorna {}.
const modules = import.meta.glob('../../../assets/sfx/*.{webm,mp3,ogg,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export const CUE_SRC: Partial<Record<SoundCue, string>> = {}
for (const [path, url] of Object.entries(modules)) {
  const name = path.split('/').pop()!.replace(/\.(webm|mp3|ogg|wav)$/, '')
  CUE_SRC[name as SoundCue] = url
}
