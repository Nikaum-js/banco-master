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
// A FORMA do tabuleiro (lados, células, faixas da grade) vem da topologia. Antes
// `gridArea` morava aqui e `sideOf` no `shared.tsx`: a mesma família de geometria
// partida em dois arquivos, com os cantos 0/12/24/36 escritos duas vezes.
import { CLASSIC_TOPOLOGY } from './topology'

const { sideOf, gridArea, trackTemplate } = CLASSIC_TOPOLOGY

export default function Board01Classic() {
  // Casa selecionada — abre o popover-balão adjacente. Clicar fora ou em
  // outra casa fecha. Guardamos pos (não a square inteira) pra ficar
  // simples; lookup do square é feito no render.
  const [selectedPos, setSelectedPos] = useState<number | null>(null)
  const selectedSquare: Square | undefined =
    selectedPos !== null ? BOARD.find((s) => s.pos === selectedPos) : undefined

  return (
    <main
      className="board-stage"
      // Click em qualquer área fora de uma propriedade fecha o popover.
      // Cells de propriedade fazem stopPropagation antes de setar a nova.
      onClick={() => setSelectedPos(null)}
    >
      <PlayersPanel />

      <div
        className="
          board-frame
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
              bg-gradient-to-br from-coffee-900 via-coffee-800 to-coffee-950
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
            return (
              <div
                key={square.pos}
                style={gridArea(square.pos)}
                className={isClickable ? 'relative cursor-pointer' : 'relative'}
                onClick={
                  isClickable
                    ? (e) => {
                        e.stopPropagation()
                        setSelectedPos((cur) => (cur === square.pos ? null : square.pos))
                      }
                    : undefined
                }
              >
                {isCorner ? (
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
                )}

                {/* Popover-balão adjacente à casa selecionada */}
                <AnimatePresence>
                  {isSelected && isProperty && selectedSquare?.kind === 'property' && (
                    <PropertyPopover
                      key={square.pos}
                      square={selectedSquare as PropertySquare}
                      side={side}
                      onClose={() => setSelectedPos(null)}
                    />
                  )}
                  {isSelected && isAirport && selectedSquare?.kind === 'airport' && (
                    <AirportPopover
                      key={`airport-${square.pos}`}
                      square={selectedSquare as AirportSquare}
                      side={side}
                      onClose={() => setSelectedPos(null)}
                    />
                  )}
                  {isSelected && isUtility && selectedSquare?.kind === 'utility' && (
                    <UtilityPopover
                      key={`utility-${square.pos}`}
                      square={selectedSquare as UtilitySquare}
                      side={side}
                      onClose={() => setSelectedPos(null)}
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
