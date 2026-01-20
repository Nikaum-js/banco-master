import { cn } from '@/lib/utils'
import { Bus } from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { Square, PropertySquare, AirportSquare, TaxSquare, UtilitySquare } from '@/lib/boardData'
import { BOARD } from '@/lib/boardData'
import { useGameStore } from '@/game/store'
import { useLocalView, useRoomStore } from '@/net/roomStore'
import { cityLevel } from '@/game/economy/construction'
import { THEME } from '@/game/theme'
import { deedView, type BuildBlock } from '@/game/ui/deed/deedView'
import { deedPresentation } from '@/game/ui/deed/presentation'
import '@/game/ui/deed/propertyPopover.css'
import { PlayerFace } from './PlayerFace'
import { useTradeUI } from '@/game/ui/trade/tradeUI'
import { useBusTicketUI } from '@/game/ui/busTicketUI'
import { markLayout, popoverPlacement, sideOf, type Side } from './topology'
import { SquareIcon, CardGlyph, LotteryGlyph } from './glyphs/squares'
import {
  PlotBadgeIcon, HouseBadgeIcon, HotelBadgeIcon, SkyscraperBadgeIcon, HangarBadgeIcon,
  CalmGlyph, TradeArrowGlyph, PlusGlyph, SwapMiniGlyph,
} from './glyphs/badges'
import { ChartPattern, GridPattern } from './glyphs/patterns'
import { playersView, type Player } from '@/game/ui/panels/playersView'
import { diceArenaView } from '@/game/ui/panels/diceArenaView'
import { Dice, SpeedDie, ROLL_DURATION_MS } from '@/game/ui/dice'
import { toUiSpeedFace, type SpeedFace } from '@/game/ui/diceFaces'
import { logKey, countNewLogEntries } from '@/game/ui/sound/classify'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'
import { HandPanel } from '@/game/ui/cards/HandPanel'
import { useTokenAnim } from '@/game/ui/tokenAnim'
import { useMotion, MOTION, EASE } from '@/game/ui/motion'
import { ShopIcon, GavelIcon, DiceIcon, CoinIcon, HouseIcon } from '@/game/ui/icons'
import { Button, SectionHeader, Chip, EmptyState, MoneyPulse } from '@/game/ui/primitives'
import { useMoneyPulse } from '@/game/ui/useMoneyPulse'
import type { TempEffect, TradeProposal } from '@/game/economy/types'
import { money } from '@/lib/money'
import { describeLogEntry } from '@/game/ui/log/describeLog'
import { logIcon } from '@/game/ui/log/logIcon'
import { AccessoryErrorBoundary } from '@/app/AccessoryErrorBoundary'
import { identityOf } from '@/net/identity'

// Este módulo exporta SÓ componentes — cada consumidor importa constante e seletor da
// própria fonte (`./groupColors`, `./topology`, `./glyphs/squares`, `@/game/ui/panels/playersView`).
// As reexportações de compatibilidade que moravam aqui custavam o fast refresh do arquivo.

// ---------------------------------------------------------------------
function FlagAvatar({ iso2, side }: { iso2: string; side: Side }) {
  // Leste/oeste: bandeira no TOPO da casa, dentro dela (início da pilha
  // avatar → nome → valor). Sul/norte: continua cravada na borda interna,
  // metade transbordando sobre o centro (anel de bandeiras).
  // Circulinho 32px em TODOS os lados, cravado/atravessado na borda INTERNA
  // (voltada pro centro), metade dentro da célula e metade transbordando
  // sobre o centro. Nas laterais é a borda vertical (direita na col esquerda,
  // esquerda na col direita) — mesmo tratamento de cima/baixo.
  const size = 32
  const position: React.CSSProperties = (() => {
    switch (side) {
      case 'bottom': return { top: 0,    left: '50%', transform: 'translate(-50%, -50%)' }
      case 'top':    return { bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }
      case 'left':   return { right: 0,  top: '50%',  transform: 'translate(50%, -50%)' }
      case 'right':  return { left: 0,   top: '50%',  transform: 'translate(-50%, -50%)' }
      default:       return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }
  })()
  // A BASE da bandeira aponta para o nome (que fica no lado externo). Como a
  // bandeira atravessa a borda interna, a base aponta pra fora → gira por lado.
  const artRotation =
    side === 'left' ? 90 : side === 'right' ? -90 : side === 'top' ? 180 : 0
  return (
    <div
      className="board-flag-avatar absolute rounded-full border-2 border-coffee-950 bg-coffee-900 overflow-hidden pointer-events-none z-40"
      style={{
        ...position,
        width: size,
        height: size,
        boxShadow: 'var(--shadow-card), inset 0 0 0 1.5px color-mix(in srgb, var(--color-brass) 60%, transparent)',
      }}
      title={iso2}
    >
      <img
        src={`https://flagcdn.com/${iso2.toLowerCase()}.svg`}
        alt={iso2}
        className="w-full h-full object-cover block"
        style={{ transform: `rotate(${artRotation}deg)` }}
        draggable={false}
      />
    </div>
  )
}

// ---------------------------------------------------------------------
// Classic property square — bandeira-avatar do país na borda interna;
// stripe colorida só aparece quando há dono (na cor do jogador).
// Usado pelos boards 1, 2, 3
// ---------------------------------------------------------------------
export function ClassicSquare({
  square,
  side,
}: { square: Square; side: Side }) {
  const isProperty = square.kind === 'property'
  const isAirport  = square.kind === 'airport'
  const isUtility  = square.kind === 'utility'
  const isTax      = square.kind === 'tax'
  const isAcaso    = square.kind === 'acaso'
  const isTesouro  = square.kind === 'tesouro'
  const isBus      = square.kind === 'bus-ticket'
  const isCard     = isAcaso || isTesouro

  // Dono atual (real, do store) — a identidade visual pertence à SALA, não à
  // posição do jogador no array. Sem sala, `identityOf` preserva a paleta fallback.
  const ownerId = useGameStore((s) => s.game.titles[square.pos]?.ownerId)
  const room = useRoomStore((s) => s.room)
  const ownerColor = ownerId ? identityOf(room, ownerId).color : undefined
  // Feedback de posse (044, T020/FR-029): a troca de dono da célula não tinha NENHUM
  // aviso visual — cor aparecia/sumia de golpe. `key={ownerColor}` remonta o grupo a cada
  // transferência (compra, leilão, aquisição hostil) e o `pop` do vocabulário entra por cima.
  const { pop: ownerPop } = useMotion()
  // Propriedade COMPRADA não exibe valor — a posse é comunicada pela stripe
  // colorida do jogador. Só propriedade À VENDA (sem dono) mostra o preço.

  // O flag transborda pelo lado interno da célula sobre o centro do
  // tabuleiro em todos os lados — `.board-square` precisa rodar sem
  // `overflow-hidden` pra metade externa do círculo não ser cortada.
  return (
    <div className="board-square relative w-full h-full">
      {/* POSSE: a cidade ACENDE — luz interna na cor do dono + fio de néon na borda,
          como cidade iluminada vista do alto à noite. Vale nos dois temas: os dois são
          cidade à noite, e a diferença entre eles está na paleta que a luz usa. */}
      {ownerColor && (
        <motion.div
          key={ownerColor}
          className="absolute inset-0 pointer-events-none"
          initial={ownerPop.initial}
          animate={ownerPop.animate}
          aria-hidden
        >
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse 95% 75% at 50% 50%, color-mix(in srgb, ${ownerColor} 30%, transparent) 0%, transparent 78%)`,
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: `inset 0 0 0 1.5px ${ownerColor}, inset 0 0 12px color-mix(in srgb, ${ownerColor} 45%, transparent)`,
              }}
            />
          </>
        </motion.div>
      )}
      {/* Bandeira-avatar do país — fincada na borda INTERNA (voltada
          pro centro do tabuleiro); metade dentro da célula, metade
          transbordando sobre o centro. */}
      {isProperty && (
        <FlagAvatar iso2={(square as PropertySquare).uf} side={side} />
      )}

      {/* Marcas mockadas: construções, hipoteca. Dono é comunicado pela cor
          da stripe externa; bandeira na interna carrega identidade do país. */}
      {isProperty && <BuildingMark pos={square.pos} />}
      {isAirport && <HangarMark pos={square.pos} />}
      <MortgageMark pos={square.pos} />
      <EffectMark pos={square.pos} />

      {/* Conteúdo da PROPRIEDADE — posicionado em valores absolutos pra
          separar valor (junto da stripe externa) do nome (centro).
          Em todos os lados, flag está na borda INTERNA (transbordando
          sobre o centro) e stripe na borda EXTERNA. Money fica colado na
          stripe; city no centro da célula.
            - sul/norte: stripe na borda externa (rodapé pro sul, topo pro
              norte); money perto dela; texto usa o eixo horizontal inteiro.
            - oeste/leste: stripe vertical externa, flag transbordando
              pelo lado interno. Texto fica no meio, com padding pra
              clear a stripe de um lado e a metade visível do flag do outro. */}
      {isProperty && (
        <>
          {(() => {
            // Nome no TOPO da casa (visualmente), preço no RODAPÉ.
            // Em sul/norte (cells tall) o nome fica logo abaixo da borda
            // superior; em leste/oeste (cells wide) o nome encosta na borda
            // superior dentro da área entre stripe e flag.
            const cityPos: React.CSSProperties = (() => {
              switch (side) {
                // Sul/norte: cidade colada na bandeira (sem espaço vazio
                // entre os dois). Bandeira ~32px ocupa de ~6% a ~26%;
                // cidade começa em ~27-28% (top do cell pra bottom row,
                // mirror pra top row).
                case 'bottom': return { top: '27%',    left: '3%', right: '3%' }
                case 'top':    return { bottom: '27%', left: '3%', right: '3%' }
                // Leste/oeste: igual cima/baixo, porém girado 90°. Nome na
                // VERTICAL, colado na bandeira (lado interno), indo pro externo.
                // left=90° (base do texto pra esquerda), right=-90°.
                // Centralizado entre a bandeira (borda interna) e o chip de preço (externa),
                // com viés externo — evita a 1ª linha de nomes longos (2 linhas) ficar sob o flag.
                case 'left':   return { left: '45%', top: '50%', transform: 'translate(-50%, -50%) rotate(90deg)' }
                case 'right':  return { left: '55%', top: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)' }
                default:       return { top: '50%',    left: '4%', right: '4%', transform: 'translateY(-50%)' }
              }
            })()
            // Valor é um CHIP centralizado (pílula) — posiciona pelo centro
            // horizontal pra a pílula encolher pro conteúdo.
            const moneyPos: React.CSSProperties = (() => {
              switch (side) {
                case 'bottom': return { bottom: '5px', left: '50%', transform: 'translateX(-50%)' }
                case 'top':    return { top: '5px',    left: '50%', transform: 'translateX(-50%)' }
                // Leste/oeste: chip girado, no extremo EXTERNO (longe da bandeira).
                case 'left':   return { left: '7%',  top: '50%', transform: 'translate(-50%, -50%) rotate(90deg)' }
                case 'right':  return { left: '93%', top: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)' }
                default:       return { bottom: '24%', left: '50%', transform: 'translateX(-50%)' }
              }
            })()
            return (
              <>
                {/* Preço como CHIP (pílula) — só em propriedade À VENDA (sem
                    dono). Comprada não mostra valor: a cor do dono na célula
                    já comunica a posse. Mesmo tratamento nos dois temas; o
                    dourado resolve pelo tema via var(). */}
                {!ownerColor && (
                  <div
                    className="board-square-price absolute currency leading-none whitespace-nowrap"
                    style={{
                      ...moneyPos,
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-gold-glow)',
                      background: 'color-mix(in srgb, var(--color-ink-950) 85%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-brass) 45%, transparent)',
                      borderRadius: 9999,
                      padding: '1px 5px',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <span style={{ fontSize: '0.8em', opacity: 0.75, marginRight: 2 }}>R$</span>
                    {(square as PropertySquare).price}
                  </div>
                )}
                <p
                  className="absolute text-center display text-cream leading-none tracking-wide cell-text"
                  style={{
                    ...cityPos,
                    // Fonte UNIFORME 14px em todos os nomes (sem auto-fit —
                    // variação de tamanho lia como inconsistência). Nomes
                    // compostos quebram em 2 linhas; nas laterais o maxWidth
                    // ≈ altura da casa (cqmin) deixa o nome girado quebrar.
                    fontSize: '14px',
                    fontWeight: 700,
                    ...(side === 'left' || side === 'right' ? { maxWidth: '94cqmin' } : {}),
                  }}
                >
                  {(square as PropertySquare).short ?? square.name}
                </p>
              </>
            )
          })()}
        </>
      )}

      {/* Faixa de acento na borda externa — aeroportos (dourado) e
          utilidades (cor do ícone). Identidade visual sem dono. */}
      {(isAirport || isUtility) && (() => {
        const color = isAirport
          ? 'var(--color-brass)'
          : (square as UtilitySquare).icon === 'fuel' ? 'var(--color-group-green)'
          : (square as UtilitySquare).icon === 'bolt' ? 'var(--color-brass-glow)'
          : 'var(--color-group-orange)'
        const style: React.CSSProperties = (() => {
          const base = { position: 'absolute' as const, borderRadius: 9999, pointerEvents: 'none' as const, background: color, boxShadow: 'var(--shadow-card)' }
          switch (side) {
            case 'bottom': return { ...base, left: '20%', right: '20%', bottom: 4, height: 5 }
            case 'top':    return { ...base, left: '20%', right: '20%', top: 4,    height: 5 }
            case 'left':   return { ...base, top: '20%', bottom: '20%', left: 4,   width: 5 }
            case 'right':  return { ...base, top: '20%', bottom: '20%', right: 4,  width: 5 }
            default:       return base
          }
        })()
        return <div style={style} />
      })()}

      {/* Brilho de acento por TIPO atrás do ícone — identidade da casa
          especial sem tocar nas propriedades (aeroporto=latão, petro=verde,
          eletro=dourado, gás=laranja, acaso/taxa=signal, tesouro/bus=latão). */}
      {!isProperty && (() => {
        const glow =
          isAirport ? 'var(--color-brass)'
          : isUtility ? ((square as UtilitySquare).icon === 'fuel' ? 'var(--color-group-green)'
            : (square as UtilitySquare).icon === 'bolt' ? 'var(--color-brass-glow)'
            : 'var(--color-group-orange)')
          : isAcaso || isTax ? 'var(--color-signal)'
          : isTesouro || isBus ? 'var(--color-brass)'
          : null
        return glow ? (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 72% 58% at 50% 50%, color-mix(in srgb, ${glow} 13%, transparent) 0%, transparent 72%)`,
            }}
          />
        ) : null
      })()}

      {/* Conteúdo das casas NÃO-propriedade — aeroporto, utility, tax,
          acaso, tesouro. Ícone + label no centro da célula.
          Leste/oeste: gira o bloco inteiro 90° (igual o nome das propriedades)
          + encolhe um pouco pra o label girado caber na altura. */}
      {!isProperty && (
        <div
          className="absolute inset-0 flex flex-col items-center text-center gap-1 justify-center p-1"
          style={{
            transform:
              side === 'left'  ? 'rotate(90deg)' :
              side === 'right' ? 'rotate(-90deg)' : undefined,
          }}
        >
          {(isAirport || isUtility || isCard || isTax || isBus) && (
            <div style={{ fontSize: 32 }} className="board-square-icon leading-none">
              <SquareIcon square={square} size="1em" />
            </div>
          )}
          {isAirport && (
            <p
              className="board-square-label display mt-1 text-cream leading-none tracking-wider"
              style={{ fontSize: '14px' }}
            >
              {(square as AirportSquare).name}
            </p>
          )}
          {isUtility && (
            <p
              className="board-square-label display mt-1 text-cream leading-none tracking-wide"
              style={{ fontSize: '14px' }}
            >
              {(() => {
                const icon = (square as UtilitySquare).icon
                return icon === 'fuel' ? 'Petro' : icon === 'bolt' ? 'Eletro' : 'Gás'
              })()}
            </p>
          )}
          {isTax && (
            <>
              <p className="board-square-label display mt-1 text-cream leading-none" style={{ fontSize: '14px' }}>
                Taxa
              </p>
              <p className="board-square-label currency text-logo leading-none" style={{ fontSize: '14px' }}>
                <span className="text-cream-muted text-[0.7em] mr-0.5">R$</span>
                {(square as TaxSquare).amount}
              </p>
            </>
          )}
          {isAcaso && (
            <p className="board-square-label display mt-1 text-cream leading-none" style={{ fontSize: '14px' }}>
              Acaso
            </p>
          )}
          {isTesouro && (
            <p className="board-square-label display mt-1 text-cream leading-none" style={{ fontSize: '14px' }}>
              Tesouro
            </p>
          )}
          {isBus && (
            <p className="board-square-label display mt-1 text-cream leading-none tracking-wide text-center" style={{ fontSize: '14px' }}>
              Bus Ticket
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Corner square — quadrado especial maior, sem rotação
// ---------------------------------------------------------------------
export function CornerSquare({ square, accent = 'cream' }:
  { square: Square; accent?: 'cream' | 'gold' | 'logo' }) {
  const isGo = square.kind === 'corner-go'
  void accent

  const label =
    square.kind === 'corner-go'       ? 'Start'         :
    square.kind === 'corner-jail'     ? 'Prisão'        :
    square.kind === 'corner-parking'  ? 'Loteria'       :
    square.kind === 'corner-gotojail' ? 'Vá pra Prisão' :
    ''

  return (
    <div
      className={cn(
        'board-square relative w-full h-full flex flex-col items-center justify-center p-1 gap-1',
        isGo && 'bg-coffee-700',
      )}
    >
      <div className="board-corner-icon leading-none" style={{ fontSize: 56 }}>
        <SquareIcon square={square} size="1em" />
      </div>
      <p
        className="board-square-label display mt-1 text-cream leading-none"
        style={{ fontSize: '14px' }}
      >
        {label}
      </p>
    </div>
  )
}

export function BuildingMark({ pos }: { pos: number }) {
  const title = useGameStore((s) => s.game.titles[pos])
  const n = title ? cityLevel(title) : 0 // 0–7 real (023)
  if (!n) return null

  const side = sideOf(pos)
  const isSkyscraper = n === 7
  const hotelCount = n === 6 ? 2 : n === 5 ? 1 : 0
  const houseCount = n >= 1 && n <= 4 ? n : 0
  const isFourHouseGrid = houseCount === 4

  return (
    <div
      className="absolute z-20 pointer-events-none items-center justify-center"
      data-building-layout={isFourHouseGrid ? 'grid-2x2' : 'line'}
      data-building-kind={isSkyscraper ? 'skyscraper' : hotelCount > 0 ? 'hotel' : 'house'}
      style={{
        ...markLayout(side),
        display: isFourHouseGrid ? 'grid' : 'flex',
        gridTemplateColumns: isFourHouseGrid ? 'repeat(2, 13px)' : undefined,
        gridTemplateRows: isFourHouseGrid ? 'repeat(2, 13px)' : undefined,
        gap: isFourHouseGrid ? '1px' : '1.5px',
        color: 'var(--color-brass-glow)',
        flexWrap: 'nowrap', // 4 casas NUNCA quebram pra outra linha
        width: 'max-content', // dimensiona pelo conteúdo (sem shrink-to-fit da célula)
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
      }}
    >
      {isSkyscraper && <SkyscraperBadgeIcon />}
      {hotelCount > 0 && Array.from({ length: hotelCount }, (_, i) => <HotelBadgeIcon key={i} />)}
      {/* 1–3 casas em linha; quatro usam grade 2×2 para caber na faixa lateral. */}
      {houseCount > 0 && Array.from({ length: houseCount }, (_, i) => <HouseBadgeIcon key={i} />)}
    </div>
  )
}

// Marca de hangar no aeroporto — mesmo posicionamento (stripe externa) das
// construções de cidade. Só renderiza quando o aeroporto tem hangar (§13.6).
export function HangarMark({ pos }: { pos: number }) {
  const hangar = useGameStore((s) => s.game.titles[pos]?.hangar)
  if (!hangar) return null
  return (
    <div
      className="absolute z-20 pointer-events-none flex items-center justify-center"
      data-building-kind="hangar"
      style={{
        ...markLayout(sideOf(pos)),
        color: 'var(--color-brass-glow)',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
      }}
    >
      <HangarBadgeIcon />
    </div>
  )
}

// Marca de hipoteca — apenas SOMBREAMENTO: a célula escurece e ganha uma sombra interna,
// parecendo "bloqueada / fora de jogo". Sem selo nem texto: o carimbo de cartório que
// existia aqui era do tema Cofre, e saiu com ele.
export function MortgageMark({ pos }: { pos: number }) {
  const mortgaged = useGameStore((s) => s.game.titles[pos]?.mortgaged)
  if (!mortgaged) return null
  return (
    <div
      className="absolute inset-0 pointer-events-none z-[25]"
      title="Hipotecada"
      style={{
        background: 'color-mix(in srgb, var(--color-ink-abyss) 60%, transparent)',
        boxShadow: 'inset 0 0 14px 3px rgba(0,0,0,0.6)',
      }}
    >
    </div>
  )
}

// Marca de efeito temporário ativo na casa (024.1): apagão (aeroportos), greve
// (utilidades), boicote/imunidade-temp (casa específica). Pulsa pra chamar atenção.
export function EffectMark({ pos }: { pos: number }) {
  const effects = useGameStore((s) => s.game.tempEffects)
  const sq = BOARD[pos]
  let badge: { tag: string; tone: 'logo' | 'gold'; title: string } | null = null
  for (const e of effects) {
    if (e.kind === 'apagao' && sq.kind === 'airport') badge = { tag: 'A', tone: 'logo', title: 'Hangar inativo por apagão' }
    else if (e.kind === 'greve' && sq.kind === 'utility') badge = { tag: 'G', tone: 'logo', title: 'Utilidade sem aluguel por greve' }
    else if (e.kind === 'boicote' && e.pos === pos) badge = { tag: 'B', tone: 'logo', title: 'Propriedade sob boicote, sem aluguel' }
    else if (e.kind === 'imunidade-temp' && e.pos === pos) badge = { tag: 'I', tone: 'gold', title: 'Imunidade temporária' }
  }
  if (!badge) return null
  return <EffectMarkBadge badge={badge} />
}

// Extraído do corpo de `EffectMark` só para poder chamar `useMotion()` condicionalmente
// ao `badge` existir (hooks não podem vir depois de um `return` antecipado).
function EffectMarkBadge({ badge }: { badge: { tag: string; tone: 'logo' | 'gold'; title: string } }) {
  // Pulso pra chamar atenção (024.1) — não tinha freio (achado desta spec, T019): pulsava
  // sem parar mesmo com `prefers-reduced-motion`. `EffectBadge` (painel lateral, mesma
  // letra/tom) já freava; aqui ficou de fora até agora.
  const { reduced } = useMotion()
  return (
    <motion.div
      className={cn(
        'absolute top-0.5 right-0.5 z-[26] pointer-events-none leading-none flex items-center justify-center rounded-full font-bold',
        badge.tone === 'logo' ? 'bg-logo text-cream' : 'bg-gold text-coffee-950',
      )}
      style={{ width: 13, height: 13, fontSize: 'var(--text-micro)', boxShadow: 'var(--shadow-card)' }}
      title={badge.title}
      animate={reduced ? undefined : { opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.6, repeat: Infinity }}
    >
      {badge.tag}
    </motion.div>
  )
}


// Efeitos ativos no tabuleiro — SRS §12.3. Derivado do estado real (`tempEffects`).
// `tag` espelha a letra do EffectMark na casa (A/G/B/I); `detail`/`laps` são a
// versão estruturada do `desc` (mantido para tooltip/compat).
function effectRow(e: TempEffect, i: number): {
  key: string; label: string; desc: string; detail: string; tag: string; laps: number; tone: 'logo' | 'gold'
} {
  const laps = `${e.lapsRemaining} ${e.lapsRemaining === 1 ? 'volta' : 'voltas'}`
  const place = BOARD[e.pos ?? 0]?.name ?? '—'
  switch (e.kind) {
    case 'apagao': return { key: `a${i}`, label: 'Apagão', desc: `Hangares inativos · ${laps}`, detail: 'Hangares inativos', tag: 'A', laps: e.lapsRemaining, tone: 'logo' }
    case 'greve': return { key: `g${i}`, label: 'Greve', desc: `Utilidades sem aluguel · ${laps}`, detail: 'Utilidades sem aluguel', tag: 'G', laps: e.lapsRemaining, tone: 'logo' }
    case 'boicote': return { key: `b${i}`, label: 'Boicote', desc: `${place} sem aluguel · ${laps}`, detail: `${place} sem aluguel`, tag: 'B', laps: e.lapsRemaining, tone: 'logo' }
    case 'imunidade-temp': return { key: `i${i}`, label: 'Imunidade temp.', desc: `${place} · ${laps}`, detail: `${place} protegida`, tag: 'I', laps: e.lapsRemaining, tone: 'gold' }
  }
}

// Badge circular do efeito — mesma letra e tom do EffectMark na casa, pra
// leitura cruzada painel ⇄ tabuleiro. Pulsa junto (salvo reduced-motion).
function EffectBadge({ tag, tone, size = 20 }: { tag: string; tone: 'logo' | 'gold'; size?: number }) {
  const { reduced } = useMotion()
  return (
    <motion.span
      className={cn(
        'shrink-0 rounded-full font-bold flex items-center justify-center leading-none',
        tone === 'logo' ? 'bg-logo text-cream' : 'bg-gold text-coffee-950',
      )}
      style={{ width: size, height: size, fontSize: size * 0.55, boxShadow: 'var(--shadow-card)' }}
      animate={reduced ? undefined : { opacity: [0.75, 1, 0.75] }}
      transition={{ duration: 1.6, repeat: Infinity }}
      aria-hidden
    >
      {tag}
    </motion.span>
  )
}

function useLivePlayers(): Player[] {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const myUid = useRoomStore((s) => s.myUid)
  return playersView(game, room, myUid)
}

export function PlayersPanel() {
  const players = useLivePlayers()
  const effects = useGameStore((s) => s.game.tempEffects).map(effectRow) // 024.1 — efeitos reais
  const activePlayers = players.filter((p) => !p.bankrupt).length
  return (
    <aside className="side-panel">
      <div className="side-panel-section players-panel-section">
        <SectionHeader
          title="Jogadores"
          meta={(
            <div className="players-capacity">
              <span className="sr-only">{activePlayers} de 8 jogadores</span>
              <span className="players-capacity__count" aria-hidden>
                <strong>{activePlayers}</strong>
                <span>/ 8</span>
              </span>
            </div>
          )}
        />
        <ol className="players-roster" aria-label="Participantes da partida">
          {players.map((p) => (
            <PlayerRow key={p.id ?? p.name} player={p} />
          ))}
        </ol>
        {/* Negociar movido pra a seção única "Negociações" (painel direito). */}
      </div>


      <div className="side-panel-section">
        <SectionHeader
          title="Efeitos ativos"
          meta={effects.length > 0 ? <Chip tone="neutral">{effects.length}</Chip> : undefined}
        />
        {effects.length === 0 ? (
          <EmptyState icon={<CalmGlyph />} title="Tabuleiro em paz" />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {effects.map((e) => (
              <li
                key={e.key}
                title={e.desc}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-card)] border bg-coffee-800/60',
                  e.tone === 'logo' ? 'border-logo/30' : 'border-gold/30',
                )}
              >
                <EffectBadge tag={e.tag} tone={e.tone} />
                <div className="flex-1 min-w-0">
                  <p className={cn('display text-sm leading-none', e.tone === 'logo' ? 'text-logo' : 'text-gold')}>
                    {e.label}
                  </p>
                  <p className="text-cream-muted text-xs leading-snug mt-1 truncate">{e.detail}</p>
                </div>
                <Chip tone={e.tone === 'logo' ? 'alert' : 'gold'} title="Voltas restantes">
                  {e.laps} {e.laps === 1 ? 'volta' : 'voltas'}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

function PlayerRow({ player: p }: { player: Player }) {
  // Feedback de caixa (024.1; extraído em 044/T020 pra `primitives.tsx` — mesmo pulso
  // que PotCard usa e que a tela de dívida do GameHUD passou a reusar).
  const pulse = useMoneyPulse(p.money)

  return (
    <li
      data-active={p.active || undefined}
      className={cn(
        'player-row',
        p.active && 'player-row--active',
        // 044/T073: era `opacity-50` — mediu abaixo de 4,5:1 pro texto "Falido"/valor
        // desta linha. Sobe o piso pra manter o texto legível; a linha ainda fica
        // visivelmente mais apagada que as ativas (borda/fundo já mudam por conta própria).
        p.bankrupt && 'player-row--bankrupt',
      )}
      style={{ '--player-accent': p.color } as React.CSSProperties}
    >
      <MoneyPulse pulse={pulse} className="player-row__pulse" />

      <span className="player-row__portrait" aria-hidden>
        <PlayerFace
          color={p.color}
          avatar={p.avatar}
          skin={p.skin}
          active={p.active}
          asleep={p.bankrupt}
          size={40}
        />
        {p.you && <span className="player-row__you" title="Seu assento">VOCÊ</span>}
      </span>

      <div className="player-row__identity">
        {p.active && <span className="sr-only">Turno atual</span>}
        <div className="player-row__headline">
          <p className="display display--tight">{p.name}</p>
        </div>
      </div>

      <div className="player-row__meta">
        {p.bankrupt ? (
          <span className="player-row__state player-row__state--bankrupt">Falido</span>
        ) : p.connected === false ? (
          // Status de sessão (§12.3/FR-015): quem caiu segue com tudo intacto (FR-020).
          <span title="Desconectado — a partida espera" className="player-row__state player-row__state--offline">
            <i aria-hidden />
            Offline
          </span>
        ) : (
          <span title="Cartas em mão (privadas)" className="player-row__cards">
            <CardGlyph size={13} />
            {p.cardsInHand}/3
          </span>
        )}

        {/* Cor identifica o assento, mas todo estado também permanece textual. */}
        <span className="player-row__signals">
          {p.loanActive && <span title="Empréstimo ativo" className="player-row__signal player-row__signal--alert">$$</span>}
          {p.immune && <span title="Imunidade ativa" className="player-row__signal">IMU</span>}
        </span>
      </div>

      <div className="player-row__money">
        <span>Caixa</span>
        <p className={cn('currency', p.bankrupt && 'line-through')}>
          <small>R$</small>
          {p.money.toLocaleString('pt-BR')}
        </p>
      </div>
    </li>
  )
}

// Botão único das ações do turno (Rolar / Comprar / Leilão / Finalizar) —
// casca sobre o primitivo Button com a voz display CONDENSADA e porte maior.
// A exceção visual do botão de rolagem entra no call site via `dice-roll-button`;
// comprar, leiloar e finalizar seguem o Button canônico.
//
// `display--tight` e não só `display`: a zona de ação é uma coluna de 280px fixos e às
// vezes carrega DOIS botões ("Comprar R$ 100" + "Leilão"). Medido, a display larga do tema
// Fliperama (Press Start 2P) estourava a coluna em 17px e o "Leilão" saía por cima das
// casas da direita. A personalidade do tema segue nos títulos, no HUD e nos modais, onde
// há espaço; aqui o que manda é caber.
function TurnActionBtn({
  variant = 'primary',
  icon,
  onClick,
  disabled,
  title,
  className,
  children,
}: {
  variant?: 'primary' | 'secondary'
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'px-5 py-3 display display--tight font-normal text-base tracking-wide gap-2',
        className,
      )}
    >
      {icon}
      {children}
    </Button>
  )
}

// Ação opcional pré-rolagem/fim de turno (034). Divide a mesma linha da
// ação principal da DiceArena, com hierarquia secundária.
function BusTicketAction({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <TurnActionBtn
      variant="secondary"
      onClick={onClick}
      className="bus-ticket-action min-w-0 flex-[1.35] justify-start gap-2 px-2 text-sm"
      title={`Usar Bus Ticket · ${count} ${count === 1 ? 'disponível' : 'disponíveis'}`}
    >
      <span className="bus-ticket-action__icon" aria-hidden="true">
        <Bus size={18} />
      </span>
      <span className="bus-ticket-action__label">
        <span className="bus-ticket-action__eyebrow">Usar</span>
        <span className="bus-ticket-action__name">Bus Ticket</span>
      </span>
      <span className="bus-ticket-action__count tabular-nums">×{count}</span>
    </TurnActionBtn>
  )
}

// DiceArena — área central de arremesso (dados + botão). Vive no miolo do
// tabuleiro (CenterArena). Ligado ao motor (022.1): jogador da vez, faces e
// gating de turno vêm do store; o botão dispara rollDice.
export function DiceArena() {
  const players = useLivePlayers()
  const active = players.find((p) => p.active) ?? players[0]
  // UMA assinatura de estado e UMA derivação (`diceArenaView`) no lugar de 17 seletores.
  const game = useGameStore((s) => s.game)
  const dispatch = useGameStore((s) => s.dispatch)
  const activeBusTickets = game.players[game.turnOrder[game.activeSeat]]?.busTickets ?? 0
  const rollDiceCmd = (): void => dispatch({ kind: 'roll' })
  const buyProperty = (): void => dispatch({ kind: 'buy-property' })
  const declineProperty = (): void => dispatch({ kind: 'decline-property' })
  const finalizeTurn = (): void => dispatch({ kind: 'finalize' })
  const jailDecision = (decision: 'pay' | 'card' | 'try'): void => dispatch({ kind: 'jail-decision', decision })

  const [rollKey, setRollKey] = useState(0)
  const [rolling, setRolling] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Chaves de valor do log do último snapshot visto — mesma técnica do SoundLayer
  // (o motor clona o estado a cada comando; identidade de objeto não sobrevive).
  const prevLogKeys = useRef<string[] | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // 044/T071 (FR-032): `ROLL_DURATION_MS` travava a flag `rolling` por 1050ms fixos,
  // INDEPENDENTE de `prefers-reduced-motion` — o peão não andava e o botão não voltava
  // antes disso, mesmo para quem pediu menos movimento. O freio vem do MESMO `useMotion()`
  // que o resto do vocabulário usa (D7 do plan): zera sob movimento reduzido, intacto senão
  // — a animação do dado em si (`useDieAnimation` de `dice.tsx`) não muda, só o comando
  // deixa de esperar por ela. O handshake `rolling`/`animating` com `GameDriver`
  // (tokenAnim.ts) continua valendo nos dois casos: só muda POR QUANTO TEMPO ele segura.
  const { reduced } = useMotion()
  const rollDurationMs = reduced ? 0 : ROLL_DURATION_MS

  // O tumble dispara quando uma entrada 'roll' NOVA aparece no log — não no clique.
  // O clique só existe na tela de quem decide; o fato "rolou" chega pelo estado em TODAS
  // as telas (spec 038): sem isso, quem observava via os dados parados na face velha
  // enquanto o peão do outro já andava. Detecção por valor (logKey/countNewLogEntries,
  // as mesmas do SoundLayer): mount/reconexão não replay a última rolagem, e o ator vê
  // a MESMA coreografia — no cliente único o estado muda no próprio dispatch, online ela
  // começa quando o resultado chega (antes disso o cubo giraria pra uma face que a
  // autoridade ainda não revelou).
  useEffect(() => {
    const keys = game.log.map(logKey)
    const before = prevLogKeys.current
    prevLogKeys.current = keys
    if (before === null) return // primeiro snapshot: nada a animar
    const fresh = countNewLogEntries(before, keys)
    let rolled = false
    for (let i = game.log.length - fresh; i < game.log.length; i++) {
      if (game.log[i].kind === 'roll') { rolled = true; break }
    }
    if (!rolled) return
    setRolling(true)
    useTokenAnim.getState().setRolling(true) // segura o peão até o dado parar
    setRollKey((k) => k + 1)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setRolling(false)
      useTokenAnim.getState().setRolling(false) // dado caiu → peão pode andar
    }, rollDurationMs)
  }, [game, rollDurationMs])

  // Trava otimista entre o clique e a chegada do resultado (online): o botão não aceita
  // clique duplo e o peão não sai andando antes do efeito acima assumir. O timeout é
  // fallback — se o comando se perder, destrava; se o resultado chegar, o efeito
  // reagenda por cima (mesmo timeoutRef).
  function armRoll() {
    setRolling(true)
    useTokenAnim.getState().setRolling(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setRolling(false)
      useTokenAnim.getState().setRolling(false)
    }, rollDurationMs)
  }

  // Só o dono da decisão vê os controles (spec 038, FR-002). Sem sala, `mayAct` é sempre
  // true e a arena segue idêntica ao cliente único (FR-029/SC-007).
  const local = useLocalView()
  const v = diceArenaView(game, local, { rolling, activeName: active?.name })
  const { canRoll, canFinalize, canBus, canJailDecide, purchase } = v
  const [d1, d2] = v.dice
  const sd: SpeedFace = v.speed != null ? toUiSpeedFace(v.speed) : 'one'

  function handleRoll() {
    if (!canRoll) return
    armRoll()
    rollDiceCmd() // motor: rola, move e abre a resolução da casa
  }

  // Tentar sair da prisão na dupla — anima o dado igual ao rolar normal.
  function handleJailTry() {
    if (rolling) return
    armRoll()
    jailDecision('try') // rola 2 brancos; dupla = sai e move; senão passa a vez
  }

  const { isDoubleReroll, status } = v

  return (
    <div className="dice-arena flex flex-col items-center gap-3">
      {/* Jogador da vez — carinha + nome acima dos dados. Mantém o gesto ativo,
          sem o anel pontilhado que competia com os dados no centro. */}
      <div className="flex flex-col items-center gap-1.5">
        <PlayerFace
          color={active.color}
          avatar={active.avatar}
          skin={active.skin}
          active={canRoll}
          showActiveRing={false}
          size={72}
        />
        <p className="display text-cream text-xl leading-none tracking-wide">
          {active.name}
        </p>
        <p className={cn('label', isDoubleReroll ? 'text-gold font-bold' : 'text-cream-muted')}>{status}</p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Dice value={d1} rollKey={rollKey} />
        <Dice value={d2} rollKey={rollKey} />
        {THEME.SPEED_DIE_ENABLED && active.speedDieReady && <SpeedDie face={sd} rollKey={rollKey} />}
      </div>
      {/* Zona de ação contextual — embaixo dos dados (sem modal de compra). Só para quem
          decide: na tela dos demais fica o estado, sem botão morto (FR-003).
          O `isActor` fechando a zona inteira NÃO é redundância: `canRoll`/`canJailDecide` já
          filtravam por ator, mas `canFinalize` e `purchase` vinham direto do `GameState`, e a
          tela de quem observava mostrava "Finalizar turno"/"Comprar" acionáveis — mais o
          "Rolar dados" desabilitado, o botão morto que este comentário sempre disse não
          existir. Um portão só, na entrada, em vez de um gate por botão. */}
      {v.isActor && (
      <div className="flex flex-col items-center gap-2 w-full max-w-[280px]">
        {purchase ? (
            <div className="flex gap-2 w-full">
              <TurnActionBtn
                variant="primary"
                className="flex-[3]"
                disabled={!purchase.affordable}
                icon={<ShopIcon size={17} className="shrink-0" />}
                onClick={() => buyProperty()}
              >
                {purchase.discounted ? (
                  <span className="inline-flex items-baseline gap-1.5">
                    Comprar
                    <span className="line-through opacity-55">R$ {purchase.listPrice}</span>
                    <span className="font-bold">R$ {purchase.price}</span>
                  </span>
                ) : (
                  <>Comprar R$ {purchase.price}</>
                )}
              </TurnActionBtn>
              <TurnActionBtn
                variant="secondary"
                className="flex-1"
                icon={<GavelIcon size={15} className="shrink-0" />}
                onClick={() => declineProperty()}
                title="Recusar e mandar a leilão"
              >
                Leilão
              </TurnActionBtn>
            </div>
        ) : canJailDecide ? (
          <div className="flex gap-2 w-full">
            <TurnActionBtn
              variant="primary"
              className="flex-[2]"
              disabled={rolling}
              icon={<DiceIcon size={18} className="shrink-0" />}
              onClick={handleJailTry}
            >
              {rolling ? 'Rolando…' : 'Tentar dupla'}
            </TurnActionBtn>
            <TurnActionBtn
              variant="secondary"
              className="flex-1"
              disabled={!v.canPayJailFine}
              onClick={() => jailDecision('pay')}
              title="Pagar a fiança e sair"
            >
              Pagar R$ {v.jailFine}
            </TurnActionBtn>
          </div>
        ) : canFinalize ? (
          <div className="flex gap-2 w-full">
            {canBus && <BusTicketAction count={activeBusTickets} onClick={() => useBusTicketUI.getState().arm()} />}
            <TurnActionBtn variant="primary" onClick={() => finalizeTurn()} className="min-w-0 flex-1 px-3 text-sm">
              Finalizar turno
            </TurnActionBtn>
          </div>
        ) : (
          <div className="flex gap-2 w-full">
            {canBus && <BusTicketAction count={activeBusTickets} onClick={() => useBusTicketUI.getState().arm()} />}
            <TurnActionBtn
              variant="primary"
              disabled={!canRoll}
              icon={<DiceIcon size={18} className="shrink-0" />}
              onClick={handleRoll}
              className={cn(
                'dice-roll-button min-w-0 flex-1',
                canBus && 'px-3 text-sm',
                rolling && 'dice-roll-button--rolling',
              )}
            >
              {rolling ? 'Rolando…' : 'Rolar dados'}
            </TurnActionBtn>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

// Empréstimo ativo do jogador da vez (010, §15) — visível e quitável a qualquer
// momento do turno. Mostra credor, principal e o quanto sangra a cada GO.
function LoanPanel() {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const dispatch = useGameStore((s) => s.dispatch)
  const payOffLoan = (): void => dispatch({ kind: 'pay-off-loan' })
  const active = game.players[game.turnOrder[game.activeSeat]]
  const loan = game.loans.find((l) => l.debtorId === active.id)
  if (!loan) return null
  const creditor = identityOf(room, loan.creditorId)
  const interest = Math.round((loan.principal * loan.ratePct) / 100)
  const canPay = active.cash >= loan.principal
  return (
    <div className="side-panel-section">
      <SectionHeader title="Empréstimo ativo" meta={<Chip tone="alert">{loan.ratePct}% por volta</Chip>} />
      <div className="flex items-center gap-2 mb-2.5">
        <span className="label text-cream-muted">Você deve a</span>
        <PlayerFace color={creditor.color} avatar={creditor.avatar} skin={creditor.skin} size={20} />
        <span className="display text-cream text-sm leading-none">{creditor.name}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-cream-muted">Principal</span>
        <span className="currency text-cream tabular-nums">{money(loan.principal)}</span>
      </div>
      <div className="flex items-center justify-between text-sm mt-1">
        <span className="text-cream-muted">Juros ao passar pelo GO</span>
        <span className="currency text-logo tabular-nums">− {money(interest)}</span>
      </div>
      <Button
        disabled={!canPay}
        onClick={payOffLoan}
        title={canPay ? 'Pagar o principal e encerrar o empréstimo' : 'Caixa insuficiente para o principal'}
        className="w-full mt-3"
      >
        {canPay ? `Quitar · ${money(loan.principal)}` : `Falta ${money(loan.principal - active.cash)} para quitar`}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------
// Pote da Loteria — herói do painel direito. É o pote de Férias (SRS §13.4):
// cresce com impostos/multas e quem parar em Férias leva tudo. O globo da
// loteria vira marca-d'água; mudanças de valor ganham pop + delta flutuante.
// ---------------------------------------------------------------------
function PotCard({ pot }: { pot: number }) {
  const { reduced } = useMotion()
  // Feedback de caixa (024.1; extraído em 044/T020 — mesmo pulso de `PlayerRow`).
  const pulse = useMoneyPulse(pot, 1400)

  return (
    <section
      className="relative overflow-hidden rounded-[var(--radius-card)] border-2 px-5 py-4 text-center shrink-0"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-brass) 45%, transparent)',
        background: 'radial-gradient(130% 105% at 50% 0%, color-mix(in srgb, var(--color-brass) 20%, transparent) 0%, var(--color-coffee-900) 62%)',
        boxShadow: 'inset 0 0 30px color-mix(in srgb, var(--color-brass) 8%, transparent), var(--shadow-card)',
      }}
    >
      {/* marca-d'água: globo da loteria espiando pelo canto */}
      <div className="absolute -right-3 -bottom-4 pointer-events-none opacity-[0.16]" aria-hidden>
        <LotteryGlyph size={88} />
      </div>

      <p className="label text-gold tracking-[var(--tracking-caps)] flex items-center justify-center gap-1.5">
        <CoinIcon size={13} className="text-gold" /> Pote da Loteria
      </p>

      <motion.p
        key={pot}
        initial={reduced ? false : { scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 18 }}
        className="currency text-gold-glow leading-none mt-2.5"
        style={{ fontSize: 40, textShadow: '0 2px 16px color-mix(in srgb, var(--color-brass) 55%, transparent)' }}
      >
        <span className="text-gold-soft text-lg align-top mr-0.5">R$</span>
        {pot.toLocaleString('pt-BR')}
      </motion.p>

      <p className="label text-cream-muted mt-2 text-micro">
        {pot > 0 ? 'Pare em Loteria e leve tudo' : 'Impostos e multas acumulam aqui'}
      </p>

      <MoneyPulse pulse={pulse} className="right-4 top-3" tone="gold" />
    </section>
  )
}

export function ActionsPanel() {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const pot = game.centerPot
  const proposals = game.tradeProposals
  const identityById = Object.fromEntries(
    game.players.map((p) => [p.id, identityOf(room, p.id)]),
  )

  return (
    <aside className="side-panel">
      <PotCard pot={pot} />

      <HandPanel />

      <LoanPanel />

      <div className="side-panel-section">
        <SectionHeader
          title="Negociações"
          meta={proposals.length > 0
            ? <Chip tone="gold">{proposals.length} {proposals.length === 1 ? 'ativa' : 'ativas'}</Chip>
            : <Chip>nenhuma</Chip>}
        />
        {proposals.length === 0 ? (
          <EmptyState
            icon={<SwapMiniGlyph />}
            title="Nenhuma proposta na mesa"
            hint="Troque propriedades e dinheiro com outros jogadores"
          />
        ) : (
          <div className="trade-panel__list" aria-label="Propostas ativas">
            {proposals.map((proposal) => (
              <TradeRow key={proposal.id} proposal={proposal} identityById={identityById} />
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          onClick={() => useTradeUI.getState().show()}
          aria-label="Nova negociação"
          title="Criar uma nova proposta"
          className="trade-panel__new-action w-full label text-gold text-[0.625rem]"
        >
          <PlusGlyph size={11} />
          <span className="side-action-label">Nova negociação</span>
          <span className="side-action-label--compact">Propor</span>
        </Button>
      </div>
    </aside>
  )
}

function TradeRow({
  proposal,
  identityById,
}: {
  proposal: TradeProposal
  identityById: Record<string, ReturnType<typeof identityOf>>
}) {
  const { trade } = proposal
  const from = identityById[trade.fromId] ?? identityOf(null, trade.fromId)
  const to = identityById[trade.toId] ?? identityOf(null, trade.toId)
  return (
    <div className="trade-row">
      <div className="trade-row__route" aria-label={`${from.name} propõe uma troca com ${to.name}`}>
        <div className="trade-row__player">
          <PlayerFace color={from.color} avatar={from.avatar} skin={from.skin} size={28} />
          <span>{from.name}</span>
        </div>
        <TradeArrowGlyph size={13} />
        <div className="trade-row__player">
          <PlayerFace color={to.color} avatar={to.avatar} skin={to.skin} size={28} />
          <span>{to.name}</span>
        </div>
      </div>

      <Button
        variant="ghost"
        onClick={() => useTradeUI.getState().view(proposal.id)}
        aria-label={`Ver proposta de ${from.name} para ${to.name}`}
        className="trade-row__action label text-gold"
      >
        <span>Ver proposta</span>
        <span className="trade-row__action-arrow" aria-hidden>
          <TradeArrowGlyph size={12} />
        </span>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------
// CenterArena — composição premium do miolo do tabuleiro.
// Layout simétrico: dados centralizados pra arremesso, decks nos cantos
// inferiores, padrão de estrelas no fundo.
// ---------------------------------------------------------------------
// Renderiza a LogSentence (fragmentos tipados de describeLogEntry, 040) — cada tipo de
// fragmento tem seu próprio estilo, em vez de re-parsear uma frase pronta com regex.
function LogSentenceView({ sentence }: { sentence: ReturnType<typeof describeLogEntry> }) {
  return (
    <>
      {sentence.map((f, i) => {
        switch (f.t) {
          case 'money':
            return <span key={i} className="currency font-bold" style={{ color: 'var(--color-brass-glow)' }}>{money(f.amount)}</span>
          case 'player':
            return <span key={i} className="font-semibold" style={{ color: f.identity.color }}>{f.identity.name}</span>
          case 'place':
            return <span key={i}>{BOARD[f.pos]?.name ?? `#${f.pos}`}</span>
          case 'text':
            return <span key={i}>{f.text}</span>
          default:
            return null
        }
      })}
    </>
  )
}

// Diário de bordo ao vivo no CENTRO do tabuleiro — linha do tempo com
// trilho, avatar do autor (PlayerFace piscando, sem bob), glifo do tipo de
// evento e o lançamento mais RECENTE destacado na cor de quem jogou.
// Seletor estável (`s.game.log`) + reverse no corpo — recência ao topo (021).
// A frase e a cor vêm da identidade da SALA (040/FR-019) — nunca de `PLAYER_COLORS[i]`
// nem do id cru: é o que mata `p1` desta tela em definitivo (SC-001).
function CenterLog() {
  const log = useGameStore((s) => s.game.log)
  const room = useRoomStore((s) => s.room)
  const { reduced } = useMotion()
  const history = [...log].reverse()
  const colorOf = (who: string): string => (who === 'bank' ? 'var(--color-signal)' : identityOf(room, who).color)
  return (
    <div className="center-log flex-1 min-h-0 w-full flex flex-col rounded-[var(--radius-card)] border overflow-hidden">
      {/* Cabeçalho: título + contador de lançamentos (primitivo padrão) */}
      <SectionHeader
        className="px-3 pt-2 pb-1.5 mb-0 shrink-0 border-b border-coffee-500/40"
        title="Diário de bordo"
        meta={history.length > 0 ? (
          <span className="label text-cream-muted tabular-nums text-micro">
            {history.length} {history.length === 1 ? 'lançamento' : 'lançamentos'}
          </span>
        ) : undefined}
      />
      {history.length === 0 ? (
        <div className="center-log-empty flex-1 m-3" role="status">
          <svg viewBox="0 0 280 86" aria-hidden="true">
            <path className="center-log-empty__route" d="M18 66 78 28l55 25 58-35 71 43" />
            {[18, 78, 133, 191, 262].map((x, index) => {
              const y = [66, 28, 53, 18, 61][index]
              return (
                <g key={x}>
                  <circle cx={x} cy={y} r={index === 0 ? 7 : 5} />
                  <circle cx={x} cy={y} r="1.5" />
                </g>
              )
            })}
            <path className="center-log-empty__marker" d="m126 45 13 8-13 8 3-8Z" />
          </svg>
          <p>Rota ainda não traçada</p>
          <span>O primeiro lançamento abre o diário.</span>
        </div>
      ) : (
        <AccessoryErrorBoundary label="Histórico">
        <ol
          tabIndex={0}
          aria-label="Histórico de lançamentos"
          className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2"
        >
          {/* trilho da linha do tempo, atravessando os avatares */}
          <span aria-hidden className="absolute top-2 bottom-2 w-px bg-coffee-500/45" style={{ left: 23 }} />
          {history.map((l, i) => {
            const c = colorOf(l.who)
            const idx = log.length - 1 - i // índice original — key estável em log append-only
            const latest = i === 0
            return (
              <motion.li
                key={idx}
                initial={reduced ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: MOTION.base, ease: EASE.standard }}
                className={cn(
                  'relative flex items-start gap-2 py-1.5 pl-0.5 pr-1 rounded-[var(--radius-sharp)]',
                  latest && 'my-0.5',
                )}
                style={latest ? {
                  background: `linear-gradient(90deg, color-mix(in srgb, ${c} 13%, transparent) 0%, transparent 85%)`,
                  boxShadow: `inset 2px 0 0 0 ${c}`,
                } : undefined}
              >
                {/* avatar do autor sobre o trilho — Banco tem selo próprio */}
                <span className="relative z-10 shrink-0 mt-px" style={{ marginLeft: 1 }}>
                  {l.who === 'bank' ? (
                    <span
                      className="grid place-items-center rounded-full border"
                      style={{
                        width: 20,
                        height: 20,
                        background: 'color-mix(in srgb, var(--color-signal) 25%, var(--color-ink-900))',
                        borderColor: 'var(--color-signal)',
                      }}
                    >
                      <CoinIcon size={11} className="text-cream" />
                    </span>
                  ) : (
                    <PlayerFace
                      color={c}
                      avatar={identityOf(room, l.who).avatar}
                      skin={identityOf(room, l.who).skin}
                      size={20}
                      className="!animate-none"
                    />
                  )}
                </span>
                <span className="flex-1 min-w-0 leading-snug text-cream-muted" style={{ fontSize: latest ? '13.5px' : '13px' }}>
                  <LogSentenceView sentence={describeLogEntry(l, room)} />
                </span>
                {/* glifo do tipo de evento — dourado no lançamento fresco */}
                <span className={cn('shrink-0 mt-0.5', latest ? 'text-gold' : 'text-cream-muted/50')}>
                  {logIcon(l.kind)}
                </span>
              </motion.li>
            )
          })}
        </ol>
        </AccessoryErrorBoundary>
      )}
    </div>
  )
}

export function CenterArena() {
  const boardTheme = useBoardTheme((t) => t.theme)
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ containerType: 'inline-size' }}
    >
      {/* Luz de mesa: brilho do metal do tema sob o centro */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 62% 52% at center, color-mix(in srgb, var(--color-brass) 9%, transparent) 0%, color-mix(in srgb, var(--color-brass) 0%, transparent) 65%)',
        }}
      />

      {/* CENÁRIO por tema: carta náutica (Atlas) · poente synthwave (Fliperama) — um mundo
          por tema, os dois em `glyphs/patterns`. */}
      {boardTheme === 'neon' ? <GridPattern /> : <ChartPattern />}

      {boardTheme === 'atlas' ? (
        <>
          <div className="board-center__brand" aria-hidden>
            <span>Banco Master</span>
            <i />
            <span>Cidades do Mundo</span>
          </div>
          {/* Molduras da prancheta + cantoneiras de latão */}
          <div className="absolute inset-3 border border-coffee-500/55 rounded-[var(--radius-sharp)] pointer-events-none" />
          <div className="absolute inset-[19px] border border-coffee-500/25 rounded-[var(--radius-sharp)] pointer-events-none" />
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <span
              key={c}
              className="absolute pointer-events-none"
              style={{
                width: 16,
                height: 16,
                top: c.includes('t') ? 9 : 'auto',
                bottom: c.includes('b') ? 9 : 'auto',
                left: c.includes('l') ? 9 : 'auto',
                right: c.includes('r') ? 9 : 'auto',
                borderTop: c.includes('t') ? '1.5px solid color-mix(in srgb, var(--color-brass) 55%, transparent)' : 'none',
                borderBottom: c.includes('b') ? '1.5px solid color-mix(in srgb, var(--color-brass) 55%, transparent)' : 'none',
                borderLeft: c.includes('l') ? '1.5px solid color-mix(in srgb, var(--color-brass) 55%, transparent)' : 'none',
                borderRight: c.includes('r') ? '1.5px solid color-mix(in srgb, var(--color-brass) 55%, transparent)' : 'none',
              }}
            />
          ))}
        </>
      ) : (
        <>
          {/* Moldura de gabinete: filete de néon com cantoneiras acesas */}
          <div
            className="absolute inset-3 pointer-events-none rounded-[var(--radius-sharp)]"
            style={{
              border: '1px solid color-mix(in srgb, var(--color-group-skyblue) 45%, transparent)',
              boxShadow: '0 0 14px -2px color-mix(in srgb, var(--color-group-purple) 55%, transparent)',
            }}
          />
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <span
              key={c}
              className="absolute pointer-events-none"
              style={{
                width: 18,
                height: 18,
                top: c.includes('t') ? 9 : 'auto',
                bottom: c.includes('b') ? 9 : 'auto',
                left: c.includes('l') ? 9 : 'auto',
                right: c.includes('r') ? 9 : 'auto',
                borderTop: c.includes('t') ? '2px solid var(--color-group-pink)' : 'none',
                borderBottom: c.includes('b') ? '2px solid var(--color-group-pink)' : 'none',
                borderLeft: c.includes('l') ? '2px solid var(--color-group-pink)' : 'none',
                borderRight: c.includes('r') ? '2px solid var(--color-group-pink)' : 'none',
                filter: 'drop-shadow(0 0 4px color-mix(in srgb, var(--color-group-pink) 70%, transparent))',
              }}
            />
          ))}
        </>
      )}

      {/* CENTRO — split: dados/boneco em cima, histórico embaixo */}
      <div className="absolute inset-0 flex flex-col items-center justify-start pt-[6%] pb-[5%] px-[6%] gap-3">
        <div className="shrink-0">
          <DiceArena />
        </div>
        <CenterLog />
      </div>

    </div>
  )
}

// =====================================================================
// PropertyModal — Title Deed clicável, estilo Monopoly clássico
// com paleta Café Coado. Mostra: nome + bandeira, tabela completa de
// aluguéis (base / 1-4 casas / hotel / skyscraper), preço, custo de
// casa, hipoteca e dono se houver. Fecha clicando no backdrop ou Esc.
// =====================================================================
function fmtMoney(n: number) {
  if (n == null || Number.isNaN(n)) return '—' // blindagem: nunca quebra por valor ausente
  return n.toLocaleString('pt-BR')
}

// Popover estilo "balão" — abre adjacente à casa clicada, apontando pra
// dentro do tabuleiro (onde sobra espaço). Sem backdrop, sem cobrir tela
// inteira. Fecha com Esc, clicando fora, ou abrindo outra casa.
// Empurra o popover pra DENTRO da viewport quando transborda perto das bordas
// (evita scroll na página inteira). Mede no mount e corrige via translate.
function useViewportClamp() {
  const ref = useRef<HTMLDivElement>(null)
  const [off, setOff] = useState({ x: 0, y: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const clamp = (): void => {
      const m = 8
      const r = el.getBoundingClientRect()
      let dx = 0
      let dy = 0
      if (r.left < m) dx = m - r.left
      else if (r.right > window.innerWidth - m) dx = window.innerWidth - m - r.right
      if (r.top < m) dy = m - r.top
      else if (r.bottom > window.innerHeight - m) dy = window.innerHeight - m - r.bottom
      if (dx || dy) setOff((current) => ({ x: current.x + dx, y: current.y + dy }))
    }
    clamp()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(clamp)
    observer?.observe(el)
    window.addEventListener('resize', clamp)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', clamp)
    }
  }, [])
  return { ref, off }
}

export function PropertyPopover({
  square,
  side,
  onClose,
}: {
  square: PropertySquare
  side: Side
  onClose: () => void
}) {
  const { ref: clampRef, off } = useViewportClamp()
  // Esc fecha
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Posicionamento adjacente — sempre do lado interno do tabuleiro.
  // Geometria do balão vem de `./topology` — este bloco estava escrito TRÊS vezes,
  // uma por popover (property/airport/utility).
  const { position: positionStyle, centerTransform, tail: tailStyle } = popoverPlacement(side)
  const popoverAccent = deedPresentation(square).accent

  return (
    <div
      ref={clampRef}
      style={{
        position: 'absolute',
        zIndex: 65, // acima do card de dívida (z-60) — popover usável pra desipotecar
        transform: `${centerTransform} translate(${off.x}px, ${off.y}px)`,
        ...positionStyle,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        style={{ position: 'relative' }}
      >
        {/* Body do balão — overflow-hidden pra cortar o conteúdo no border-radius.
            `tabIndex={0}` (044/T051, axe `scrollable-region-focusable`): quando o conteúdo
            da propriedade estoura `max-h`, a rolagem precisa estar alcançável pelo teclado. */}
        <div
          tabIndex={0}
          className="atlas-surface atlas-surface--popover deed-popover property-deed
            overflow-x-hidden overflow-y-auto max-h-[calc(100vh-24px)]
          "
          style={{ '--atlas-surface-accent': popoverAccent } as React.CSSProperties}
        >
          <PropertyDeedContent square={square} onClose={onClose} />
        </div>
        {/* Rabicho — dentro do motion.div pra animar junto (opacity + scale) */}
        <div style={tailStyle} />
      </motion.div>
    </div>
  )
}

// Botão de ação do deed — casca compacta (text-xs) sobre o primitivo Button.
function DeedBtn({
  onClick,
  disabled,
  title,
  variant = 'secondary',
  icon,
  className,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
  variant?: 'primary' | 'secondary'
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn('px-2.5 text-xs', className)}
    >
      {icon}
      {children}
    </Button>
  )
}

// EXAUSTIVO por tipo. Era `Record<string, string>` com três das cinco razões, então
// `topo` e `uniformidade` — as duas MAIS comuns para um botão de construir cinzento —
// caíam em `undefined` e a dica renderizava vazia. Com o tipo certo, esquecer uma razão
// nova é erro de compilação em vez de buraco silencioso de UX.
const BUILD_BLOCK_MSG: Record<NonNullable<BuildBlock>, string> = {
  'hipoteca-no-grupo': 'Há propriedade hipotecada no grupo',
  topo: 'Esta cidade já está no nível máximo',
  uniformidade: 'Suba as outras cidades do grupo antes de construir aqui.',
  'limite-posse': 'Tenha mais cidades deste país para avançar.',
  'grupo-incompleto': 'Tenha todas as cidades do país para construir o arranha-céu.',
  caixa: 'Caixa insuficiente',
}

// Ações de gestão (023) — só para o dono da vez. Reusado pelos 3 popovers.
function DeedActions({ pos }: { pos: number }) {
  const game = useGameStore((s) => s.game)
  const dispatch = useGameStore((s) => s.dispatch)
  const buildHouse = (pos: number): void => dispatch({ kind: 'build-house', pos })
  const sellBuilding = (pos: number): void => dispatch({ kind: 'sell-building', pos })
  const buildHangar = (pos: number): void => dispatch({ kind: 'build-hangar', pos })
  const sellHangar = (pos: number): void => dispatch({ kind: 'sell-hangar', pos })
  const mortgageProperty = (pos: number): void => dispatch({ kind: 'mortgage', pos })
  const unmortgageProperty = (pos: number): void => dispatch({ kind: 'unmortgage', pos })

  const dv = deedView(game, pos)
  if (!dv || !dv.ownedByActive) return null
  const { flags } = dv
  const blockMsg = dv.buildBlock ? BUILD_BLOCK_MSG[dv.buildBlock] : undefined
  const mortgageTitle = !flags.podeHipotecar && !dv.mortgaged
    ? dv.kind === 'airport' && dv.hangar
      ? 'Venda o Hangar antes de hipotecar.'
      : dv.kind === 'property'
        ? 'Venda todas as construções do grupo antes de hipotecar.'
        : `Hipotecar por $${dv.mortgageValue}`
    : `Hipotecar por $${dv.mortgageValue}`

  return (
    <div className="deed-actions">
      <p className="property-deed__section-label">Gerenciar</p>
      {dv.kind === 'property' && !flags.podeConstruir && blockMsg && (
        <p className="deed-actions__note">
          <i aria-hidden>!</i>
          <span>{blockMsg}</span>
        </p>
      )}
      <div className="deed-actions__grid" data-kind={dv.kind}>
        {dv.kind === 'property' && (
          <>
            <DeedBtn variant="primary" icon={<HouseIcon size={13} />} disabled={!flags.podeConstruir} onClick={() => buildHouse(pos)} title={blockMsg}>
              Construir
            </DeedBtn>
            <DeedBtn disabled={!flags.podeVender} onClick={() => sellBuilding(pos)}>Vender</DeedBtn>
          </>
        )}
        {dv.kind === 'airport' && (
          <>
            <DeedBtn variant="primary" disabled={!flags.podeConstruirHangar} onClick={() => buildHangar(pos)}>Hangar</DeedBtn>
            <DeedBtn disabled={!flags.podeVenderHangar} onClick={() => sellHangar(pos)}>Vender Hangar</DeedBtn>
          </>
        )}
        {!dv.mortgaged ? (
          <DeedBtn
            className={cn(dv.kind !== 'property' && 'col-span-2')}
            icon={<CoinIcon size={13} />}
            disabled={!flags.podeHipotecar}
            title={mortgageTitle}
            onClick={() => mortgageProperty(pos)}
          >
            Hipotecar
          </DeedBtn>
        ) : (
          <DeedBtn
            className={cn(dv.kind !== 'property' && 'col-span-2')}
            icon={<CoinIcon size={13} />}
            disabled={!flags.podeDeshipotecar}
            title={`Desipotecar por $${dv.unmortgageCost}`}
            onClick={() => unmortgageProperty(pos)}
          >
            Desipotecar
          </DeedBtn>
        )}
      </div>
    </div>
  )
}

type PropertyRentTierKind = 'base' | 'house' | 'hotel' | 'skyscraper'

function PropertyRentTier({
  label,
  value,
  kind,
  count = 1,
  active = false,
}: {
  label: string
  value: number
  kind: PropertyRentTierKind
  count?: number
  active?: boolean
}) {
  const markers = (() => {
    if (kind === 'base') return <PlotBadgeIcon />
    if (kind === 'house') {
      return Array.from({ length: count }, (_, index) => <HouseBadgeIcon key={index} />)
    }
    if (kind === 'hotel') {
      return Array.from({ length: count }, (_, index) => <HotelBadgeIcon key={index} />)
    }
    return <SkyscraperBadgeIcon />
  })()

  return (
    <div
      className="property-rent-tier"
      data-tier={kind}
      data-active={active || undefined}
    >
      {active && <span className="sr-only">Nível atual</span>}
      <span className="property-rent-tier__identity">{label}</span>
      <span className="property-rent-tier__mark" aria-hidden>{markers}</span>
      <span className="property-rent-tier__value">
        <small>R$</small>
        {fmtMoney(value)}
      </span>
    </div>
  )
}

function PropertyDeedContent({ square, onClose }: { square: PropertySquare; onClose: () => void }) {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const dv = deedView(game, square.pos)!
  const presentation = deedPresentation(square)
  const owner = dv.owner
  const ownerIdentity = owner ? identityOf(room, owner) : null
  const buildings = dv.level // 0–7 real
  const rents = presentation.rents
  const houseCost = dv.buildCost
  const mortgage = dv.mortgageValue
  const stripeColor = presentation.accent
  const isMortgaged = dv.mortgaged

  // Linha de aluguel ATIVA (highlight) pelo nível real
  const activeRow: keyof typeof rents =
    buildings === 7 ? 'skyscraper' :
    buildings === 6 ? 'hotel2' :
    buildings >= 5 ? 'hotel' :
    buildings === 4 ? 'house4' :
    buildings === 3 ? 'house3' :
    buildings === 2 ? 'house2' :
    buildings === 1 ? 'house1' :
    'base'

  return (
    <>
      {/* Header com stripe colorida + bandeira + nome */}
      <div
        className="deed-header relative px-4 pt-4 pb-3"
        style={{ '--deed-accent': stripeColor } as React.CSSProperties}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="deed-close absolute top-1.5 right-1.5 w-11 h-11 flex items-center justify-center text-xs transition-colors"
        >
          ✕
        </button>
        <div className="flex items-center gap-2.5 pr-10">
          <div
            className="
              shrink-0 w-9 h-9 rounded-full
              bg-coffee-900 border-2 border-coffee-950
              overflow-hidden
              shadow-[var(--shadow-card)]
            "
          >
            <img
              src={`https://flagcdn.com/${presentation.flagCode.toLowerCase()}.svg`}
              alt={presentation.flagCode}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="display text-starlight text-xl leading-none truncate">
              {presentation.name}
            </h3>
            <p className="label deed-header__meta mt-1 text-micro">
              {presentation.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="property-deed__body">
        <section>
          <p className="property-deed__section-label">Progressão de aluguel</p>
          <div className="property-deed__rent-grid">
            <PropertyRentTier label="Terreno"      value={rents.base}        kind="base"        active={activeRow === 'base'} />
            <PropertyRentTier label="1 casa"       value={rents.house1}      kind="house"       active={activeRow === 'house1'} />
            <PropertyRentTier label="2 casas"      value={rents.house2}      kind="house" count={2} active={activeRow === 'house2'} />
            <PropertyRentTier label="3 casas"      value={rents.house3}      kind="house" count={3} active={activeRow === 'house3'} />
            <PropertyRentTier label="4 casas"      value={rents.house4}      kind="house" count={4} active={activeRow === 'house4'} />
            <PropertyRentTier label="Hotel"        value={rents.hotel}       kind="hotel"       active={activeRow === 'hotel'} />
            <PropertyRentTier label="2º hotel"     value={rents.hotel2}      kind="hotel" count={2} active={activeRow === 'hotel2'} />
            <PropertyRentTier label="Arranha-céu" value={rents.skyscraper} kind="skyscraper"  active={activeRow === 'skyscraper'} />
          </div>
        </section>

        <dl className="property-deed__facts" aria-label="Valores do título">
          <div className="property-deed__fact">
            <dt>Preço</dt>
            <dd>R$ {fmtMoney(square.price)}</dd>
          </div>
          <div className="property-deed__fact">
            <dt>Casa</dt>
            <dd>R$ {fmtMoney(houseCost)}</dd>
          </div>
          <div className="property-deed__fact">
            <dt>Hipoteca</dt>
            <dd>R$ {fmtMoney(mortgage)}</dd>
          </div>
        </dl>

        {(ownerIdentity || isMortgaged) && (
          <div className="property-deed__status">
            {ownerIdentity && (
              <div className="property-deed__owner">
                <PlayerFace
                  color={ownerIdentity.color}
                  avatar={ownerIdentity.avatar}
                  skin={ownerIdentity.skin}
                  size={30}
                  className="property-deed__owner-avatar"
                />
                <span className="property-deed__owner-copy">
                  <span>Dono</span>
                  <strong>{ownerIdentity.name}</strong>
                </span>
              </div>
            )}
            {isMortgaged && (
              <Chip tone="alert" className="ml-auto text-nano">Hipotecada</Chip>
            )}
          </div>
        )}

        <DeedActions pos={square.pos} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------
// AirportPopover — regras e aluguel de aeroporto (SRS §2.4 + §13.6)
// ---------------------------------------------------------------------
export function AirportPopover({
  square,
  side,
  onClose,
}: {
  square: AirportSquare
  side: Side
  onClose: () => void
}) {
  const { ref: clampRef, off } = useViewportClamp()
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Geometria do balão vem de `./topology` — este bloco estava escrito TRÊS vezes,
  // uma por popover (property/airport/utility).
  const { position: positionStyle, centerTransform, tail: tailStyle } = popoverPlacement(side)
  const presentation = deedPresentation(square)

  return (
    <div ref={clampRef} style={{ position: 'absolute', zIndex: 65, transform: `${centerTransform} translate(${off.x}px, ${off.y}px)`, ...positionStyle }} onClick={(e) => e.stopPropagation()}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }} style={{ position: 'relative' }}>
        <div className="atlas-surface atlas-surface--popover deed-popover w-[270px] overflow-hidden">
          {/* Header integrado à prancha Atlas. */}
          <div className="deed-header relative px-4 pt-4 pb-3" style={{ '--deed-accent': 'var(--color-brass)' } as React.CSSProperties}>
            <button onClick={onClose} aria-label="Fechar" className="deed-close absolute top-1.5 right-1.5 w-11 h-11 flex items-center justify-center text-xs transition-colors">✕</button>
            <div className="flex items-center gap-2.5 pr-10">
              <div className="shrink-0 w-9 h-9 flex items-center justify-center">
                <SquareIcon square={square} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="display text-starlight text-lg leading-none truncate">{presentation.name}</h3>
                <span className="deed-header__tag inline-block mt-1 px-1.5 py-0.5 font-bold" style={{ fontSize: '10px', letterSpacing: '0.08em' }}>{square.iata}</span>
              </div>
            </div>
          </div>
          {/* Corpo */}
          <div className="px-3.5 py-3">
            <p className="label text-gold mb-2 text-micro">Aluguel por aeroportos possuídos</p>
            <div className="flex flex-col gap-0.5">
              {presentation.rentRows.map((row, index) => (
                <CompactRent key={row.key} label={row.label} value={row.value} accent={index === presentation.rentRows.length - 1} />
              ))}
            </div>
            {/* Hangar bonus */}
            <div className="mt-3 pt-2.5 border-t border-coffee-500/60">
              <p className="text-cream-muted text-micro">
                O <span className="text-gold font-semibold">Hangar</span> dobra o aluguel deste aeroporto individualmente.
              </p>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
              <CompactRent label="Preço"    value={presentation.price}    muted />
              <CompactRent label="Hipoteca" value={presentation.mortgage} muted />
            </div>
            <DeedActions pos={square.pos} />
          </div>
        </div>
        <div style={tailStyle} />
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------
// UtilityPopover — regras e aluguel de utilidade (SRS §2.5)
// ---------------------------------------------------------------------
export function UtilityPopover({
  square,
  side,
  onClose,
}: {
  square: UtilitySquare
  side: Side
  onClose: () => void
}) {
  const { ref: clampRef, off } = useViewportClamp()
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Geometria do balão vem de `./topology` — este bloco estava escrito TRÊS vezes,
  // uma por popover (property/airport/utility).
  const { position: positionStyle, centerTransform, tail: tailStyle } = popoverPlacement(side)

  const accentColor = square.icon === 'fuel' ? 'var(--color-group-green)' : square.icon === 'bolt' ? 'var(--color-brass-glow)' : 'var(--color-group-orange)'
  const presentation = deedPresentation(square)

  return (
    <div ref={clampRef} style={{ position: 'absolute', zIndex: 65, transform: `${centerTransform} translate(${off.x}px, ${off.y}px)`, ...positionStyle }} onClick={(e) => e.stopPropagation()}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }} style={{ position: 'relative' }}>
        <div
          className="atlas-surface atlas-surface--popover deed-popover w-[270px] overflow-hidden"
          style={{ '--atlas-surface-accent': accentColor } as React.CSSProperties}
        >
          {/* Header integrado, com a cor do tipo restrita ao filete. */}
          <div className="deed-header relative px-4 pt-4 pb-3" style={{ '--deed-accent': accentColor } as React.CSSProperties}>
            <button onClick={onClose} aria-label="Fechar" className="deed-close absolute top-1.5 right-1.5 w-11 h-11 flex items-center justify-center text-xs transition-colors">✕</button>
            <div className="flex items-center gap-2.5 pr-10">
              <div className="shrink-0 w-9 h-9 flex items-center justify-center">
                <SquareIcon square={square} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="display text-starlight text-lg leading-none truncate">{presentation.name}</h3>
                <p className="label deed-header__meta mt-1 text-micro">{presentation.subtitle}</p>
              </div>
            </div>
          </div>
          {/* Corpo */}
          <div className="px-3.5 py-3">
            <p className="label text-gold mb-2 text-micro">Aluguel baseado nos dados</p>
            <div className="flex flex-col gap-0.5">
              {presentation.rentRows.map((row, index) => (
                <CompactRentText
                  key={row.key}
                  label={row.label}
                  value={`${row.value}× os dados`}
                  accent={index === presentation.rentRows.length - 1}
                />
              ))}
            </div>
            <div className="mt-3 pt-2.5 border-t border-coffee-500/60">
              <p className="text-cream-muted text-micro">
                O aluguel é o total dos dados × o multiplicador. Não recebe construções.
              </p>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
              <CompactRent label="Preço"    value={presentation.price}    muted />
              <CompactRent label="Hipoteca" value={presentation.mortgage} muted />
            </div>
            <DeedActions pos={square.pos} />
          </div>
        </div>
        <div style={tailStyle} />
      </motion.div>
    </div>
  )
}

// Linha compacta com valor textual (não monetário) — para utilidades.
export function CompactRentText({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1.5 py-1 rounded-[var(--radius-sharp)]">
      <span className="text-xs leading-none text-cream">{label}</span>
      <span className={cn('text-xs leading-none whitespace-nowrap', accent ? 'text-logo font-semibold' : 'text-gold-glow')}>{value}</span>
    </div>
  )
}

// Linha compacta da tabela de aluguel — versão menor pra caber no popover.
export function CompactRent({
  label,
  value,
  active = false,
  muted = false,
  accent = false,
}: {
  label: string
  value: number
  active?: boolean
  muted?: boolean
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-2 px-1.5 py-1 rounded-[var(--radius-sharp)]',
        active && 'bg-gold/15 ring-1 ring-gold/50',
      )}
    >
      <span
        className={cn(
          'text-xs leading-none',
          muted ? 'text-cream-muted' : 'text-cream',
          active && 'text-gold-glow font-medium',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'currency leading-none whitespace-nowrap',
          muted ? 'text-cream' : 'text-gold-glow',
          accent && !muted && !active && 'text-logo font-semibold',
          active && 'text-gold-glow font-bold',
        )}
        style={{ fontSize: active ? '13px' : '12px' }}
      >
        <span className="text-gold-soft text-[0.7em] mr-0.5">R$</span>
        {fmtMoney(value)}
      </span>
    </div>
  )
}
