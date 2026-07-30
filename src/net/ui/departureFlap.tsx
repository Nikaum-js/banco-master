// Painel de partidas da home — o letreiro split-flap de saguão de aeroporto, com os
// destinos saindo do TABULEIRO de verdade (`boardData`), não de uma lista decorativa
// paralela: mudou a cidade no jogo, mudou o letreiro. É o elemento que dá voz ao tema
// "Cidades do Mundo" antes de a partida existir.
//
// Cada caractere é uma palheta que tomba (`.flap-cell`/`.flap-anim`, index.css). A onda
// vem do atraso crescente por coluna — é o "clack-clack" da fileira caindo em sequência.
//
// Acessibilidade: o letreiro é AMBIENTE, não informação. Fica fora da árvore
// (`aria-hidden`) — anunciar um destino novo a cada 3s seria ruído em leitor de tela — e
// sob movimento reduzido para de girar: mostra um destino fixo, sem timer nem animação.
import { useEffect, useState } from 'react'
import { ATLAS_BOARD, GROUPS, type PropertySquare } from '@/lib/boardData'
import { useMotion } from '@/game/ui/motion'
import { cn } from '@/lib/utils'

const CELLS = 9 // palhetas do letreiro — cabe o nome mais longo que selecionamos
const DWELL_MS = 3400 // quanto um destino fica no letreiro antes do próximo
const FLAP_STAGGER_MS = 55 // atraso por coluna: é isso que faz a onda

// Letreiro de embarque do ATLAS — vocabulário de aeroporto e nome de país. Lê
// `ATLAS_BOARD` explicitamente, e não `BOARD`: como `const` de módulo isto era avaliado no
// import e passou a depender de ordem de import quando `BOARD` virou o tabuleiro ativo
// (D-070). A Fuligem tem cenário próprio (`FuligemBackdrop`) e não usa este letreiro.
const DESTINATIONS = ATLAS_BOARD.filter((s): s is PropertySquare => s.kind === 'property')
  .map((s) => ({ name: (s.short ?? s.name).toUpperCase(), group: s.group, country: GROUPS[s.group].name }))
  .filter((d) => d.name.length <= CELLS)

export function DepartureFlap({ className }: { className?: string }) {
  const { reduced } = useMotion()
  const [i, setI] = useState(0)

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setI((n) => (n + 1) % DESTINATIONS.length), DWELL_MS)
    return () => clearInterval(id)
  }, [reduced])

  const dest = DESTINATIONS[i]
  // O nome fica CENTRADO nas palhetas: com tudo encostado à esquerda, cidade curta
  // deixava metade do letreiro vazia de um lado só, e a fileira ficava torta.
  const pad = Math.floor((CELLS - dest.name.length) / 2)
  const chars = Array.from({ length: CELLS }, (_, c) => dest.name[c - pad] ?? '')

  return (
    <div className={cn('flex items-center justify-center gap-3 flex-wrap', className)} aria-hidden="true">
      <span className="label text-starlight-muted/70 tracking-caps text-[0.55rem]">Próximo destino</span>

      <span className="flex gap-[3px] [perspective:520px]">
        {chars.map((ch, c) => (
          // A chave carrega o índice do destino: destino novo = célula nova = a
          // animação de queda recomeça do zero (sem isso, o React reusaria o nó e o
          // caractere trocaria sem tombar).
          <span
            key={`${i}-${c}`}
            className={cn('flap-cell text-[1.05rem]', !ch && 'flap-cell--blank', !reduced && 'flap-anim')}
            style={reduced ? undefined : { animationDelay: `${c * FLAP_STAGGER_MS}ms` }}
          >
            {ch || '·'}
          </span>
        ))}
      </span>

      <span className="flex items-center gap-1.5">
        <span
          className="size-1.5 rounded-[var(--radius-pill)] shrink-0"
          style={{ backgroundColor: `var(--color-group-${dest.group})` }}
        />
        <span className="label text-starlight-muted/70 text-[0.55rem]">{dest.country}</span>
      </span>
    </div>
  )
}
