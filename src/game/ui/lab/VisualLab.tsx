import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, FlaskConical, Layers3 } from 'lucide-react'
import { BOARD, type AirportSquare, type PropertySquare, type UtilitySquare } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'
import { useGameStore } from '@/game/store'
import { ModalLayer } from '@/game/ui/modals/ModalLayer'
import { TradeLayer } from '@/game/ui/trade/TradeLayer'
import { LandAuctionLayer } from '@/game/ui/landAuction/LandAuctionLayer'
import { HandCardLayer } from '@/game/ui/cards/HandCardLayer'
import { HandPanel } from '@/game/ui/cards/HandPanel'
import { NoticeLayer } from '@/game/ui/NoticeLayer'
import { GameHUD } from '@/game/ui/GameHUD'
import { AirportPopover, PropertyPopover, UtilityPopover } from '@/boards/shared'
import { Button, Chip, EmptyState } from '@/game/ui/primitives'
import {
  prepareVisualLabCase,
  VISUAL_LAB_CASES,
  type VisualLabCase,
  type VisualLabCaseId,
} from './cases'
import './visualLab.css'

const INITIAL_CASE: VisualLabCaseId = 'bus-ticket'
const PROPERTY = BOARD[1] as PropertySquare
const AIRPORT = BOARD[6] as AirportSquare
const UTILITY = BOARD[14] as UtilitySquare

const CATEGORIES = [...new Set(VISUAL_LAB_CASES.map((item) => item.category))]

function PopoverStage({ type }: { type: 'property' | 'airport' | 'utility' }) {
  return (
    <div className="visual-lab__popover-anchor">
      <span className="visual-lab__anchor-mark" aria-hidden />
      {type === 'property' ? (
        <PropertyPopover square={PROPERTY} side="top" onClose={() => undefined} />
      ) : type === 'airport' ? (
        <AirportPopover square={AIRPORT} side="top" onClose={() => undefined} />
      ) : (
        <UtilityPopover square={UTILITY} side="top" onClose={() => undefined} />
      )}
    </div>
  )
}

function PrimitivesStage() {
  return (
    <div className="visual-lab__primitives">
      <div className="visual-lab__sample-block">
        <p className="label text-gold">Botões</p>
        <div className="visual-lab__sample-row">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Perigo</Button>
          <Button disabled>Desabilitado</Button>
        </div>
      </div>
      <div className="visual-lab__sample-block">
        <p className="label text-gold">Chips</p>
        <div className="visual-lab__sample-row">
          <Chip>Neutro</Chip>
          <Chip tone="gold">Dourado</Chip>
          <Chip tone="alert">Alerta</Chip>
        </div>
      </div>
      <div className="visual-lab__sample-block visual-lab__sample-block--narrow">
        <p className="label text-gold">Estado vazio</p>
        <EmptyState icon={<Layers3 size={24} />} title="Nada por aqui" hint="Estado sem conteúdo" />
      </div>
    </div>
  )
}

function VisualStage({ item }: { item: VisualLabCase }) {
  switch (item.surface) {
    case 'modal':
      return <ModalLayer />
    case 'trade':
      return <TradeLayer />
    case 'land-auction':
      return <LandAuctionLayer />
    case 'hand-card':
      return <HandCardLayer />
    case 'notice':
      return <NoticeLayer />
    case 'hud':
      return <GameHUD />
    case 'property':
      return <PopoverStage type="property" />
    case 'airport':
      return <PopoverStage type="airport" />
    case 'utility':
      return <PopoverStage type="utility" />
    case 'hand-panel':
      return (
        <div className="visual-lab__panel-sample">
          <HandPanel />
        </div>
      )
    case 'primitives':
      return <PrimitivesStage />
  }
}

export function VisualLab() {
  const [activeId, setActiveId] = useState<VisualLabCaseId>(INITIAL_CASE)
  const originalGame = useRef<GameState>(useGameStore.getState().game)
  const active = VISUAL_LAB_CASES.find((item) => item.id === activeId) ?? VISUAL_LAB_CASES[0]

  useEffect(() => {
    const gameBeforeLab = originalGame.current
    prepareVisualLabCase(INITIAL_CASE)
    return () => {
      useGameStore.setState({ game: gameBeforeLab })
    }
  }, [])

  const selectCase = (id: VisualLabCaseId) => {
    prepareVisualLabCase(id)
    setActiveId(id)
  }

  return (
    <div className="visual-lab">
      <header className="visual-lab__header">
        <div className="visual-lab__title">
          <span className="visual-lab__seal"><FlaskConical size={22} /></span>
          <div>
            <p className="label text-gold">Banco Master</p>
            <h1>Laboratório Visual</h1>
          </div>
        </div>
        <a href="/" className="visual-lab__back">
          <ArrowLeft size={15} />
          Voltar ao jogo
        </a>
      </header>

      <div className="visual-lab__body">
        <aside className="visual-lab__catalog" aria-label="Casos visuais">
          <div className="visual-lab__catalog-head">
            <p className="label text-gold">Casos</p>
            <span>{VISUAL_LAB_CASES.length}</span>
          </div>
          {CATEGORIES.map((category) => (
            <section key={category} className="visual-lab__group">
              <h2>{category}</h2>
              <div className="visual-lab__case-list">
                {VISUAL_LAB_CASES.filter((item) => item.category === category).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="visual-lab__case"
                    data-case-id={item.id}
                    data-active={item.id === activeId || undefined}
                    aria-pressed={item.id === activeId}
                    onClick={() => selectCase(item.id)}
                  >
                    <span>{item.label}</span>
                    {'suspended' in item && (item as { suspended?: boolean }).suspended ? <small>Suspenso</small> : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </aside>

        <main className="visual-lab__workspace">
          <div className="visual-lab__case-head">
            <div>
              <p className="label text-gold">{active.category}</p>
              <h2>{active.label}</h2>
              <p>{active.description}</p>
            </div>
            <span className="visual-lab__real-badge">Componente real</span>
          </div>

          <div className="visual-lab__stage" data-case={active.id}>
            <div className="visual-lab__stage-grid" aria-hidden />
            <VisualStage key={active.id} item={active} />
          </div>
        </main>
      </div>
    </div>
  )
}
