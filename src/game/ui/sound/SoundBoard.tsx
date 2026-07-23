// SoundBoard (dev) — tela inteira com um botão por cue para auditar a identidade
// sonora (spec 035). Acessível via `?sons` na URL; não participa do jogo.
// O 1º clique também destrava o áudio (ensureUnlockListener, FR-015).
import { useEffect } from 'react'
import { CUE_SRC, type SoundCue } from './cues'
import { ensureUnlockListener, play, setMasterGain } from './engine'

interface Item {
  cue: SoundCue
  label: string
}

// Candidatos temporários em avaliação (arquivos extras em assets/sfx, fora do
// catálogo de cues). Removê-los quando a escolha for feita.
const DICE_OPTIONS = [
  { file: 'dice-roll-opcao-1', label: 'Opção 1 — seco na mesa (atual)' },
  { file: 'dice-roll-opcao-2', label: 'Opção 2 — chacoalho no copo + arremesso' },
  { file: 'dice-roll-opcao-3', label: 'Opção 3 — rolada gorda (mais quiques)' },
] as const

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Dados',
    items: [
      { cue: 'dice-roll', label: 'Rolar dados' },
      { cue: 'dice-double', label: 'Saiu dupla (joga de novo)' },
      { cue: 'dice-speed', label: 'Speed Die' },
      { cue: 'dice-bus', label: 'Dado do Ônibus' },
    ],
  },
  {
    title: 'Movimento',
    items: [
      { cue: 'step-tick', label: 'Passo do peão (cada casa)' },
      { cue: 'step-land', label: 'Peão para na casa' },
    ],
  },
  {
    title: 'Dinheiro e propriedade',
    items: [
      { cue: 'buy', label: 'Comprar propriedade' },
      { cue: 'decline', label: 'Recusar compra/oferta' },
      { cue: 'build', label: 'Construir casa/hotel' },
      { cue: 'sell', label: 'Vender construção' },
      { cue: 'mortgage', label: 'Hipotecar' },
      { cue: 'unmortgage', label: 'Quitar hipoteca' },
      { cue: 'rent-paid', label: 'Pagar aluguel' },
      { cue: 'money-gain', label: 'Ganhar dinheiro' },
      { cue: 'money-loss', label: 'Perder dinheiro' },
      { cue: 'tax-paid', label: 'Pagar imposto' },
      { cue: 'go-bonus', label: 'Bônus do GO' },
      { cue: 'busticket-gain', label: 'Ganhar Bus Ticket' },
      { cue: 'debt', label: 'Entrar em dívida' },
      { cue: 'loan-granted', label: 'Empréstimo concedido' },
      { cue: 'loan-interest', label: 'Juros do empréstimo' },
    ],
  },
  {
    title: 'Leilão',
    items: [
      { cue: 'auction-bid', label: 'Novo lance' },
      { cue: 'auction-close', label: 'Arrematado (martelada)' },
    ],
  },
  {
    title: 'Cartas',
    items: [
      { cue: 'card-draw', label: 'Sacar carta' },
      { cue: 'card-reveal', label: 'Revelar carta' },
      { cue: 'card-play', label: 'Jogar carta da mão' },
      { cue: 'card-discard', label: 'Descartar carta' },
      { cue: 'card-shortcut', label: 'Atalho/teleporte' },
    ],
  },
  {
    title: 'Eventos e cartas especiais',
    items: [
      { cue: 'apagao', label: 'Apagão' },
      { cue: 'greve', label: 'Greve' },
      { cue: 'hostile-takeover', label: 'Aquisição hostil' },
      { cue: 'reaction', label: 'Carta de reação' },
      { cue: 'immunity', label: 'Imunidade de aluguel' },
    ],
  },
  {
    title: 'Prisão e tabuleiro',
    items: [
      { cue: 'free-parking', label: 'Loteria (Free Parking)' },
      { cue: 'jail-in', label: 'Foi preso' },
      { cue: 'jail-out', label: 'Saiu da prisão' },
    ],
  },
  {
    title: 'Estado e fim de jogo',
    items: [
      { cue: 'your-turn', label: 'Sua vez' },
      { cue: 'turn-end', label: 'Finalizar turno' },
      { cue: 'win', label: 'Vitória' },
      { cue: 'bankruptcy', label: 'Falência' },
      { cue: 'pause', label: 'Jogo pausado' },
      { cue: 'resume', label: 'Jogo retomado' },
    ],
  },
]

export function SoundBoard() {
  useEffect(() => {
    ensureUnlockListener()
    setMasterGain(1, false) // board de auditoria: volume cheio, sem mute
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <header className="mx-auto mb-8 max-w-5xl">
        <h1 className="text-2xl font-bold">Sons do jogo</h1>
        <p className="mt-1 text-sm text-slate-400">
          Um botão por ação — clique para ouvir. Volte ao jogo removendo <code className="rounded bg-slate-800 px-1">?sons</code> da URL.
        </p>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-8">
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
            🎲 Escolha o som do dado
          </h2>
          <p className="mb-3 text-xs text-slate-400">
            Três candidatos pro <code className="rounded bg-slate-800 px-1">dice-roll</code> — ouça e me diga qual fica.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {DICE_OPTIONS.map(({ file, label }) => (
              <button
                key={file}
                type="button"
                onClick={() => play(file as SoundCue)}
                className="rounded-lg border border-amber-500/50 bg-slate-900 px-3 py-3 text-left text-sm font-medium transition hover:bg-slate-800 active:scale-95"
              >
                {label}
              </button>
            ))}
          </div>
        </section>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-400">{g.title}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map(({ cue, label }) => {
                const missing = !CUE_SRC[cue]
                return (
                  <button
                    key={cue}
                    type="button"
                    onClick={() => play(cue)}
                    disabled={missing}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-left transition hover:border-amber-400 hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-500">
                      {cue}
                      {missing && ' — sem arquivo'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
