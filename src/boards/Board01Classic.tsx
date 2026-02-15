import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { BOARD, type Square, type PropertySquare, type AirportSquare, type UtilitySquare } from '@/lib/boardData'
import {
  ClassicSquare,
  CornerSquare,
  PlayersPanel,
  ActionsPanel,
  CenterArena,
  PropertyPopover,
  AirportPopover,
  UtilityPopover,
} from './shared'
import { LiveTokens } from '@/game/ui/LiveTokens'
import { StageBackdrop } from './StageBackdrop'
// A FORMA do tabuleiro (lados, células, faixas da grade) vem da topologia. Antes
// `gridArea` morava aqui e `sideOf` no `shared.tsx`: a mesma família de geometria
// partida em dois arquivos, com os cantos 0/12/24/36 escritos duas vezes.
import { CLASSIC_TOPOLOGY } from './topology'

const { sideOf, gridArea, trackTemplate } = CLASSIC_TOPOLOGY

export default function Board01Classic() {
  // Casa selecionada — abre o popover-balão adjacente. Clicar fora ou em
  // outra casa fecha. O elemento-âncora acompanha a posição porque o deed
  // é portado ao `body`: assim ele escapa do stacking context do tabuleiro
  // e continua operável por cima da cobrança de dívida.
  const [selection, setSelection] = useState<{ pos: number; anchor: HTMLElement } | null>(null)
  const selectedPos = selection?.pos ?? null
  const selectedSquare: Square | undefined =
    selectedPos !== null ? BOARD.find((s) => s.pos === selectedPos) : undefined

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
            style={{ gridRow: '2 / 13', gridColumn: '2 / 13' }}
          >
            <CenterArena />
          </div>

          {/* 40 casas */}
          {BOARD.map((square) => {
            const side = sideOf(square.pos)
            const isCorner = side === 'corner'
            const isProperty = square.kind === 'property'
            const isAirport  = square.kind === 'airport'
            const isUtility  = square.kind === 'utility'
            const isClickable = isProperty || isAirport || isUtility
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
                    aria-label={`${square.name} — ver detalhes`}
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
                </AnimatePresence>
              </div>
            )
          })}

          {/* Peças vivas dos jogadores (posições vêm do store) */}
          <LiveTokens gridArea={gridArea} />
        </div>
      </div>

      <ActionsPanel />
    </main>
  )
}
