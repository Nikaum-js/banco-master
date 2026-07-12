// Spec 057 — a vitrine de probabilidades, com LAYOUT DE VERDADE.
//
// Este arquivo existe por um motivo específico: os 13 testes de `tests/ui/deckOddsModal.test.tsx`
// passavam verdes enquanto a feature piscava na cara do usuário. O bug era de LAYOUT, e jsdom não
// calcula layout — nenhum teste de unidade poderia tê-lo pegado.
//
// O bug: a descrição abria no fluxo e empurrava as linhas de baixo. Com hover abrindo, isso fecha
// um loop de realimentação — abre → linha se desloca → sai de baixo do cursor → `mouseleave` →
// fecha → volta → `mouseenter` → abre. Pisca-pisca ao mover o mouse entre dois itens.
//
// A asserção central é geométrica e vale mais que "não piscou": provar que abrir uma descrição
// NÃO MOVE nenhuma outra linha. Enquanto isso for verdade, o ciclo não tem como começar — e
// qualquer refator que devolva a descrição ao fluxo reprova aqui.
import { test, expect, type Page } from '@playwright/test'

async function abrirVitrine(page: Page, casa: 'Acaso' | 'Tesouro') {
  await page.goto('/play?players=2&map=fuligem')
  // Separador DOIS-PONTOS: `Board01Classic.tsx` monta `${square.name}: ver detalhes`. Era
  // travessão até `7a90710 style(copy): clarify interface punctuation`, e este arquivo
  // continuou procurando o travessão por dois meses sem ninguém ver — nenhum job da CI o
  // executava. É o que motivou pô-lo no gate.
  await page.getByRole('button', { name: new RegExp(`^${casa}: ver detalhes$`, 'i') }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

/** Topo de cada linha DENTRO da lista (`offsetTop`), não na viewport.
 *
 * `getBoundingClientRect` seria errado aqui: o `hover()` do Playwright rola o elemento até a
 * vista antes de apontar, e a rolagem desloca TODAS as linhas na viewport. Isso reprovava o
 * teste por artefato do próprio teste. `offsetTop` é relativo ao container e imune a scroll —
 * mede o que a asserção quer medir: o fluxo mudou ou não. */
async function topos(page: Page): Promise<number[]> {
  return page.locator('[role=dialog] .deck-odds-row__trigger').evaluateAll(
    (els) => els.map((e) => (e as HTMLElement).offsetTop),
  )
}

test.describe('vitrine de probabilidades — layout', () => {
  test('abrir uma descrição não desloca nenhuma linha (mata o loop de hover)', async ({ page }) => {
    await abrirVitrine(page, 'Acaso')
    const linhas = page.locator('[role=dialog] .deck-odds-row__trigger')

    const antes = await topos(page)
    await linhas.nth(3).hover()
    // A descrição tem de estar realmente aberta — senão o teste passaria por não fazer nada.
    await expect(linhas.nth(3)).toHaveAttribute('aria-expanded', 'true')

    const depois = await topos(page)
    expect(depois).toEqual(antes)
  })

  test('varrer o mouse pela lista não faz a descrição piscar', async ({ page }) => {
    await abrirVitrine(page, 'Tesouro')
    const linhas = page.locator('[role=dialog] .deck-odds-row__trigger')

    // Passa devagar por cinco itens em sequência — o gesto exato do relato. Ao fim de cada
    // parada, exatamente UM item está aberto: o que está sob o cursor.
    for (let i = 2; i < 7; i++) {
      await linhas.nth(i).hover()
      await expect(linhas.nth(i)).toHaveAttribute('aria-expanded', 'true')
      const abertos = await linhas.evaluateAll(
        (els) => els.filter((e) => e.getAttribute('aria-expanded') === 'true').length,
      )
      expect(abertos, `parada ${i}`).toBe(1)
    }
  })

  test('parar na fronteira entre dois itens estabiliza — não oscila', async ({ page }) => {
    await abrirVitrine(page, 'Acaso')
    const linhas = page.locator('[role=dialog] .deck-odds-row__trigger')

    // Põe o cursor na borda exata entre a linha 4 e a 5, onde o layout antigo oscilava.
    // Hover primeiro para que a rolagem-até-a-vista aconteça ANTES de ler a caixa: lida antes,
    // a coordenada ficaria obsoleta e o `mouse.move` cairia noutra linha.
    await linhas.nth(3).hover()
    const a = (await linhas.nth(3).boundingBox())!
    await page.mouse.move(a.x + a.width / 2, a.y + a.height - 1)

    // ASSENTAR ANTES DE MEDIR. A primeira versão deste teste tirava o retrato no instante do
    // `mouse.move`, antes do React processar o `mouseenter` — e então comparava "nada aberto"
    // com "um aberto", reprovando por corrida do próprio teste em vez de por oscilação.
    const contarAbertos = () => linhas.evaluateAll(
      (els) => els.filter((e) => e.getAttribute('aria-expanded') === 'true').length,
    )
    await expect.poll(contarAbertos).toBe(1)

    const estado1 = await linhas.evaluateAll((els) => els.map((e) => e.getAttribute('aria-expanded')))
    await page.waitForTimeout(400) // tempo de sobra para várias voltas do ciclo, se existisse
    const estado2 = await linhas.evaluateAll((els) => els.map((e) => e.getAttribute('aria-expanded')))

    expect(estado2).toEqual(estado1) // cursor parado ⇒ nada muda
  })

  test('a descrição das últimas linhas não é cortada pela borda da lista', async ({ page }) => {
    await abrirVitrine(page, 'Tesouro')
    const linhas = page.locator('[role=dialog] .deck-odds-row__trigger')
    const ultima = linhas.last()
    await ultima.hover()

    const id = await ultima.getAttribute('aria-controls')
    const painel = page.locator(`#${id}`)
    await expect(painel).toBeVisible()

    const cx = await painel.boundingBox()
    const lista = await page.locator('[role=dialog] .deck-odds-list').boundingBox()
    expect(cx!.y).toBeGreaterThanOrEqual(lista!.y - 1)
    expect(cx!.y + cx!.height).toBeLessThanOrEqual(lista!.y + lista!.height + 1)
  })
})
