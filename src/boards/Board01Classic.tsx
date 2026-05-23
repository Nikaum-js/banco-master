import { useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { BOARD, type Square, type PropertySquare, type AirportSquare, type UtilitySquare } from '@/lib/boardData'
import {
  ClassicSquare,
  CornerSquare,
  sideOf,
  PlayersPanel,
  ActionsPanel,
  CenterArena,
  PropertyPopover,
  AirportPopover,
  UtilityPopover,
} from './shared'
import { LiveTokens } from '@/game/ui/LiveTokens'

// ---------------------------------------------------------------------
// Posição em grid 11×11 a partir do índice clockwise (pos 0 = canto SE)
// ---------------------------------------------------------------------
function gridArea(pos: number): React.CSSProperties {
  // Grade 13×13 · cantos em 0/12/24/36 · 11 casas por lado.
  // bottom row: row 13
  if (pos >= 0 && pos <= 12)  return { gridRow: 13, gridColumn: 13 - pos }
  // left col: col 1
  if (pos >= 13 && pos <= 24) return { gridRow: 13 - (pos - 12), gridColumn: 1 }
  // top row: row 1
  if (pos >= 25 && pos <= 36) return { gridRow: 1, gridColumn: pos - 23 }
  // right col: col 13
  return { gridRow: pos - 35, gridColumn: 13 }
}

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
          bg-coffee-800 border-2 border-coffee-500
          rounded-[var(--radius-card)]
          shadow-[var(--shadow-lift)]
          p-2
        "
      >
        <div
          className="grid w-full h-full gap-[2px]"
          style={{
            // Grade 13×13: cantos (2fr) + 11 casas por lado (1fr).
            // `minmax(0, …)` é ESSENCIAL: sem ele, o conteúdo grande dos
            // cantos (glifo 56px + label) inflava as LINHAS de canto além do
            // fr, deixando o tabuleiro retangular e as casas laterais
            // (62×45) diferentes das de cima/baixo (50×102). Com minmax(0,…)
            // as faixas ficam puramente proporcionais → board quadrado →
            // casas do perímetro CONGRUENTES (cima/baixo 50×102 = transposto
            // das laterais 102×50). Cantos = 2× o miolo dá os ~102/~50.
            gridTemplateColumns: 'minmax(0, 2fr) repeat(11, minmax(0, 1fr)) minmax(0, 2fr)',
            gridTemplateRows: 'minmax(0, 2fr) repeat(11, minmax(0, 1fr)) minmax(0, 2fr)',
          }}
        >
          {/* Centro */}
          <div
            className="
              relative
              bg-gradient-to-br from-coffee-800 via-coffee-700 to-coffee-900
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
