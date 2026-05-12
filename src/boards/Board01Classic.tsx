import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import type { Square, PropertySquare, AirportSquare, UtilitySquare, MineSquare } from '@/lib/boardData'
import { useMapCatalog } from '@/game/ui/theme/boardTheme'
import {
  ClassicSquare,
  CornerSquare,
  PlayersPanel,
  ActionsPanel,
  CenterArena,
  PropertyPopover,
  AirportPopover,
  UtilityPopover,
  MinePopover,
} from './shared'
import { LiveTokens } from '@/game/ui/LiveTokens'
import { DeckOddsModal } from '@/game/ui/cards/DeckOddsModal'
import { DebtSlot } from '@/game/ui/debt/DebtCall'
import { StageBackdrop } from './StageBackdrop'
// A FORMA do tabuleiro (lados, células, faixas da grade) vem da topologia. Antes
// `gridArea` morava aqui e `sideOf` no `shared.tsx`: a mesma família de geometria
// partida em dois arquivos, com os cantos 0/12/24/36 escritos duas vezes.
// A topologia agora vem do MAPA (D-070): o Atlas é 48 casas em grade 13×13, a Fuligem
// é 40 em 11×11. Era um import fixo de `CLASSIC_TOPOLOGY` — a seam existia, mas estava
// amarrada num tabuleiro só.
import { topologyOf } from './topology'

export default function Board01Classic() {
  // O tabuleiro vem do catálogo do mapa da sala (055/D-069) — cada mapa tem o seu, com
  // tamanho próprio. Reativo: a home pré-visualiza.
  const catalog = useMapCatalog()
  const board = catalog.board
  const { sideOf, gridArea, trackTemplate, centerArea } = topologyOf(catalog.id)
  // Casa selecionada — abre o popover-balão adjacente. Clicar fora ou em
  // outra casa fecha. O elemento-âncora acompanha a posição porque o deed
  // é portado ao `body`: assim ele escapa do stacking context do tabuleiro
  // e continua operável por cima da cobrança de dívida.
  const [selection, setSelection] = useState<{ pos: number; anchor: HTMLElement } | null>(null)
  const selectedPos = selection?.pos ?? null
  const selectedSquare: Square | undefined =
    selectedPos !== null ? board.find((s) => s.pos === selectedPos) : undefined

  return (
    <main
      className="board-stage"
      // Click em qualquer área fora de uma propriedade fecha o popover.
      // Cells de propriedade fazem stopPropagation antes de setar a nova.
      onClick={() => setSelection(null)}
    >
      <StageBackdrop />
      <PlayersPanel />

      <div
        className="
          board-frame
          board-frame--tactile
          bg-coffee-950 border border-coffee-500
          rounded-[var(--radius-card)]
          shadow-[var(--shadow-lift),0_0_0_1px_color-mix(in_srgb,var(--color-brass)_22%,transparent)]
          p-1
        "
      >
        <div
          className="grid w-full h-full gap-px"
          style={{
            // Faixas da grade e o porquê do `minmax(0, …)` vivem em `./topology`.
            gridTemplateColumns: trackTemplate,
            gridTemplateRows: trackTemplate,
          }}
        >
          {/* Centro */}
          <div
            className="
              relative
              board-center
              border border-coffee-500
            "
            style={centerArea}
          >
            <CenterArena />
            {/* Área livre de casa, do tamanho do próprio tabuleiro: é aqui que a cobrança de
                dívida aparece (066/D-066). O slot fica sempre montado e vazio — quem o
                preenche é o HUD, por portal, quando existe dívida. */}
            <DebtSlot />
          </div>

          {/* As casas do mapa ativo — 48 no Atlas, 40 na Fuligem */}
          {board.map((square) => {
            const side = sideOf(square.pos)
            const isCorner = side === 'corner'
            const isProperty = square.kind === 'property'
            const isAirport  = square.kind === 'airport'
            const isUtility  = square.kind === 'utility'
            const isMine     = square.kind === 'mine' // D-071: comprável ⇒ clicável, como as outras
            // 057: casa de CARTA também abre — mas vitrine de probabilidades, não escritura.
            // Ela não tem dono nem preço; o que se inspeciona nela é o baralho.
            const isCardSquare = square.kind === 'acaso' || square.kind === 'tesouro'
            const isClickable = isProperty || isAirport || isUtility || isMine || isCardSquare
            const isSelected = selectedPos === square.pos
            // 044/T032: casa clicável (propriedade/aeroporto/utilidade) precisa ser
            // alcançável e operável por teclado, com nome. Antes era um `<div onClick>` —
            // sem `tabIndex`, sem semântica, invisível pro teclado inteiro. Vira `<button>`
            // (foco + Enter/Space nativos) SEPARADO do `<div>` externo — o `<div>` continua
            // só como âncora de posição pro popover, que fica como IRMÃO do botão, nunca
            // filho (botão dentro de botão seria HTML inválido, e o popover tem botões
            // próprios). Nome vem do `square.name` (o mesmo que a casa já mostra visível).
            const squareContent = isCorner ? (
              <CornerSquare
                square={square}
                accent={
                  square.kind === 'corner-go' ? 'gold' :
                  square.kind === 'corner-gotojail' ? 'logo' :
                  'cream'
                }
              />
            ) : (
              <ClassicSquare square={square} side={side} />
            )
            return (
              <div key={square.pos} style={gridArea(square.pos)} className="relative">
                {isClickable ? (
                  <button
                    type="button"
                    aria-label={`${square.name}: ver detalhes`}
                    aria-haspopup="dialog"
                    aria-expanded={isSelected}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelection((current) => (
                        current?.pos === square.pos
                          ? null
                          : { pos: square.pos, anchor: e.currentTarget }
                      ))
                    }}
                    className="board-square-button relative block w-full h-full text-left cursor-pointer"
                  >
                    {squareContent}
                  </button>
                ) : (
                  squareContent
                )}

                {/* Popover-balão adjacente à casa selecionada */}
                <AnimatePresence>
                  {isSelected && isProperty && selectedSquare?.kind === 'property' && (
                    <PropertyPopover
                      key={square.pos}
                      square={selectedSquare as PropertySquare}
                      side={side}
                      anchor={selection?.anchor}
                      onClose={() => setSelection(null)}
                    />
                  )}
                  {isSelected && isAirport && selectedSquare?.kind === 'airport' && (
                    <AirportPopover
                      key={`airport-${square.pos}`}
                      square={selectedSquare as AirportSquare}
                      side={side}
                      anchor={selection?.anchor}
                      onClose={() => setSelection(null)}
                    />
                  )}
                  {isSelected && isUtility && selectedSquare?.kind === 'utility' && (
                    <UtilityPopover
                      key={`utility-${square.pos}`}
                      square={selectedSquare as UtilitySquare}
                      side={side}
                      anchor={selection?.anchor}
                      onClose={() => setSelection(null)}
                    />
                  )}
                  {isSelected && isMine && selectedSquare?.kind === 'mine' && (
                    <MinePopover
                      key={`mine-${square.pos}`}
                      square={selectedSquare as MineSquare}
                      side={side}
                      anchor={selection?.anchor}
                      onClose={() => setSelection(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {/*
            VITRINE DE PROBABILIDADES (057) — fora do laço das casas, e de propósito.
            Os outros são POPOVER ancorado na casa; este é MODAL centrado, porque 14–18 linhas
            com explicação expansível não caberiam num balão sem cobrir meio tabuleiro. Sendo
            modal, renderizar dentro da célula da grade o prenderia ao `position: relative`
            dela.

            Também não entra na fila do `ModalLayer`: aquela camada é dirigida por
            `state.resolution` e decide a partida. Esta é informativa, mora no board layer com
            estado local de seleção, e o `ModalLayer` desenha POR CIMA quando há decisão
            pendente — então a vitrine nunca esconde uma decisão nem serve de fuga dela.
          */}
          <AnimatePresence>
            {selectedSquare && (selectedSquare.kind === 'acaso' || selectedSquare.kind === 'tesouro') && (
              <DeckOddsModal
                key={`odds-${selectedSquare.kind}`}
                deck={selectedSquare.kind}
                onClose={() => setSelection(null)}
              />
            )}
          </AnimatePresence>

          {/* Peças vivas dos jogadores (posições vêm do store) */}
          <LiveTokens gridArea={gridArea} />
        </div>
      </div>

      <ActionsPanel />
    </main>
  )
}
