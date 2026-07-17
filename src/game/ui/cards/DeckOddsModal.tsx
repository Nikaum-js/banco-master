// VITRINE DE PROBABILIDADES (spec 057) — o modal que ensina o baralho.
//
// Casca reusada, não imitada: `Overlay` + `ModalShell` + `ModalHeader` são os MESMOS primitivos
// do `ModalLayer`, então "igual aos outros modais" é estrutural. De graça vêm o trap de foco, a
// devolução de foco e o `aria-labelledby` que a spec 044 construiu.
//
// `dismissible` é TRUE aqui, e é o único lugar onde essa escolha é óbvia: SRS §1057 diz que Esc
// fecha modal INFORMATIVO e não fecha modal que decide a partida. Esta camada não decide nada.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Overlay, ModalShell, ModalHeader } from '@/game/ui/shell'
import { RARITY_COLOR, RARITY_LABEL, RARITY_PIPS } from './cardMeta'
import { deckOdds, formatOdds, type DeckOddsRow } from './deckOdds'
import type { DeckId } from '@/game/cards/types'

/** Selo de raridade: cor E losangos. A cor sozinha não serve — laranja e verde a 4,5:1 sobre
 *  tinta continuam sendo duas cores para quem não as distingue (mesmo motivo do `cardMeta`). */
function RarityPips({ rarity }: { rarity: DeckOddsRow['rarity'] }) {
  return (
    <span className="deck-odds-row__pips" aria-hidden>
      {Array.from({ length: RARITY_PIPS[rarity] }, (_, i) => (
        <i key={i} style={{ background: RARITY_COLOR[rarity] }} />
      ))}
    </span>
  )
}

function OddsRow({ row, index }: { row: DeckOddsRow; index: number }) {
  // DOIS estados, não um. Um só booleano parecia suficiente e não era, por duas razões que
  // apareceram na tela e não no teste:
  //
  //   1. `hover abre` + `clique alterna` se anulam — o ponteiro entra (abre), o clique chega
  //      (fecha), e o item que o jogador acabou de clicar é justamente o que fica fechado;
  //   2. sem fechar ao sair, varrer a lista com o mouse deixa as 18 descrições abertas de uma
  //      vez, e o modal vira parede de texto.
  //
  // `hovered` é transitório (ponteiro/foco entra e sai). `pinned` é intenção explícita: quem
  // CLICOU quer que fique. Aberto = um ou outro, então clicar durante o hover fixa em vez de
  // desfazer, e sair do item não apaga o que foi fixado.
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hovered || pinned
  const descId = `deck-odds-desc-${row.effect}`

  return (
    <li className="deck-odds-row" style={{ '--deck-odds-accent': RARITY_COLOR[row.rarity] } as React.CSSProperties}>
      {/*
        A linha é BOTÃO, e a explicação vive em DOM — não em `title=`. É o requisito FR-008: o
        jogador de teclado e o de celular precisam alcançar a explicação, e hover não existe para
        nenhum dos dois. Ponteiro é atalho, não caminho único.
      */}
      <button
        type="button"
        className="deck-odds-row__trigger"
        aria-expanded={open}
        aria-controls={descId}
        onClick={() => setPinned((v) => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        <span className="deck-odds-row__ord" aria-hidden>{index + 1}</span>
        <RarityPips rarity={row.rarity} />
        <span className="deck-odds-row__name">
          {row.title}
          <span className="deck-odds-row__rarity">{RARITY_LABEL[row.rarity]}</span>
        </span>
        <span className="deck-odds-row__odds">
          {formatOdds(row.probability)}
          {/* Contagem só aparece quando há mais de uma cópia: "1 carta" em 18 linhas é ruído. */}
          {row.copies > 1 && (
            <span className="deck-odds-row__copies">{row.copies} cartas</span>
          )}
        </span>
      </button>
      <p
        id={descId}
        className={cn('deck-odds-row__desc', open && 'deck-odds-row__desc--open')}
        hidden={!open}
      >
        {row.desc}
      </p>
    </li>
  )
}

export function DeckOddsModal({ deck, onClose }: { deck: DeckId; onClose: () => void }) {
  if (typeof document === 'undefined') return null
  const { total, rows } = deckOdds(deck)
  // Acaso e Tesouro são os nomes canônicos nos DOIS mapas (D-018 fixou "Acaso"), e o catálogo
  // de mapa não sobrepõe nenhum dos dois — a Fuligem renomeia contratos do motor
  // (Aeroporto→Ferrovia, Loteria→Sorte Grande), não os baralhos.
  const nome = deck === 'acaso' ? 'Acaso' : 'Tesouro'

  return createPortal(
    <Overlay z={62} dismissible onClick={onClose}>
      <ModalShell className="deck-odds-modal w-[600px] max-w-[calc(100vw-2rem)]">
        <ModalHeader
          tone={deck === 'acaso' ? 'signal' : 'brass'}
          title={nome}
          subtitle={`${total} cartas · da menos provável para a mais provável`}
          onClose={onClose}
        />
        <ol className="deck-odds-list">
          {rows.map((row, i) => <OddsRow key={row.effect} row={row} index={i} />)}
        </ol>
        <p className="deck-odds-foot">
          {/* Diz o que o número É. Sem isso o jogador supõe que a chance acompanha o baralho
              restante — e é justamente o que ela NÃO faz, por privacidade (D-037). */}
          Chance de cada saque, pela composição do baralho. Não muda com o andamento da partida.
        </p>
      </ModalShell>
    </Overlay>,
    document.body,
  )
}
