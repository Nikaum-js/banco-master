// Protótipo descartável: cinco pares de botão, comparáveis na mesma tela e
// focáveis via `?ui-lab=buttons&variant=A`.
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './buttonPrototype.css'

const BUTTON_VARIANTS = [
  {
    id: 'A',
    name: 'Sólido institucional',
    description: 'Dourado plano, sem brilho ou volume.',
  },
  {
    id: 'B',
    name: 'Contorno preciso',
    description: 'Superfície escura e uma borda de 1px.',
  },
  {
    id: 'C',
    name: 'Tonal discreto',
    description: 'Ênfase por contraste de superfície.',
  },
  {
    id: 'D',
    name: 'Editorial claro',
    description: 'Alto contraste com presença mais sóbria.',
  },
  {
    id: 'E',
    name: 'Linha de comando',
    description: 'Peso tipográfico e um único acento.',
  },
] as const

type ButtonPrototypeVariant = (typeof BUTTON_VARIANTS)[number]['id']
type ButtonKind = 'primary' | 'secondary'

function variantFromUrl(): ButtonPrototypeVariant {
  const requested = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
  return BUTTON_VARIANTS.some((item) => item.id === requested)
    ? requested as ButtonPrototypeVariant
    : 'A'
}

function PrototypeButton({
  variant,
  kind,
  selected,
  onSelect,
}: {
  variant: ButtonPrototypeVariant
  kind: ButtonKind
  selected: boolean
  onSelect: () => void
}) {
  const label = kind === 'primary' ? 'Criar sala' : 'Voltar'

  return (
    <button
      type="button"
      className="button-prototype__button"
      data-style={variant}
      data-kind={kind}
      aria-label={`${label}, variação ${variant}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {label}
    </button>
  )
}

export function ButtonPrototype() {
  const [current, setCurrent] = useState<ButtonPrototypeVariant>(variantFromUrl)

  const selectVariant = useCallback((variant: ButtonPrototypeVariant) => {
    setCurrent(variant)
    const params = new URLSearchParams(window.location.search)
    params.set('ui-lab', 'buttons')
    params.set('variant', variant)
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${params.toString()}${window.location.hash}`,
    )
  }, [])

  const cycleVariant = useCallback((step: -1 | 1) => {
    const index = BUTTON_VARIANTS.findIndex((item) => item.id === current)
    const next = (index + step + BUTTON_VARIANTS.length) % BUTTON_VARIANTS.length
    selectVariant(BUTTON_VARIANTS[next].id)
  }, [current, selectVariant])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        cycleVariant(-1)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        cycleVariant(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cycleVariant])

  return (
    <div className="button-prototype">
      <div className="button-prototype__intro">
        <div>
          <p className="label text-gold">Comparativo A–E</p>
          <h3>Botões de ação</h3>
        </div>
        <div className="button-prototype__columns" aria-hidden>
          <span>Primário</span>
          <span>Secundário</span>
        </div>
      </div>

      <div className="button-prototype__grid">
        {BUTTON_VARIANTS.map((variant) => {
          const selected = variant.id === current
          return (
            <article
              key={variant.id}
              className="button-prototype__card"
              data-current={selected || undefined}
              data-variant-card={variant.id}
            >
              <header className="button-prototype__card-head">
                <strong>{variant.id}</strong>
                <div>
                  <h4>{variant.name}</h4>
                  <p>{variant.description}</p>
                </div>
              </header>
              <div className="button-prototype__pair">
                <div>
                  <small>Primário</small>
                  <PrototypeButton
                    variant={variant.id}
                    kind="primary"
                    selected={selected}
                    onSelect={() => selectVariant(variant.id)}
                  />
                </div>
                <div>
                  <small>Secundário</small>
                  <PrototypeButton
                    variant={variant.id}
                    kind="secondary"
                    selected={selected}
                    onSelect={() => selectVariant(variant.id)}
                  />
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <nav className="button-prototype__switcher" aria-label="Selecionar variação">
        <button type="button" onClick={() => cycleVariant(-1)} aria-label="Variação anterior">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <span>
          <small>Em foco</small>
          {current} · {BUTTON_VARIANTS.find((item) => item.id === current)?.name}
        </span>
        <button type="button" onClick={() => cycleVariant(1)} aria-label="Próxima variação">
          <ChevronRight size={18} aria-hidden />
        </button>
      </nav>
    </div>
  )
}
