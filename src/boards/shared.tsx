import { cn } from '@/lib/utils'
import { Bus, Crown } from 'lucide-react'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { Square, PropertySquare, AirportSquare, TaxSquare, UtilitySquare, GroupKey } from '@/lib/boardData'
import { BOARD } from '@/lib/boardData'
import { rentLadder } from '@/game/economy/rent'
import { useGameStore } from '@/game/store'
import { useLocalView, useRoomStore } from '@/net/roomStore'
import { cityLevel } from '@/game/economy/construction'
import { THEME } from '@/game/theme'
import { deedView } from '@/game/ui/deed/deedView'
import { useTradeUI } from '@/game/ui/trade/TradeLayer'
import { useBusTicketUI } from '@/game/ui/busTicketUI'
// `sideOf` do motor (lado do tabuleiro p/ regra do Bus Ticket) ≠ `sideOf` local (layout).
import { markLayout, popoverPlacement, sideOf, type Side } from './topology'
import { SquareIcon, CardGlyph, LotteryGlyph } from './glyphs/squares'
import {
  HouseBadgeIcon, HotelBadgeIcon, SkyscraperBadgeIcon, HangarBadgeIcon,
  CalmGlyph, TradeArrowGlyph, PlusGlyph, SwapMiniGlyph, CheckTinyGlyph,
} from './glyphs/badges'
import { ChartPattern, GuillochePattern } from './glyphs/patterns'
import { playersView, PLAYER_COLORS, type Player } from '@/game/ui/panels/playersView'
import { diceArenaView } from '@/game/ui/panels/diceArenaView'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'
import { HandPanel } from '@/game/ui/cards/HandPanel'
import { useTokenAnim } from '@/game/ui/tokenAnim'
import { ShopIcon, GavelIcon, DiceIcon, CoinIcon, HouseIcon } from '@/game/ui/icons'
import { Button, SectionHeader, Chip, EmptyState } from '@/game/ui/primitives'
import type { TempEffect, Trade } from '@/game/economy/types'

// Reexportados porque a UI já os importa daqui; as FONTES são `./topology` e `./glyphs/*`.
export { sideOf, SquareIcon, type Side }
export { playersView, PLAYER_COLORS, type Player } // fonte: @/game/ui/panels/playersView

// Cores dos grupos como var() de --color-group-* — seguem o TEMA ativo do
// tabuleiro (Atlas/Café) em runtime. Usadas onde Tailwind class não dá
// (style inline, gradientes, color-mix, modal etc).
export const GROUP_COLOR: Record<string, string> = {
  brown:   'var(--color-group-brown)',
  skyblue: 'var(--color-group-skyblue)',
  pink:    'var(--color-group-pink)',
  orange:  'var(--color-group-orange)',
  red:     'var(--color-group-red)',
  yellow:  'var(--color-group-yellow)',
  green:   'var(--color-group-green)',
  navy:    'var(--color-group-navy)',
  purple:  'var(--color-group-purple)',
  platinum: 'var(--color-group-platinum)', // Emirados (super-luxo) — ônix (033)
}

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
      className="absolute rounded-full border-2 border-coffee-950 bg-coffee-900 overflow-hidden pointer-events-none z-40"
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

  // Dono atual (real, do store) — cor por assento; comunica a posse na célula (023.1).
  const ownerColor = useGameStore((s) => {
    const t = s.game.titles[square.pos]
    if (!t?.ownerId) return undefined
    const i = s.game.players.findIndex((p) => p.id === t.ownerId)
    return i >= 0 ? PLAYER_COLORS[i % PLAYER_COLORS.length] : undefined
  })
  // Tema ativo — decide o TRATAMENTO da casa (não só cor): posse, chip etc.
  const boardTheme = useBoardTheme((t) => t.theme)
  // Propriedade COMPRADA não exibe valor — a posse é comunicada pela stripe
  // colorida do jogador. Só propriedade À VENDA (sem dono) mostra o preço.

  // O flag transborda pelo lado interno da célula sobre o centro do
  // tabuleiro em todos os lados — `.board-square` precisa rodar sem
  // `overflow-hidden` pra metade externa do círculo não ser cortada.
  return (
    <div className="board-square relative w-full h-full">
      {/* POSSE por TEMA:
            Atlas — a cidade ACENDE: luz interna na cor do dono + fio de néon
            na borda, como cidade iluminada vista do alto à noite.
            Café — tratamento clássico de papel: tint + moldura na cor do dono. */}
      {ownerColor && (boardTheme === 'atlas' ? (
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
      ) : (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: ownerColor, opacity: 0.14 }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `inset 0 0 0 2px ${ownerColor}, inset 0 0 0 3px color-mix(in srgb, var(--color-ink-950) 55%, transparent)`,
            }}
          />
        </>
      ))}
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
                    className="absolute currency leading-none whitespace-nowrap"
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
            <div style={{ fontSize: 32 }} className="leading-none">
              <SquareIcon square={square} size="1em" />
            </div>
          )}
          {isAirport && (
            <p
              className="display mt-1 text-cream leading-none tracking-wider"
              style={{ fontSize: '14px' }}
            >
              {(square as AirportSquare).name}
            </p>
          )}
          {isUtility && (
            <p
              className="display mt-1 text-cream leading-none tracking-wide"
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
              <p className="display mt-1 text-cream leading-none" style={{ fontSize: '14px' }}>
                Taxa
              </p>
              <p className="currency text-logo leading-none" style={{ fontSize: '14px' }}>
                <span className="text-cream-muted text-[0.7em] mr-0.5">R$</span>
                {(square as TaxSquare).amount}
              </p>
            </>
          )}
          {isAcaso && (
            <p className="display mt-1 text-cream leading-none" style={{ fontSize: '14px' }}>
              Acaso
            </p>
          )}
          {isTesouro && (
            <p className="display mt-1 text-cream leading-none" style={{ fontSize: '14px' }}>
              Tesouro
            </p>
          )}
          {isBus && (
            <p className="display mt-1 text-cream leading-none tracking-wide text-center" style={{ fontSize: '14px' }}>
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
      <div className="leading-none" style={{ fontSize: 56 }}>
        <SquareIcon square={square} size="1em" />
      </div>
      <p
        className="display mt-1 text-cream leading-none"
        style={{ fontSize: '14px' }}
      >
        {label}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------
// PlayerFace — carinha SVG simples (cabeça redonda + olhos + sorriso).
// Usada tanto como peça no tabuleiro quanto como avatar nos painéis.
// Animações: bob (respiração), blink (piscada) e pulse extra pro jogador
// da vez. Cada player tem delays dessincronizados via hash da cor.
// ---------------------------------------------------------------------
function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) & 0xffff)
  return h
}

export function PlayerFace({
  color,
  size = 24,
  active = false,
  asleep = false,
  className,
}: {
  color: string
  size?: number | string
  active?: boolean
  asleep?: boolean
  className?: string
}) {
  // Fallback de cor: nunca pinta a cabeça de preto se a cor vier vazia/indefinida.
  const head = color || 'var(--color-ink-400)'
  // Delays únicos por player pra blink/bob não rodarem em sincronia.
  const h = hashStr(head)
  const bobDelay = `${(h % 2400) / 1000}s`
  const blinkDelayL = `${((h + 1300) % 5000) / 1000}s`
  const blinkDelayR = `${((h + 1430) % 5000) / 1000}s`  // levemente diferente

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn(
        'shrink-0',
        !asleep && (active ? 'face-idle-active' : 'face-idle'),
        className,
      )}
      style={{
        filter: active ? `drop-shadow(0 0 4px color-mix(in srgb, ${head} 70%, transparent))` : undefined,
        animationDelay: !asleep ? bobDelay : undefined,
      }}
      aria-hidden="true"
    >
      {/* Sombra da cabeça */}
      <ellipse cx="16" cy="30" rx="11" ry="1.6" fill="rgba(0,0,0,0.45)" />

      {/* Cabeça */}
      <circle cx="16" cy="15" r="13" fill={head} stroke="var(--color-ink-950)" strokeWidth="1.5" />

      {/* Highlight 3D no topo */}
      <ellipse
        cx="12"
        cy="9"
        rx="5.5"
        ry="3.5"
        fill="rgba(255,255,255,0.28)"
      />

      {/* Olhos — abertos ou fechados se "asleep" (jogador falido) */}
      {asleep ? (
        <>
          <path d="M9 15 Q11 16.5 13 15" stroke="var(--color-ink-950)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M19 15 Q21 16.5 23 15" stroke="var(--color-ink-950)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Olho esquerdo (cada um piscando com delay próprio) */}
          <g className="face-eye" style={{ animationDelay: blinkDelayL }}>
            <circle cx="11" cy="14.5" r="2.2" fill="#fff" />
            <circle cx="11.4" cy="14.8" r="1.2" fill="var(--color-ink-950)" />
            <circle cx="11.0" cy="14.4" r="0.4" fill="#fff" />
          </g>
          {/* Olho direito */}
          <g className="face-eye" style={{ animationDelay: blinkDelayR }}>
            <circle cx="21" cy="14.5" r="2.2" fill="#fff" />
            <circle cx="21.4" cy="14.8" r="1.2" fill="var(--color-ink-950)" />
            <circle cx="21.0" cy="14.4" r="0.4" fill="#fff" />
          </g>
        </>
      )}

      {/* Boca */}
      {asleep ? (
        <line x1="13" y1="22" x2="19" y2="22" stroke="var(--color-ink-950)" strokeWidth="1.3" strokeLinecap="round" />
      ) : (
        <path
          d="M11.5 20.5 Q16 24 20.5 20.5"
          stroke="var(--color-ink-950)"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* Anel giratório do jogador da vez — na COR do player (não dourado fixo) */}
      {active && (
        <circle
          cx="16"
          cy="15"
          r="14.5"
          fill="none"
          stroke={head}
          strokeWidth="1.5"
          strokeDasharray="2 2"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 16 15"
            to="360 16 15"
            dur="14s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  )
}

export function BuildingMark({ pos }: { pos: number }) {
  const title = useGameStore((s) => s.game.titles[pos])
  const n = title ? cityLevel(title) : 0 // 0–7 real (023)
  if (!n) return null

  const isSkyscraper = n === 7
  const isHotel = n === 5 || n === 6 // hotel ou 2º hotel
  const houseCount = n >= 1 && n <= 4 ? n : 0

  return (
    <div
      className="absolute z-20 pointer-events-none flex items-center justify-center"
      style={{
        ...markLayout(sideOf(pos)),
        gap: '1.5px',
        flexWrap: 'nowrap', // 4 casas NUNCA quebram pra outra linha
        width: 'max-content', // dimensiona pelo conteúdo (sem shrink-to-fit da célula)
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
      }}
    >
      {isSkyscraper && <SkyscraperBadgeIcon />}
      {isHotel && <HotelBadgeIcon />}
      {/* 1–4 casinhas em fila (conta de relance, sem contador) */}
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
      style={{ ...markLayout(sideOf(pos)), filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))' }}
    >
      <HangarBadgeIcon />
    </div>
  )
}

// Marca de hipoteca — apenas SOMBREAMENTO: a célula escurece e ganha uma
// sombra interna, parecendo "bloqueada / fora de jogo". Sem selo nem texto.
export function MortgageMark({ pos }: { pos: number }) {
  const mortgaged = useGameStore((s) => s.game.titles[pos]?.mortgaged)
  const boardTheme = useBoardTheme((t) => t.theme)
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
      {/* Café: carimbo de cartório torto · Atlas: só o apagão da cidade */}
      {boardTheme === 'cafe' && (
        <span
          className="absolute left-1/2 top-1/2 font-bold uppercase whitespace-nowrap"
          style={{
            transform: 'translate(-50%, -50%) rotate(-12deg)',
            fontFamily: 'var(--font-slab)',
            fontSize: 8,
            letterSpacing: '0.14em',
            color: 'var(--color-signal-glow)',
            border: '1.5px solid var(--color-signal-glow)',
            borderRadius: 2,
            padding: '1px 4px',
            opacity: 0.9,
          }}
        >
          Hipoteca
        </span>
      )}
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
  return (
    <motion.div
      className={cn(
        'absolute top-0.5 right-0.5 z-[26] pointer-events-none leading-none flex items-center justify-center rounded-full font-bold',
        badge.tone === 'logo' ? 'bg-logo text-cream' : 'bg-gold text-coffee-950',
      )}
      style={{ width: 13, height: 13, fontSize: 'var(--text-micro)', boxShadow: 'var(--shadow-card)' }}
      title={badge.title}
      animate={{ opacity: [0.6, 1, 0.6] }}
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
  const laps = `${e.lapsRemaining}v`
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
  const reduced = useReducedMotion()
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

// Trades em aberto + concluídas recentes — SRS §11. Dados reais via tradesView (027).
// Avatar pequeno do item: bandeira circular (propriedade) ou glifo (aeroporto/utilidade).
function TradeItemAvatar({ sq, size = 16 }: { sq: Square; size?: number }) {
  if (sq.kind === 'property') {
    const uf = (sq as PropertySquare).uf
    return (
      <span className="rounded-full bg-coffee-950 overflow-hidden shrink-0" style={{ width: size, height: size, boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-brass) 50%, transparent)' }}>
        <img src={`https://flagcdn.com/${uf.toLowerCase()}.svg`} alt={uf} className="w-full h-full object-cover block" draggable={false} />
      </span>
    )
  }
  return <span className="text-gold shrink-0 flex items-center justify-center" style={{ width: size, height: size }}><SquareIcon square={sq} size={size} /></span>
}

// Chip de um item da troca — faixa da cor do grupo + bandeira-avatar + nome.
function TradeItemChip({ pos }: { pos: number }) {
  const sq = BOARD[pos]
  const accent = sq.kind === 'property' ? GROUP_COLOR[(sq as PropertySquare).group] : 'var(--color-brass)'
  return (
    <span className="inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-[var(--radius-sharp)] bg-coffee-900 border border-coffee-500/70 overflow-hidden" title={sq.name}>
      <span className="self-stretch w-1 rounded-[var(--radius-sharp)] shrink-0" style={{ background: accent }} aria-hidden />
      <TradeItemAvatar sq={sq} size={16} />
      <span className="text-cream text-xs leading-none truncate max-w-[96px]">{sq.name}</span>
    </span>
  )
}

// Perna da troca (Oferece / Pede) — chips das propriedades + cédula do dinheiro
// + Bus Tickets (D-028).
function TradeLeg({ label, props, cash, tickets = 0 }: { label: string; props: number[]; cash: number; tickets?: number }) {
  const empty = props.length === 0 && cash <= 0 && tickets <= 0
  return (
    <div className="flex items-start gap-2">
      <span className="label text-cream-muted w-11 shrink-0 pt-1 text-micro">{label}</span>
      <div className="flex-1 min-w-0 flex flex-wrap gap-1">
        {empty && <span className="text-cream-muted text-xs italic">nada</span>}
        {props.map((pos) => <TradeItemChip key={pos} pos={pos} />)}
        {cash > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-sharp)] bg-coffee-800 border border-coffee-500/70 border-l-2 border-l-gold">
            <CoinIcon size={12} className="text-gold" />
            <span className="currency text-gold-glow text-xs leading-none tabular-nums">R$ {cash.toLocaleString('pt-BR')}</span>
          </span>
        )}
        {tickets > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-sharp)] bg-coffee-800 border border-coffee-500/70 border-l-2 border-l-gold" title="Bus Tickets">
            <Bus size={12} className="text-gold" />
            <span className="currency text-gold-glow text-xs leading-none tabular-nums">×{tickets}</span>
          </span>
        )}
      </div>
    </div>
  )
}

function useLivePlayers(): Player[] {
  const game = useGameStore((s) => s.game)
  const room = useRoomStore((s) => s.room)
  const myToken = useRoomStore((s) => s.myToken)
  return playersView(game, room, myToken)
}

export function PlayersPanel() {
  const players = useLivePlayers()
  const effects = useGameStore((s) => s.game.tempEffects).map(effectRow) // 024.1 — efeitos reais
  return (
    <aside className="side-panel">
      <div className="side-panel-section">
        <SectionHeader
          title="Jogadores"
          meta={<p className="label text-cream-muted">{players.filter((p) => !p.bankrupt).length} / 8</p>}
        />
        <div className="flex flex-col gap-2">
          {players.map((p) => <PlayerRow key={p.id ?? p.name} player={p} />)}
        </div>
        {/* Negociar movido pra a seção única "Negociações" (painel direito). */}
      </div>


      <div className="side-panel-section">
        <SectionHeader
          title="Efeitos ativos"
          meta={effects.length > 0 ? <Chip tone="neutral">{effects.length}</Chip> : undefined}
        />
        {effects.length === 0 ? (
          <EmptyState icon={<CalmGlyph />} title="Tabuleiro em paz" hint="Nenhum efeito ativo no momento" />
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
  // Feedback de caixa (024.1): delta flutuante quando o saldo muda.
  const [pulse, setPulse] = useState<{ id: number; d: number } | null>(null)
  const prevMoney = useRef(p.money)
  const pulseId = useRef(0)
  useEffect(() => {
    if (p.money !== prevMoney.current) {
      const d = p.money - prevMoney.current
      prevMoney.current = p.money
      pulseId.current += 1
      setPulse({ id: pulseId.current, d })
      const t = setTimeout(() => setPulse(null), 1200)
      return () => clearTimeout(t)
    }
  }, [p.money])

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-card)]',
        'border transition-colors',
        p.active
          ? 'bg-coffee-700 border-gold shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-brass)_30%,transparent)]'
          : 'bg-coffee-800/60 border-coffee-500',
        p.bankrupt && 'opacity-50',
      )}
    >
      <AnimatePresence>
        {pulse && pulse.d !== 0 && (
          <motion.span
            key={pulse.id}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: -16 }}
            exit={{ opacity: 0, y: -26 }}
            transition={{ duration: 0.45 }}
            className={cn(
              'absolute right-3 top-1.5 currency text-sm font-bold pointer-events-none z-10',
              pulse.d > 0 ? 'text-group-green' : 'text-logo',
            )}
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {pulse.d > 0 ? '+' : '−'}R${Math.abs(pulse.d).toLocaleString('pt-BR')}
          </motion.span>
        )}
      </AnimatePresence>
      <PlayerFace color={p.color} active={p.active} asleep={p.bankrupt} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <p className="display text-cream text-[17px] leading-none truncate">{p.name}</p>
          {p.you         && <span title="Seu assento" className="label !text-gold">VOCÊ</span>}
          {p.loanActive  && <span title="Empréstimo ativo" className="label !text-logo">$$</span>}
          {p.immune      && <span title="Imunidade ativa"  className="label !text-gold">IMU</span>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {p.bankrupt ? (
            <span className="label text-cream-muted">Falido</span>
          ) : p.connected === false ? (
            // Status de sessão (§12.3/FR-015): quem caiu segue com tudo intacto (FR-020).
            <span title="Desconectado — a partida espera" className="label text-logo inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-logo" aria-hidden />
              Offline
            </span>
          ) : (
            <span title="Cartas em mão (privadas)" className="label inline-flex items-center gap-1">
              <CardGlyph size={13} />
              {p.cardsInHand}/3
            </span>
          )}
        </div>
      </div>
      <p
        className={cn(
          'currency text-right shrink-0',
          p.bankrupt ? 'text-cream-muted line-through' : 'text-gold-glow',
        )}
        style={{ fontSize: '16px' }}
      >
        <span className="text-gold-soft text-[11px] mr-0.5">R$</span>
        {p.money.toLocaleString('pt-BR')}
      </p>
    </div>
  )
}

// Log de eventos — SRS §12.3, alimentado pelas ações do turno.
const SPEED_FACES = ['one', 'two', 'three', 'mr', 'bus'] as const
type SpeedFace = (typeof SPEED_FACES)[number]

// Face do Speed Die do motor (1|2|3|'mr-banco'|'onibus') → face visual.
function toUiSpeedFace(speed: number | 'mr-banco' | 'onibus'): SpeedFace {
  if (speed === 1) return 'one'
  if (speed === 2) return 'two'
  if (speed === 3) return 'three'
  if (speed === 'mr-banco') return 'mr'
  return 'bus' // 'onibus'
}

const ROLL_DURATION_MS = 1050

// Botão único das ações do turno (Rolar / Comprar / Leilão / Finalizar) —
// casca sobre o primitivo Button com a voz display (Bebas) e porte maior;
// a primária ganha borda gold-soft + glow no hover (é O botão do jogo).
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
        'px-5 py-3 display font-normal text-base tracking-wide gap-2',
        variant === 'primary' &&
          'border border-gold-soft hover:bg-gold-glow hover:brightness-100 hover:shadow-[var(--shadow-glow)] disabled:hover:bg-gold disabled:hover:shadow-none',
        className,
      )}
    >
      {icon}
      {children}
    </Button>
  )
}

// Canhoto de Bus Ticket — ação opcional pré-rolagem/fim de turno (034). Vive na
// zona de ação da DiceArena (onde o jogador já decide o turno), não flutuando
// sobre o tabuleiro. Visual de BILHETE de verdade: papel com tinta de latão,
// picote tracejado com furos separando o corpo do "×N", levemente torto — e se
// endireita com glow no hover, como quem destaca o canhoto.
function BusTicketStub({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full flex items-stretch overflow-hidden rounded-[var(--radius-card)] border border-gold/45 text-left transition-all -rotate-1 hover:rotate-0 hover:border-gold hover:shadow-[var(--shadow-glow)] active:translate-y-px"
      style={{
        background:
          'linear-gradient(115deg, color-mix(in srgb, var(--color-brass) 16%, var(--color-coffee-900)) 0%, var(--color-coffee-900) 55%, color-mix(in srgb, var(--color-brass) 8%, var(--color-coffee-900)) 100%)',
      }}
    >
      <span className="flex items-center gap-2.5 flex-1 min-w-0 pl-3 pr-2 py-2">
        <Bus size={16} className="text-gold-glow shrink-0 transition-transform group-hover:translate-x-0.5" />
        <span className="min-w-0">
          <span className="block display text-cream text-sm leading-none tracking-wide">Usar Bus Ticket</span>
          <span className="block label text-cream-muted leading-none mt-1 text-nano">mover no mesmo lado</span>
        </span>
      </span>
      {/* picote: linha tracejada + furos de punção nas pontas */}
      <span className="relative shrink-0 border-l border-dashed border-gold/40" aria-hidden>
        <span className="absolute -top-[5px] -left-[4.5px] w-2 h-2 rounded-full bg-coffee-950" />
        <span className="absolute -bottom-[5px] -left-[4.5px] w-2 h-2 rounded-full bg-coffee-950" />
      </span>
      <span className="shrink-0 flex items-center px-3 currency text-gold-glow text-sm tabular-nums">×{count}</span>
    </button>
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

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Só o dono da decisão vê os controles (spec 038, FR-002). Sem sala, `mayAct` é sempre
  // true e a arena segue idêntica ao cliente único (FR-029/SC-007).
  const local = useLocalView()
  const v = diceArenaView(game, local, { rolling, activeName: active?.name })
  const { canRoll, canFinalize, canBus, canJailDecide, purchase } = v
  const [d1, d2] = v.dice
  const sd: SpeedFace = v.speed != null ? toUiSpeedFace(v.speed) : 'one'

  function handleRoll() {
    if (!canRoll) return
    setRolling(true)
    useTokenAnim.getState().setRolling(true) // segura o peão até o dado parar
    rollDiceCmd() // motor: rola, move e abre a resolução da casa
    setRollKey((k) => k + 1)
    timeoutRef.current = setTimeout(() => {
      setRolling(false)
      useTokenAnim.getState().setRolling(false) // dado caiu → peão pode andar
    }, ROLL_DURATION_MS)
  }

  // Tentar sair da prisão na dupla — anima o dado igual ao rolar normal.
  function handleJailTry() {
    if (rolling) return
    setRolling(true)
    useTokenAnim.getState().setRolling(true)
    jailDecision('try') // rola 2 brancos; dupla = sai e move; senão passa a vez
    setRollKey((k) => k + 1)
    timeoutRef.current = setTimeout(() => {
      setRolling(false)
      useTokenAnim.getState().setRolling(false)
    }, ROLL_DURATION_MS)
  }

  const { isDoubleReroll, status } = v

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Jogador da vez — carinha + nome acima dos dados. Anel pisca quando é
          hora de rolar (turno ativo no demo local de 1 cliente). */}
      <div className="flex flex-col items-center gap-1.5">
        <PlayerFace color={active.color} active={canRoll} size={72} />
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
          decide: na tela dos demais fica o estado, sem botão morto (FR-003). */}
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
          <TurnActionBtn variant="primary" onClick={() => finalizeTurn()}>
            Finalizar turno
          </TurnActionBtn>
        ) : (
          <TurnActionBtn variant="primary" disabled={!canRoll} icon={<DiceIcon size={18} className="shrink-0" />} onClick={handleRoll}>
            {rolling ? 'Rolando…' : 'Rolar dados'}
          </TurnActionBtn>
        )}
        {canBus && <BusTicketStub count={activeBusTickets} onClick={() => useBusTicketUI.getState().arm()} />}
      </div>
    </div>
  )
}

// Empréstimo ativo do jogador da vez (010, §15) — visível e quitável a qualquer
// momento do turno. Mostra credor, principal e o quanto sangra a cada GO.
function LoanPanel() {
  const game = useGameStore((s) => s.game)
  const dispatch = useGameStore((s) => s.dispatch)
  const payOffLoan = (): void => dispatch({ kind: 'pay-off-loan' })
  const active = game.players[game.turnOrder[game.activeSeat]]
  const loan = game.loans.find((l) => l.debtorId === active.id)
  if (!loan) return null
  const ci = game.players.findIndex((p) => p.id === loan.creditorId)
  const creditorColor = ci >= 0 ? PLAYER_COLORS[ci % PLAYER_COLORS.length] : 'var(--color-brass)'
  const interest = Math.round((loan.principal * loan.ratePct) / 100)
  const canPay = active.cash >= loan.principal
  return (
    <div className="side-panel-section">
      <SectionHeader title="Empréstimo ativo" meta={<Chip tone="alert">{loan.ratePct}% por volta</Chip>} />
      <div className="flex items-center gap-2 mb-2.5">
        <span className="label text-cream-muted">Você deve a</span>
        <PlayerFace color={creditorColor} size={20} />
        <span className="display text-cream text-sm leading-none">{loan.creditorId}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-cream-muted">Principal</span>
        <span className="currency text-cream tabular-nums">R$ {loan.principal.toLocaleString('pt-BR')}</span>
      </div>
      <div className="flex items-center justify-between text-sm mt-1">
        <span className="text-cream-muted">Juros ao passar pelo GO</span>
        <span className="currency text-logo tabular-nums">− R$ {interest.toLocaleString('pt-BR')}</span>
      </div>
      <Button
        disabled={!canPay}
        onClick={payOffLoan}
        title={canPay ? 'Pagar o principal e encerrar o empréstimo' : 'Caixa insuficiente para o principal'}
        className="w-full mt-3"
      >
        {canPay ? `Quitar · R$ ${loan.principal.toLocaleString('pt-BR')}` : `Falta R$ ${(loan.principal - active.cash).toLocaleString('pt-BR')} para quitar`}
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
  const reduced = useReducedMotion()
  const prev = useRef(pot)
  const pulseId = useRef(0)
  const [pulse, setPulse] = useState<{ id: number; d: number } | null>(null)

  useEffect(() => {
    if (pot !== prev.current) {
      const d = pot - prev.current
      prev.current = pot
      pulseId.current += 1
      setPulse({ id: pulseId.current, d })
      const t = setTimeout(() => setPulse(null), 1400)
      return () => clearTimeout(t)
    }
  }, [pot])

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

      <AnimatePresence>
        {pulse && pulse.d !== 0 && (
          <motion.span
            key={pulse.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: -14 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.5 }}
            className={cn(
              'absolute right-4 top-3 currency text-sm font-bold pointer-events-none',
              pulse.d > 0 ? 'text-gold-glow' : 'text-logo',
            )}
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {pulse.d > 0 ? '+' : '−'}R$ {Math.abs(pulse.d).toLocaleString('pt-BR')}
          </motion.span>
        )}
      </AnimatePresence>
    </section>
  )
}

export function ActionsPanel() {
  const game = useGameStore((s) => s.game)
  const pot = game.centerPot
  // 027 — painel ao vivo. `tradesView` era um módulo de duas expressões com um chamador:
  // a interface (tipo + módulo + arquivo de teste) era maior que a implementation.
  const trades = { pending: game.pendingTrade, history: [...game.tradeHistory].reverse() }
  const colorById = Object.fromEntries(
    game.players.map((p, i) => [p.id, PLAYER_COLORS[i % PLAYER_COLORS.length]]),
  ) as Record<string, string>

  return (
    <aside className="side-panel">
      <PotCard pot={pot} />

      <HandPanel />

      <LoanPanel />

      <div className="side-panel-section">
        <SectionHeader
          title="Negociações"
          meta={trades.pending ? <Chip tone="gold">1 ativa</Chip> : <Chip>nenhuma</Chip>}
        />
        {!trades.pending && trades.history.length === 0 ? (
          <EmptyState
            icon={<SwapMiniGlyph />}
            title="Nenhuma proposta na mesa"
            hint="Troque propriedades e dinheiro com outros jogadores"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {trades.pending && <TradeRow key="pending" trade={trades.pending} done={false} colorById={colorById} />}
            {trades.history.map((t, i) => <TradeRow key={`h${i}`} trade={t} done colorById={colorById} />)}
          </div>
        )}
        <Button
          variant="ghost"
          onClick={() => useTradeUI.getState().show()}
          className="w-full mt-3 label text-gold text-[0.625rem]"
        >
          <PlusGlyph size={11} /> Nova negociação
        </Button>
      </div>
    </aside>
  )
}

function TradeRow({ trade, done, colorById }: { trade: Trade; done: boolean; colorById: Record<string, string> }) {
  const reduced = useReducedMotion()
  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-3 py-2.5 rounded-[var(--radius-card)] border',
        done ? 'bg-coffee-800/40 border-coffee-500 opacity-75' : 'bg-coffee-700 border-gold/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-brass)_25%,transparent)]',
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <PlayerFace color={colorById[trade.fromId] ?? 'var(--color-ink-400)'} size={22} />
        <span className="display text-cream text-sm leading-none truncate">{trade.fromId}</span>
        <TradeArrowGlyph size={11} />
        <PlayerFace color={colorById[trade.toId] ?? 'var(--color-ink-400)'} size={22} />
        <span className="display text-cream text-sm leading-none truncate">{trade.toId}</span>
        {done ? (
          <Chip className="ml-auto" title="Negociação aceita">
            <span className="text-gold"><CheckTinyGlyph size={9} /></span> Aceita
          </Chip>
        ) : (
          <Chip tone="gold" className="ml-auto" title="Aguardando resposta">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-gold inline-block shrink-0"
              animate={reduced ? undefined : { opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              aria-hidden
            />
            Aguardando
          </Chip>
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <TradeLeg label="Oferece" props={trade.fromProps} cash={trade.fromCash} tickets={trade.fromBusTickets ?? 0} />
        <TradeLeg label="Pede" props={trade.toProps} cash={trade.toCash} tickets={trade.toBusTickets ?? 0} />
      </div>

      {/* Proposta fechada sem resposta ("decidir depois") reabre por aqui */}
      {!done && (
        <Button variant="ghost" onClick={() => useTradeUI.getState().respond()} className="w-full label text-gold text-[0.625rem]">
          Responder proposta
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Dado 3D — cubo real com 6 faces posicionadas via translateZ.
// Padrão consagrado (David DeSandro / daily-dev-tips): cada face é um
// <div> absoluto rotacionado pro seu lado e empurrado pra fora com
// translateZ(metade_do_cubo). transform-style: preserve-3d no cubo
// + perspective no scene preserva profundidade.
// ---------------------------------------------------------------------
const DIE_PX = 56               // w-14 / h-14
const HALF = DIE_PX / 2

// Rotação a aplicar no CUBO INTEIRO pra trazer a face do valor N pra câmera.
// Layout de d6 ocidental: faces opostas somam 7 (1↔6, 2↔5, 3↔4).
const FACE_REST: Record<number, [number, number]> = {
  1: [   0,   0 ], // frente
  2: [   0, -90 ], // direita
  3: [ -90,   0 ], // topo
  4: [  90,   0 ], // base
  5: [   0,  90 ], // esquerda
  6: [   0, 180 ], // fundo
}

const DOT_LAYOUT: Record<number, number[]> = {
  1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
}

function DotFace({ value, transform }: { value: number; transform: string }) {
  const dots = DOT_LAYOUT[value]
  return (
    <div
      className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 p-2 bg-cream rounded-[var(--radius-card)]"
      style={{
        transform,
        backfaceVisibility: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25), inset 0 -2px 3px rgba(0,0,0,0.15)',
      }}
    >
      {[1,2,3,4,5,6,7,8,9].map(i => (
        <div key={i} className="flex items-center justify-center">
          {dots.includes(i) && <span className="w-2 h-2 rounded-full bg-coffee-950" />}
        </div>
      ))}
    </div>
  )
}

function SpeedFaceContent({ kind, transform }: { kind: SpeedFace; transform: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-gold rounded-[var(--radius-card)]"
      style={{
        transform,
        backfaceVisibility: 'hidden',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3), inset 0 -2px 3px rgba(0,0,0,0.18)',
      }}
    >
      {kind === 'one'   && <span className="display text-coffee-950 text-3xl leading-none">1</span>}
      {kind === 'two'   && <span className="display text-coffee-950 text-3xl leading-none">2</span>}
      {kind === 'three' && <span className="display text-coffee-950 text-3xl leading-none">3</span>}
      {kind === 'mr'    && <Crown size={28} className="text-coffee-950" strokeWidth={1.75} fill="currentColor" />}
      {kind === 'bus'   && <span className="display text-coffee-950 text-xl leading-none">BUS</span>}
    </div>
  )
}

// Hook compartilhado: dispara o tumble quando rollKey muda — coreografia
// "queda do copo", SINCRONIZADA com o áudio do dice-roll (0→0,42s chacoalho;
// 0,42s arremesso; quiques; assenta em ~1s = ROLL_DURATION_MS).
// Acumula 720° a cada roll (2 voltas) e termina na rotação de repouso da face
// desejada — motion interpola monotonamente, então o cubo sempre gira "pra
// frente" e pousa exatamente na face certa.
function useDieAnimation(value: number, rollKey: number) {
  const [scope, animate] = useAnimate()

  useEffect(() => {
    if (rollKey === 0 || !scope.current) return
    const el = scope.current
    const [rx, ry] = FACE_REST[value]
    const base = rollKey * 720
    const run = async () => {
      // Fase 1 — chacoalho: o dado sobe e gira solto no ar ("dentro do copo").
      await animate(
        el,
        { y: [0, -70, -74, -68, -72, -70], rotateX: base - 340, rotateY: base - 320 },
        {
          duration: 0.42,
          ease: 'linear',
          y: { duration: 0.42, times: [0, 0.2, 0.4, 0.6, 0.8, 1], ease: 'easeOut' },
        },
      )
      // Fase 2 — despenca na mesa com dois quiques e trava na face sorteada.
      await animate(
        el,
        { y: [-70, 0, -18, 0, -6, 0], rotateX: base + rx, rotateY: base + ry },
        {
          duration: 0.63,
          ease: [0.16, 0.84, 0.44, 1],
          y: { duration: 0.63, times: [0, 0.3, 0.5, 0.68, 0.84, 1], ease: 'easeOut' },
        },
      )
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey])

  return scope
}

function Dice({ value, rollKey }: { value: number; rollKey: number }) {
  const scope = useDieAnimation(value, rollKey)
  const [initRx, initRy] = FACE_REST[value]

  return (
    <div className="relative" style={{ width: DIE_PX, height: DIE_PX, perspective: 500 }}>
      <motion.div
        aria-hidden="true"
        className="dice-shadow absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-10 h-1.5 rounded-full bg-black/60 blur-[3px]"
        animate={rollKey > 0 ? { scaleX: [1, 0.4, 0.4, 1.15, 1, 1.08, 1], opacity: [0.55, 0.15, 0.15, 0.65, 0.5, 0.6, 0.55] } : { scaleX: 1, opacity: 0.55 }}
        transition={{ duration: 1.05, times: [0, 0.08, 0.55, 0.6, 0.7, 0.85, 1] }}
      />
      <motion.div
        ref={scope}
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateX: initRx, rotateY: initRy }}
      >
        <DotFace value={1} transform={`rotateY(0deg)   translateZ(${HALF}px)`} />
        <DotFace value={2} transform={`rotateY(90deg)  translateZ(${HALF}px)`} />
        <DotFace value={3} transform={`rotateX(90deg)  translateZ(${HALF}px)`} />
        <DotFace value={4} transform={`rotateX(-90deg) translateZ(${HALF}px)`} />
        <DotFace value={5} transform={`rotateY(-90deg) translateZ(${HALF}px)`} />
        <DotFace value={6} transform={`rotateY(180deg) translateZ(${HALF}px)`} />
      </motion.div>
    </div>
  )
}

// Speed Die — terceiro dado, SRS §13.2. Faces: 1/2/3, Mr. BM, BUS.
// Cubo precisa de 6 faces, então Mr. BM aparece duas vezes (faces opostas).
function SpeedDie({ face, rollKey }: { face: SpeedFace; rollKey: number }) {
  const FACE_INDEX: Record<SpeedFace, number> = {
    one: 1, two: 2, three: 3, mr: 4, bus: 5,
  }
  const value = FACE_INDEX[face]
  const scope = useDieAnimation(value, rollKey)
  const [initRx, initRy] = FACE_REST[value]

  return (
    <div className="relative" style={{ width: DIE_PX, height: DIE_PX, perspective: 500 }}>
      <motion.div
        aria-hidden="true"
        className="dice-shadow absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-10 h-1.5 rounded-full bg-black/60 blur-[3px]"
        animate={rollKey > 0 ? { scaleX: [1, 0.4, 0.4, 1.15, 1, 1.08, 1], opacity: [0.55, 0.15, 0.15, 0.65, 0.5, 0.6, 0.55] } : { scaleX: 1, opacity: 0.55 }}
        transition={{ duration: 1.05, times: [0, 0.08, 0.55, 0.6, 0.7, 0.85, 1] }}
      />
      <motion.div
        ref={scope}
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateX: initRx, rotateY: initRy }}
      >
        <SpeedFaceContent kind="one"   transform={`rotateY(0deg)   translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="two"   transform={`rotateY(90deg)  translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="three" transform={`rotateX(90deg)  translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="mr"    transform={`rotateX(-90deg) translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="bus"   transform={`rotateY(-90deg) translateZ(${HALF}px)`} />
        <SpeedFaceContent kind="mr"    transform={`rotateY(180deg) translateZ(${HALF}px)`} />
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------
// CenterArena — composição premium do miolo do tabuleiro.
// Layout simétrico: dados centralizados pra arremesso, decks nos cantos
// inferiores, padrão de estrelas no fundo.
// ---------------------------------------------------------------------
// Pinta o texto do histórico: ganho = verde, perda = vermelho, neutro (compra/etc.) = dourado.
const LOG_GAIN = /recebeu|ganhou|coletou|\+\$/i
const LOG_LOSS = /\bpagou\b|perdeu/i
function LogWhat({ what }: { what: string }) {
  const color = LOG_GAIN.test(what) ? 'var(--color-group-green)' : LOG_LOSS.test(what) ? 'var(--color-signal-glow)' : 'var(--color-brass-glow)'
  return (
    <>
      {what.split(/(\+?\$\s?\d[\d.]*)/g).map((p, i) =>
        /\$/.test(p)
          ? <span key={i} className="currency font-bold" style={{ color }}>{p}</span>
          : <span key={i}>{p}</span>,
      )}
    </>
  )
}

// Glifo do tipo de evento — classificado pelo texto do lançamento. Dá
// leitura de relance (o que aconteceu) sem depender só da cor do dinheiro.
function logEventIcon(what: string): ReactNode {
  if (/rolou|dupla/i.test(what)) return <DiceIcon size={11} />
  if (/leil/i.test(what)) return <GavelIcon size={11} />
  if (/comprou/i.test(what)) return <ShopIcon size={11} />
  if (/constru|hangar|hotel|arranha|vendeu/i.test(what)) return <HouseIcon size={11} />
  if (/carta|acaso|tesouro/i.test(what)) return <CardGlyph size={11} />
  if (/pagou|recebeu|coletou|juros|imposto|taxa|pote|hipotec|fian/i.test(what)) return <CoinIcon size={11} />
  return null
}

// Diário de bordo ao vivo no CENTRO do tabuleiro — linha do tempo com
// trilho, avatar do autor (PlayerFace piscando, sem bob), glifo do tipo de
// evento e o lançamento mais RECENTE destacado na cor de quem jogou.
// Seletor estável (`s.game.log`) + reverse no corpo — recência ao topo (021).
function CenterLog() {
  const log = useGameStore((s) => s.game.log)
  const players = useGameStore((s) => s.game.players)
  const reduced = useReducedMotion()
  const history = [...log].reverse()
  const colorOf = (who: string): string => {
    if (who === 'Banco') return 'var(--color-signal)'
    const i = players.findIndex((p) => p.id === who)
    return i >= 0 ? PLAYER_COLORS[i % PLAYER_COLORS.length] : 'var(--color-signal)'
  }
  return (
    <div className="flex-1 min-h-0 w-full max-w-[88%] flex flex-col rounded-[var(--radius-card)] border border-coffee-500/60 bg-coffee-900/55 backdrop-blur-[1px] overflow-hidden">
      {/* Cabeçalho: título + contador de lançamentos (primitivo padrão) */}
      <SectionHeader
        className="px-3 pt-2 pb-1.5 mb-0 shrink-0 border-b border-coffee-500/40"
        title="Histórico"
        meta={history.length > 0 ? (
          <span className="label text-cream-muted tabular-nums text-micro">
            {history.length} {history.length === 1 ? 'lançamento' : 'lançamentos'}
          </span>
        ) : undefined}
      />
      {history.length === 0 ? (
        <EmptyState
          className="flex-1 m-3"
          icon={<DiceIcon size={20} />}
          title="Nada registrado ainda"
          hint="Role os dados pra começar. Cada jogada aparece aqui."
        />
      ) : (
        <ol className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2">
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
                transition={{ duration: 0.25, ease: 'easeOut' }}
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
                  {l.who === 'Banco' ? (
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
                    <PlayerFace color={c} size={20} className="!animate-none" />
                  )}
                </span>
                <span className="flex-1 min-w-0 leading-snug" style={{ fontSize: latest ? '13.5px' : '13px' }}>
                  <span className="display mr-1.5" style={{ color: c }}>{l.who}</span>
                  <span className="text-cream-muted"><LogWhat what={l.what} /></span>
                </span>
                {/* glifo do tipo de evento — dourado no lançamento fresco */}
                <span className={cn('shrink-0 mt-0.5', latest ? 'text-gold' : 'text-cream-muted/50')}>
                  {logEventIcon(l.what)}
                </span>
              </motion.li>
            )
          })}
        </ol>
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

      {/* Fundo por tema: carta náutica (Atlas) · rosácea de cédula (Café) */}
      {boardTheme === 'atlas' ? <ChartPattern /> : <GuillochePattern />}

      {boardTheme === 'atlas' ? (
        <>
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
          {/* Moldura de cédula: dupla com tracejado + losangos nos meios */}
          <div className="absolute inset-3 border-2 border-gold/25 rounded-[var(--radius-sharp)] pointer-events-none" />
          <div className="absolute inset-[19px] border border-dashed border-gold/20 rounded-[var(--radius-sharp)] pointer-events-none" />
          {(['t', 'b', 'l', 'r'] as const).map((e) => (
            <span
              key={e}
              className="absolute pointer-events-none rotate-45 bg-gold/40"
              style={{
                width: 7,
                height: 7,
                top: e === 't' ? 9 : e === 'b' ? 'auto' : '50%',
                bottom: e === 'b' ? 9 : 'auto',
                left: e === 'l' ? 9 : e === 'r' ? 'auto' : '50%',
                right: e === 'r' ? 9 : 'auto',
                marginLeft: e === 't' || e === 'b' ? -3.5 : 0,
                marginTop: e === 'l' || e === 'r' ? -3.5 : 0,
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
// Adaptador de view sobre a FONTE ÚNICA (rentLadder, 032): mapeia para o formato dos deeds.
// Não recalcula nada — só delega ao motor, garantindo que UI e cobrança batem.
export function computeRents(group: GroupKey, base: number) {
  const l = rentLadder(group, base)
  return {
    base,
    house1: l.house[0],
    house2: l.house[1],
    house3: l.house[2],
    house4: l.house[3],
    hotel: l.hotel,
    hotel2: l.hotel2,
    skyscraper: l.skyscraper,
  }
}

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
    const m = 8
    const r = el.getBoundingClientRect()
    let x = 0
    let y = 0
    if (r.left < m) x = m - r.left
    else if (r.right > window.innerWidth - m) x = window.innerWidth - m - r.right
    if (r.top < m) y = m - r.top
    else if (r.bottom > window.innerHeight - m) y = window.innerHeight - m - r.bottom
    setOff({ x, y })
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
        {/* Body do balão — overflow-hidden pra cortar o conteúdo no border-radius */}
        <div
          className="
            w-[270px]
            bg-coffee-800 border-2 border-coffee-500
            rounded-[var(--radius-card)]
            shadow-[var(--shadow-dropdown)]
            overflow-x-hidden overflow-y-auto max-h-[calc(100vh-24px)]
          "
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

const BUILD_BLOCK_MSG: Record<string, string> = {
  'hipoteca-no-grupo': 'Há propriedade hipotecada no grupo',
  'grupo-incompleto': 'Arranha-céu exige o grupo completo',
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

  return (
    <div className="mt-3 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-1.5">
      <p className="label text-gold text-micro">Gerenciar</p>
      <div className="grid grid-cols-2 gap-1.5">
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
          <DeedBtn className="col-span-2" icon={<CoinIcon size={13} />} disabled={!flags.podeHipotecar} onClick={() => mortgageProperty(pos)}>
            Hipotecar · +${dv.mortgageValue}
          </DeedBtn>
        ) : (
          <DeedBtn className="col-span-2" icon={<CoinIcon size={13} />} disabled={!flags.podeDeshipotecar} onClick={() => unmortgageProperty(pos)}>
            Desipotecar · −${dv.unmortgageCost}
          </DeedBtn>
        )}
      </div>
      {dv.kind === 'property' && !flags.podeConstruir && blockMsg && (
        <p className="text-cream-muted text-micro">{blockMsg}</p>
      )}
    </div>
  )
}

function PropertyDeedContent({ square, onClose }: { square: PropertySquare; onClose: () => void }) {
  const game = useGameStore((s) => s.game)
  const dv = deedView(game, square.pos)!
  const owner = dv.owner
  const buildings = dv.level // 0–7 real
  const rents = computeRents(square.group, square.rent)
  const houseCost = dv.buildCost
  const mortgage = dv.mortgageValue
  const stripeColor = GROUP_COLOR[square.group]
  const isMortgaged = dv.mortgaged

  // Linha de aluguel ATIVA (highlight) pelo nível real
  const activeRow: keyof typeof rents =
    buildings === 7 ? 'skyscraper' :
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
        className="relative px-3.5 py-3 border-b-2 border-coffee-950"
        style={{
          background: `linear-gradient(180deg, ${stripeColor} 0%, ${stripeColor} 60%, color-mix(in srgb, ${stripeColor} 75%, #000) 100%)`,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="
            absolute top-1.5 right-1.5 w-6 h-6 rounded-full
            bg-coffee-950/45 text-cream hover:bg-coffee-950/75
            flex items-center justify-center text-xs
            transition-colors
          "
        >
          ✕
        </button>
        <div className="flex items-center gap-2.5 pr-6">
          <div
            className="
              shrink-0 w-9 h-9 rounded-full
              bg-coffee-900 border-2 border-coffee-950
              overflow-hidden
              shadow-[var(--shadow-card)]
            "
          >
            <img
              src={`https://flagcdn.com/${square.uf.toLowerCase()}.svg`}
              alt={square.uf}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="display text-coffee-950 text-xl leading-none truncate">
              {square.name}
            </h3>
            <p className="label text-coffee-950/80 mt-0.5 text-micro">
              {square.capital}
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de aluguéis */}
      <div className="px-3.5 py-3">
        <p className="label text-gold mb-2 text-micro">Aluguel</p>
        <div className="flex flex-col gap-0.5">
          <CompactRent label="Base"        value={rents.base}       active={activeRow === 'base'} />
          <CompactRent label="1 casa"      value={rents.house1}     active={activeRow === 'house1'} />
          <CompactRent label="2 casas"     value={rents.house2}     active={activeRow === 'house2'} />
          <CompactRent label="3 casas"     value={rents.house3}     active={activeRow === 'house3'} />
          <CompactRent label="4 casas"     value={rents.house4}     active={activeRow === 'house4'} />
          <CompactRent label="Hotel"       value={rents.hotel}      active={activeRow === 'hotel'} />
          <CompactRent label="Arranha-céu" value={rents.skyscraper} active={activeRow === 'skyscraper'} accent />
        </div>

        {/* Bloco de valores fixos */}
        <div className="mt-3 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
          <CompactRent label="Preço"    value={square.price} muted />
          <CompactRent label="Casa"     value={houseCost}    muted />
          <CompactRent label="Hipoteca" value={mortgage}     muted />
        </div>

        {/* Rodapé: dono + status */}
        {(owner || isMortgaged) && (
          <div className="mt-3 pt-2.5 border-t border-coffee-500/60 flex items-center gap-2">
            {owner && (
              <div className="flex-1 min-w-0">
                <p className="label text-cream-muted text-nano">Dono</p>
                <p className="display text-cream text-xs leading-none mt-0.5 truncate">{owner}</p>
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

  return (
    <div ref={clampRef} style={{ position: 'absolute', zIndex: 65, transform: `${centerTransform} translate(${off.x}px, ${off.y}px)`, ...positionStyle }} onClick={(e) => e.stopPropagation()}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }} style={{ position: 'relative' }}>
        <div className="w-[270px] bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden">
          {/* Header dourado */}
          <div className="relative px-3.5 py-3 border-b-2 border-coffee-950" style={{ background: 'linear-gradient(180deg, var(--color-brass) 0%, var(--color-brass-soft) 100%)' }}>
            <button onClick={onClose} aria-label="Fechar" className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-coffee-950/45 text-cream hover:bg-coffee-950/75 flex items-center justify-center text-xs transition-colors">✕</button>
            <div className="flex items-center gap-2.5 pr-6">
              <div className="shrink-0 w-9 h-9 flex items-center justify-center">
                <SquareIcon square={square} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="display text-coffee-950 text-lg leading-none truncate">{square.name}</h3>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-coffee-950/25 text-coffee-950 font-bold" style={{ fontSize: '10px', letterSpacing: '0.08em' }}>{square.iata}</span>
              </div>
            </div>
          </div>
          {/* Corpo */}
          <div className="px-3.5 py-3">
            <p className="label text-gold mb-2 text-micro">Aluguel por aeroportos possuídos</p>
            <div className="flex flex-col gap-0.5">
              <CompactRent label="1 aeroporto" value={25}  />
              <CompactRent label="2 aeroportos" value={50}  />
              <CompactRent label="3 aeroportos" value={100} />
              <CompactRent label="4 aeroportos" value={200} accent />
            </div>
            {/* Hangar bonus */}
            <div className="mt-3 pt-2.5 border-t border-coffee-500/60">
              <p className="text-cream-muted text-micro">
                O <span className="text-gold font-semibold">Hangar</span> dobra o aluguel deste aeroporto individualmente.
              </p>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
              <CompactRent label="Preço"    value={square.price}                 muted />
              <CompactRent label="Hipoteca" value={Math.floor(square.price / 2)} muted />
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

  return (
    <div ref={clampRef} style={{ position: 'absolute', zIndex: 65, transform: `${centerTransform} translate(${off.x}px, ${off.y}px)`, ...positionStyle }} onClick={(e) => e.stopPropagation()}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }} style={{ position: 'relative' }}>
        <div className="w-[270px] bg-coffee-800 border-2 border-coffee-500 rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] overflow-hidden">
          {/* Header colorido por tipo */}
          <div className="relative px-3.5 py-3 border-b-2 border-coffee-950" style={{ background: `linear-gradient(180deg, ${accentColor} 0%, color-mix(in srgb, ${accentColor} 70%, #000) 100%)` }}>
            <button onClick={onClose} aria-label="Fechar" className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-coffee-950/45 text-cream hover:bg-coffee-950/75 flex items-center justify-center text-xs transition-colors">✕</button>
            <div className="flex items-center gap-2.5 pr-6">
              <div className="shrink-0 w-9 h-9 flex items-center justify-center">
                <SquareIcon square={square} size={32} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="display text-coffee-950 text-lg leading-none truncate">{square.name}</h3>
                <p className="label text-coffee-950/80 mt-0.5 text-micro">Utilidade</p>
              </div>
            </div>
          </div>
          {/* Corpo */}
          <div className="px-3.5 py-3">
            <p className="label text-gold mb-2 text-micro">Aluguel baseado nos dados</p>
            <div className="flex flex-col gap-0.5">
              <CompactRentText label="1 utilidade"  value="4× os dados" />
              <CompactRentText label="2 utilidades" value="10× os dados" />
              <CompactRentText label="3 utilidades" value="20× os dados" accent />
            </div>
            <div className="mt-3 pt-2.5 border-t border-coffee-500/60">
              <p className="text-cream-muted text-micro">
                O aluguel é o total dos dados × o multiplicador. Não recebe construções.
              </p>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-coffee-500/60 flex flex-col gap-0.5">
              <CompactRent label="Preço"    value={square.price}                 muted />
              <CompactRent label="Hipoteca" value={Math.floor(square.price / 2)} muted />
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

