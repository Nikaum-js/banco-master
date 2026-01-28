// @vitest-environment jsdom
// Vocabulário de movimento (044, T018/T021 — US5/D7 do plan). `useReducedMotion` do
// `motion/react` é mockado (não o `matchMedia`): a implementação real cacheia a checagem
// de `matchMedia` num singleton de módulo (ver `motion-dom`), o que tornaria os dois
// cenários (reduzido/não-reduzido) dependentes de ORDEM de execução dentro do arquivo —
// mockar o hook é a fronteira estável. `motion.div`/`AnimatePresence` continuam reais
// (`importOriginal`), então os componentes de teste renderizam de verdade.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { motion } from 'motion/react'
import { useMotion, MOTION, EASE, fade, pop, slideUp } from '@/game/ui/motion'

const { getReduced, setReduced } = vi.hoisted(() => {
  let reduced = false
  return {
    getReduced: () => reduced,
    setReduced: (v: boolean) => { reduced = v },
  }
})

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return { ...actual, useReducedMotion: () => getReduced() }
})

afterEach(() => {
  cleanup()
  setReduced(false)
})

describe('vocabulário de movimento (T018)', () => {
  it('as variantes exportadas (fade/pop/slideUp) usam exclusivamente os tokens — nenhum número mágico de duração/curva', () => {
    for (const set of [fade, pop, slideUp]) {
      expect(set.animate.transition).toEqual({ duration: MOTION.base, ease: EASE.emphasis })
      expect(set.exit.transition).toEqual({ duration: MOTION.fast, ease: EASE.standard })
    }
  })

  it('useMotion() sem movimento reduzido devolve as durações do vocabulário intactas', () => {
    setReduced(false)
    const { result } = renderHook(() => useMotion())
    expect(result.current.reduced).toBe(false)
    expect(result.current.fade.animate.transition.duration).toBe(MOTION.base)
    expect(result.current.pop.exit.transition.duration).toBe(MOTION.fast)
    expect(result.current.slideUp.animate.transition.duration).toBe(MOTION.base)
  })

  it('useMotion() com movimento reduzido devolve duração ZERO nas três variantes, sem tocar nos valores-alvo', () => {
    setReduced(true)
    const { result } = renderHook(() => useMotion())
    expect(result.current.reduced).toBe(true)
    for (const key of ['fade', 'pop', 'slideUp'] as const) {
      const braked = result.current[key]
      const original = { fade, pop, slideUp }[key]
      expect(braked.animate.transition).toEqual({ duration: 0 })
      expect(braked.exit.transition).toEqual({ duration: 0 })
      // O FATO (opacity/scale/y de destino) não muda — só a transição para.
      const { transition: _a, ...animateRest } = braked.animate
      const { transition: _b, ...originalAnimateRest } = original.animate
      expect(animateRest).toEqual(originalAnimateRest)
      const { transition: _c, ...exitRest } = braked.exit
      const { transition: _d, ...originalExitRest } = original.exit
      expect(exitRest).toEqual(originalExitRest)
      expect(braked.initial).toEqual(original.initial)
    }
  })
})

// Componente mínimo pro caso do T021: mostra "o fato" (quem é o dono agora) com o
// vocabulário `pop`. Fica pequeno de propósito — o alvo é o CONTRATO do freio, não
// reconstruir `ClassicSquare`/`PlayerRow` (esses vivem em `boards/shared.tsx`).
function OwnerFact({ owner }: { owner: string | null }) {
  const { pop: popVariant } = useMotion()
  if (!owner) return null
  return (
    <motion.span key={owner} initial={popVariant.initial} animate={popVariant.animate}>
      Dono: {owner}
    </motion.span>
  )
}

describe('freio de movimento reduzido não apaga o fato (T021, FR-030)', () => {
  it('com movimento reduzido, o novo dono aparece no DOM imediatamente — só a transição some', () => {
    setReduced(true)
    const { rerender } = render(<OwnerFact owner={null} />)
    expect(screen.queryByText(/Dono:/)).toBeNull()

    rerender(<OwnerFact owner="Jogador 2" />)
    // Nenhum timer avançado, nenhuma espera por animação: o fato já está no DOM.
    expect(screen.getByText('Dono: Jogador 2')).toBeTruthy()
  })

  it('sem movimento reduzido, o mesmo fato também aparece — o freio só existe pra quem pediu', () => {
    setReduced(false)
    const { rerender } = render(<OwnerFact owner={null} />)
    rerender(<OwnerFact owner="Jogador 3" />)
    expect(screen.getByText('Dono: Jogador 3')).toBeTruthy()
  })
})
