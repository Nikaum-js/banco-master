// @vitest-environment jsdom
// Spec 057 — a vitrine na tela.
//
// O teste que mais importa aqui é o de ACESSIBILIDADE (FR-008), e ele não é cerimônia: a
// feature existe para ENSINAR, e uma explicação que só aparece no hover não ensina ninguém no
// celular nem no teclado. Por isso a asserção é dupla — a descrição tem de estar em DOM e o
// `aria-expanded` tem de contar a verdade.
//
// Sem `user-event` e sem `jest-dom` de propósito: o repo não os tem, e uma dependência nova
// para digitar Enter seria custo sem retorno. `fireEvent` + `getAttribute` é o idioma da casa.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DeckOddsModal } from '@/game/ui/cards/DeckOddsModal'
import { RARITY_LABEL, RARITY_PIPS } from '@/game/ui/cards/cardMeta'
import { deckOdds } from '@/game/ui/cards/deckOdds'
import { useBoardTheme } from '@/game/ui/theme/boardTheme'

afterEach(() => {
  cleanup()
  act(() => useBoardTheme.getState().setTheme('atlas'))
})

/** Os gatilhos de linha (exclui o botão de fechar do header, que não controla descrição). */
const triggers = () =>
  screen.getAllByRole('listitem').map((li) => within(li).getByRole('button'))

describe('DeckOddsModal — conteúdo e ordem', () => {
  it('o Acaso lista os 18 efeitos, na ordem da projeção (o DOM não reordena)', () => {
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    const esperado = deckOdds('acaso').rows.map((r) => r.title)
    const naTela = triggers().map((b) => b.textContent ?? '')
    expect(naTela).toHaveLength(18)
    for (const [i, titulo] of esperado.entries()) {
      expect(naTela[i], `posição ${i}`).toContain(titulo)
    }
  })

  it('o Tesouro lista os 14 efeitos e anuncia o tamanho do baralho', () => {
    render(<DeckOddsModal deck="tesouro" onClose={() => {}} />)
    expect(triggers()).toHaveLength(14)
    expect(screen.getByText(/18 cartas/)).toBeTruthy()
  })

  it('diz que a chance NÃO acompanha o andamento da partida', () => {
    // Sem esta frase o jogador supõe probabilidade condicional sobre o baralho restante — e é
    // justamente o que ela não é, por privacidade (D-037). O texto é parte do requisito.
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    expect(screen.getByText(/não muda com o andamento da partida/i)).toBeTruthy()
  })

  it('efeito com 2 cópias mostra a contagem; com 1 cópia, não polui a linha', () => {
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    const dupla = screen.getByRole('button', { name: /Atalho/ })
    expect(dupla.textContent).toContain('2 cartas')
    const unica = screen.getByRole('button', { name: /Aquisição Hostil/ })
    expect(unica.textContent).not.toContain('cartas')
  })

  it('exibe os quatro níveis com rótulo e quantidade correta de losangos', () => {
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    const rows = deckOdds('acaso').rows
    const botoes = triggers()

    expect([...new Set(rows.map((row) => row.rarity))].sort())
      .toEqual(['comum', 'epica', 'lendaria', 'rara'])

    for (const [index, row] of rows.entries()) {
      expect(botoes[index].textContent).toContain(RARITY_LABEL[row.rarity])
      expect(botoes[index].querySelectorAll('.deck-odds-row__pips i'))
        .toHaveLength(RARITY_PIPS[row.rarity])
    }
  })
})

describe('DeckOddsModal — a explicação sem ponteiro (FR-008)', () => {
  it('começa fechada, e acionar pelo teclado abre a explicação daquele item', () => {
    render(<DeckOddsModal deck="tesouro" onClose={() => {}} />)
    const alvo = screen.getByRole('button', { name: /Bunker Fiscal/ })
    expect(alvo.getAttribute('aria-expanded')).toBe('false')

    const descId = alvo.getAttribute('aria-controls')!
    expect((document.getElementById(descId) as HTMLElement).hidden).toBe(true)

    // `click` é o que o browser dispara para Enter/Espaço num <button> — é o caminho do
    // teclado, sem nenhum evento de ponteiro envolvido.
    fireEvent.click(alvo)

    expect(alvo.getAttribute('aria-expanded')).toBe('true')
    const desc = document.getElementById(descId) as HTMLElement
    expect(desc.hidden).toBe(false)
    expect(desc.textContent?.length ?? 0).toBeGreaterThan(0)
  })

  it('receber FOCO já revela — quem navega por Tab não precisa acionar', () => {
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    const alvo = screen.getByRole('button', { name: /Estatização/ })
    fireEvent.focus(alvo)
    expect(alvo.getAttribute('aria-expanded')).toBe('true')
    fireEvent.blur(alvo)
    expect(alvo.getAttribute('aria-expanded')).toBe('false')
  })

  it('clicar DURANTE o hover fixa, em vez de desfazer o que o hover abriu', () => {
    // Regressão de tela: `hover abre` + `clique alterna` se anulavam, então o item que o
    // jogador acabava de clicar era justamente o que ficava fechado. Só apareceu no screenshot
    // real — o teste anterior clicava sem passar o ponteiro antes, como o browser faz.
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    const alvo = screen.getByRole('button', { name: /Greve/ })

    fireEvent.mouseEnter(alvo)
    expect(alvo.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(alvo)
    expect(alvo.getAttribute('aria-expanded')).toBe('true') // fixou, não desfez
    fireEvent.mouseLeave(alvo)
    expect(alvo.getAttribute('aria-expanded')).toBe('true') // sair não apaga o que foi fixado
    fireEvent.click(alvo)
    expect(alvo.getAttribute('aria-expanded')).toBe('false') // segundo clique solta
  })

  it('varrer a lista com o ponteiro não deixa 18 descrições abertas', () => {
    // Sem fechar ao sair, passar o mouse pela lista abria tudo e o modal virava parede de texto.
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    const gatilhos = triggers()
    for (const g of gatilhos) {
      fireEvent.mouseEnter(g)
      fireEvent.mouseLeave(g)
    }
    const abertos = gatilhos.filter((g) => g.getAttribute('aria-expanded') === 'true')
    expect(abertos).toHaveLength(0)
  })

  it('a explicação está em DOM e associada por aria-controls — nunca só em `title`', () => {
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    for (const btn of triggers()) {
      const id = btn.getAttribute('aria-controls')
      expect(id, btn.textContent ?? '').toBeTruthy()
      expect(btn.getAttribute('aria-expanded')).toBeTruthy()
      expect(document.getElementById(id!), id!).toBeTruthy()
      expect(btn.getAttribute('title')).toBeNull()
    }
  })

  it('todo item é um <button> nativo — nenhum é só-hover nem tabIndex inventado', () => {
    render(<DeckOddsModal deck="tesouro" onClose={() => {}} />)
    const gatilhos = triggers()
    expect(gatilhos).toHaveLength(14)
    for (const g of gatilhos) {
      expect(g.tagName).toBe('BUTTON')
      expect(g.getAttribute('aria-hidden')).toBeNull()
    }
  })
})

describe('DeckOddsModal — casca informativa (FR-010)', () => {
  it('Esc fecha: é modal informativo (SRS §1057)', () => {
    let fechou = false
    render(<DeckOddsModal deck="acaso" onClose={() => { fechou = true }} />)
    // O listener vive no NÓ do diálogo (a11y/dialog.ts), não no document: teclado só chega
    // aqui porque o foco está preso dentro da camada, que é o ponto do trap.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(fechou).toBe(true)
  })

  it('tem semântica de diálogo com nome acessível', () => {
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent).toContain('Acaso')
  })

  it('porta a camada ao body para escapar do stacking context do tabuleiro', () => {
    render(<DeckOddsModal deck="tesouro" onClose={() => {}} />)
    expect(screen.getByRole('dialog').parentElement).toBe(document.body)
  })
})

describe('DeckOddsModal — os dois mapas (FR-012)', () => {
  it('o conteúdo do baralho é o mesmo na Fuligem e no Atlas', () => {
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    const noAtlas = triggers().length
    cleanup()

    act(() => useBoardTheme.getState().setTheme('fuligem'))
    render(<DeckOddsModal deck="acaso" onClose={() => {}} />)
    expect(triggers()).toHaveLength(noAtlas)
    expect(screen.getByText(/21 cartas/)).toBeTruthy()
  })
})
