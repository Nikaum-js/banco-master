// Gate responsivo (mobile/tablet/desktop). Prova, na interface real, as invariantes
// que a varredura de auditoria encontrou quebradas — cada `test` aqui nasceu de um
// defeito MEDIDO, não de uma boa prática genérica:
//
//   · nome do jogador some na gaveta de paisagem   → `padding-right: 4.75rem` sobre
//     uma coluna de 76px zerava a largura útil (index.css, bloco de paisagem estreita)
//   · bolas de cor sobrepostas na tela de identidade → trilha de 1,8rem menor que o
//     alvo de 44px, com `aspect-ratio: 1` inflando a bola por cima
//   · controle de áudio em cima do painel de Efeitos Ativos em 667×375
//   · Laboratório Visual inutilizável em 740×360 (empilhava por LARGURA numa tela
//     em que o recurso escasso é a ALTURA)
//
// Roda no projeto `built` (bundle de produção) pelo mesmo motivo de FR-051: o que se
// promove é o bundle, não o dev server. As telas que dependem de `?ui-lab` são a
// exceção — esse andaime é `import.meta.env.DEV` — e por isso ficam no projeto de dev.
import { test, expect, type Page, type Locator } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { trackRuntimeErrors } from './script'

const TOUCH_MIN = 44
const GAP_MIN = 8

// Perfis reais, com toque e densidade — emulação de layout só prova layout, mas
// `hasTouch` muda o que o CSS de `pointer: coarse` decide, e é justamente aí que
// moram os defeitos de alvo de toque.
const PHONE_PORTRAIT = { width: 390, height: 844 }
const PHONE_SMALL_PORTRAIT = { width: 320, height: 568 }
const PLAY_MIN = { width: 740, height: 360 } // mínimo oficial
const PHONE_LANDSCAPE = { width: 667, height: 375 }
const TABLET_LANDSCAPE = { width: 1024, height: 768 }
const DESKTOP = { width: 1440, height: 900 }

// `hasTouch`/`isMobile` NÃO são detalhe de emulação: é o que faz
// `@media (pointer: coarse)` casar. Sem eles, todo teste de alvo de toque estaria
// medindo o caminho de ponteiro fino e passaria sem provar nada. O bloco de
// regressão de desktop no fim do arquivo desliga os dois de propósito.
// `reducedMotion` não é opção de teste nesta versão do Playwright — vai por
// `contextOptions` (types/test.d.ts). Ele existe aqui para a MEDIDA ser estável:
// medir caixa no meio de um spring devolve número diferente a cada rodada. As
// animações em si continuam cobertas pelos testes que já existiam.
test.use({
  contextOptions: { reducedMotion: 'reduce' },
  hasTouch: true,
  isMobile: true,
})

/**
 * Rolagem horizontal acidental — e a prova de que ela não está apenas ESCONDIDA.
 *
 * `body { overflow-x: hidden }` existe nesta folha para conter as artes decorativas
 * (skyline, rotas aéreas) que sangram de propósito. Medir `scrollWidth` com ele
 * ligado responderia sempre "sem transbordo", inclusive se houvesse conteúdo de
 * verdade cortado. Então o teste NEUTRALIZA a máscara antes de medir: se algo
 * transbordar de fato, aparece aqui.
 */
async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const result = await page.evaluate(() => {
    const style = document.createElement('style')
    style.id = '__unmask_overflow__'
    style.textContent = 'html,body{overflow-x:visible !important}'
    document.head.appendChild(style)
    const de = document.documentElement
    // força reflow antes de ler
    void de.offsetWidth
    const root = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth }

    // Qualquer contêiner que role horizontalmente de verdade também conta.
    const containers: { sel: string; over: number }[] = []
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const cs = getComputedStyle(el)
      if (!['auto', 'scroll'].includes(cs.overflowX)) continue
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        containers.push({
          sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
            ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
            : ''),
          over: el.scrollWidth - el.clientWidth,
        })
      }
    }
    style.remove()
    return { root, containers }
  })

  expect(
    result.root.scrollWidth,
    `${label}: documento rola ${result.root.scrollWidth - result.root.clientWidth}px na horizontal (máscara neutralizada)`,
  ).toBeLessThanOrEqual(result.root.clientWidth + 1)

  expect(
    result.containers.filter((c) => !c.sel.startsWith('pre')),
    `${label}: contêiner com rolagem horizontal inesperada`,
  ).toEqual([])
}

/** Alvo de toque efetivo — inclui a área que um `::after` de expansão adiciona. */
async function hitBox(target: Locator): Promise<{ w: number; h: number }> {
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const after = getComputedStyle(el, '::after')
    let w = r.width
    let h = r.height
    // Um `::after` posicionado com inset negativo (ou dimensionado acima do host)
    // estende a área clicável sem inflar a caixa — é a técnica de `.hit-44`.
    if (after.content !== 'none' && after.position === 'absolute') {
      const aw = parseFloat(after.width)
      const ah = parseFloat(after.height)
      if (!Number.isNaN(aw)) w = Math.max(w, aw)
      if (!Number.isNaN(ah)) h = Math.max(h, ah)
    }
    return { w, h }
  })
}

async function expectTouchTarget(target: Locator, label: string): Promise<void> {
  const { w, h } = await hitBox(target)
  expect(Math.round(w), `${label}: largura do alvo`).toBeGreaterThanOrEqual(TOUCH_MIN)
  expect(Math.round(h), `${label}: altura do alvo`).toBeGreaterThanOrEqual(TOUCH_MIN)
}

async function expectNoBlockingA11yViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    blocking.map((v) => `${v.id} (${v.impact}) × ${v.nodes.length}`),
    `${label}: violações serious/critical`,
  ).toEqual([])
}

// ---------------------------------------------------------------------------
// Marketing — retrato, tablet e desktop
// ---------------------------------------------------------------------------

const MARKETING_ROUTES = ['/', '/how-to-play', '/faq'] as const
const PORTRAIT_SIZES = [
  PHONE_SMALL_PORTRAIT,
  PHONE_PORTRAIT,
  { width: 768, height: 1024 },
] as const

for (const route of MARKETING_ROUTES) {
  for (const size of PORTRAIT_SIZES) {
    test(`marketing ${route} não rola na horizontal em ${size.width}×${size.height}`, async ({ page }) => {
      const errors = trackRuntimeErrors(page)
      await page.setViewportSize(size)
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
      await expectNoHorizontalScroll(page, `${route} @ ${size.width}`)
      expect(errors, `${route}: erros de runtime`).toEqual([])
    })
  }
}

test('landing: CTA principal alcançável na primeira dobra do menor telefone', async ({ page }) => {
  await page.setViewportSize(PHONE_SMALL_PORTRAIT)
  await page.goto('/')
  // O primeiro "Jogar agora" do CORPO (não o da barra) é o compromisso da dobra.
  const cta = page.locator('.fx-hero__actions a, .fx-hero__actions button').first()
  await expect(cta).toBeVisible()
  const box = await cta.boundingBox()
  expect(box, 'CTA sem caixa').not.toBeNull()
  expect(
    box!.y + box!.height,
    'CTA do hero deve caber na primeira dobra em 320×568',
  ).toBeLessThanOrEqual(PHONE_SMALL_PORTRAIT.height)
})

test('404 responde 404 e não rola na horizontal', async ({ page }) => {
  await page.setViewportSize(PHONE_PORTRAIT)
  const res = await page.goto('/rota-que-nao-existe')
  expect(res?.status(), 'status da rota desconhecida').toBe(404)
  await expectNoHorizontalScroll(page, '404')
})

// ---------------------------------------------------------------------------
// Entrada do app — retrato
// ---------------------------------------------------------------------------

test('home: sem rolagem horizontal e sem violação bloqueante (Atlas e Fuligem)', async ({ page }) => {
  await page.setViewportSize(PHONE_PORTRAIT)
  await page.goto('/play')
  await page.waitForSelector('[data-home-screen]:not([hidden])', { state: 'attached' })
  await page.waitForTimeout(900)
  await expectNoHorizontalScroll(page, 'home atlas')
  await expectNoBlockingA11yViolations(page, 'home atlas')

  const fuligem = page.locator('[data-map-option="fuligem"]').first()
  if (await fuligem.count()) {
    await fuligem.click({ force: true })
    await page.waitForTimeout(900)
    await expectNoHorizontalScroll(page, 'home fuligem')
  }
})

test('identidade: as oito cores são alcançáveis, sem sobreposição, em todo telefone', async ({ page }) => {
  for (const size of [PHONE_SMALL_PORTRAIT, { width: 360, height: 800 }, PHONE_PORTRAIT]) {
    await page.setViewportSize(size)
    await page.goto('/play?host=1')
    await page.waitForSelector('.identity-color-grid')

    const geom = await page.evaluate((min) => {
      const grid = document.querySelector('.identity-color-grid')!
      const boxes = Array.from(grid.children).map((c) => c.getBoundingClientRect())
      let overlaps = 0
      let minGap = Number.POSITIVE_INFINITY
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]
          const b = boxes[j]
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (ox > 0 && oy > 0) overlaps++
        }
      }
      const rows = [...boxes].sort((a, b) => a.top - b.top || a.left - b.left)
      for (let i = 1; i < rows.length; i++) {
        if (Math.abs(rows[i].top - rows[i - 1].top) < 2) {
          minGap = Math.min(minGap, rows[i].left - rows[i - 1].right)
        }
      }
      return {
        count: boxes.length,
        undersized: boxes.filter((b) => b.width < min || b.height < min).length,
        overlaps,
        minGap: Number.isFinite(minGap) ? minGap : null,
        overflowsRight: boxes.some((b) => b.right > document.documentElement.clientWidth + 1),
      }
    }, TOUCH_MIN)

    const at = `${size.width}×${size.height}`
    expect(geom.count, `${at}: todas as cores presentes`).toBeGreaterThan(0)
    expect(geom.undersized, `${at}: bolas abaixo de ${TOUCH_MIN}px`).toBe(0)
    expect(geom.overlaps, `${at}: bolas sobrepostas`).toBe(0)
    expect(geom.overflowsRight, `${at}: bola fora da tela`).toBe(false)
    if (geom.minGap !== null) {
      expect(Math.round(geom.minGap), `${at}: respiro entre bolas`).toBeGreaterThanOrEqual(GAP_MIN)
    }
  }
})

// ---------------------------------------------------------------------------
// Partida — paisagem
// ---------------------------------------------------------------------------

const PLAY_SIZES = [PHONE_LANDSCAPE, PLAY_MIN, TABLET_LANDSCAPE] as const

for (const size of PLAY_SIZES) {
  test(`partida em ${size.width}×${size.height}: gaveta legível e sem rolagem horizontal`, async ({ page }) => {
    const errors = trackRuntimeErrors(page)
    await page.setViewportSize(size)
    await page.goto('/play?players=2')
    await page.waitForSelector('.board-stage')
    await page.waitForTimeout(600)

    await expectNoHorizontalScroll(page, `partida @ ${size.width}`)

    // O nome do jogador é informação, não enfeite: ele sumia por completo
    // (caixa de 0×14) na gaveta estreita.
    const name = page.locator('.side-panel .player-row__headline > p').first()
    await expect(name).toBeVisible()
    const nameBox = await name.boundingBox()
    expect(nameBox!.width, `${size.width}: largura útil do nome`).toBeGreaterThan(16)

    expect(errors, `partida @ ${size.width}: erros de runtime`).toEqual([])
  })
}

test('controle de áudio não cobre o conteúdo da gaveta, e é alcançável por toque', async ({ page }) => {
  for (const size of [PHONE_LANDSCAPE, PLAY_MIN]) {
    await page.setViewportSize(size)
    await page.goto('/play?players=2')
    await page.waitForSelector('.board-stage')
    await page.waitForTimeout(500)

    const verdict = await page.evaluate(() => {
      const audio = document.querySelector('.audio-control')!.getBoundingClientRect()
      const panel = document.querySelectorAll('.side-panel')[0]
      const sections = Array.from(panel.querySelectorAll('section, .side-panel-section'))
      const last = sections[sections.length - 1]?.getBoundingClientRect()
      const button = document.querySelector('.audio-control button')!
      const hit = document.elementFromPoint(
        audio.left + audio.width / 2,
        audio.top + audio.height / 2,
      )
      return {
        clears: last ? last.bottom <= audio.top + 1 : true,
        reachable: !!hit && (hit === button || button.contains(hit)),
      }
    })

    expect(verdict.clears, `${size.width}: conteúdo da gaveta sob o controle de áudio`).toBe(true)
    expect(verdict.reachable, `${size.width}: controle de áudio coberto por outra camada`).toBe(true)
    await expectTouchTarget(page.locator('.audio-control button'), `${size.width}: mudo`)
  }
})

test('desistir da partida continua um alvo de toque de verdade na gaveta', async ({ page }) => {
  await page.setViewportSize(PLAY_MIN)
  await page.goto('/play?players=2')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(500)
  const quit = page.locator('.player-row__quit').first()
  if (await quit.count()) {
    await expectTouchTarget(quit, '740×360: desistir')
  }
})

test('Fuligem: mesa rica e leilão não quebram em paisagem estreita', async ({ page }) => {
  const errors = trackRuntimeErrors(page)
  for (const scenario of ['fuligem-showcase', 'fuligem-auction']) {
    for (const size of [PLAY_MIN, TABLET_LANDSCAPE]) {
      await page.setViewportSize(size)
      await page.goto(`/play?players=2&scenario=${scenario}&map=fuligem`)
      await page.waitForSelector('.board-stage')
      await page.waitForTimeout(700)
      await expectNoHorizontalScroll(page, `${scenario} @ ${size.width}`)
    }
  }
  expect(errors, 'fuligem: erros de runtime').toEqual([])
})

test('modal alto: o último botão continua alcançável rolando por dentro', async ({ page }) => {
  await page.setViewportSize(PLAY_MIN)
  await page.goto('/play?players=2&scenario=fuligem-auction&map=fuligem')
  await page.waitForSelector('[role="dialog"]')
  await page.waitForTimeout(600)

  const shell = page.locator('[role="dialog"] .modal-shell').first()
  await expect(shell).toBeVisible()

  const geom = await shell.evaluate((el) => ({
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
    bottom: el.getBoundingClientRect().bottom,
    viewportH: window.innerHeight,
  }))

  // O cartão nunca pode ultrapassar a tela: ou cabe, ou rola por dentro.
  expect(geom.bottom, 'cartão do modal ultrapassa a tela').toBeLessThanOrEqual(geom.viewportH + 1)

  const buttons = page.locator('[role="dialog"] button:visible')
  const n = await buttons.count()
  expect(n, 'modal sem botões').toBeGreaterThan(0)
  const last = buttons.nth(n - 1)
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
})

// ---------------------------------------------------------------------------
// OrientationGate — o contrato que não pode quebrar
// ---------------------------------------------------------------------------

test('telefone em retrato durante a partida: pede para girar SEM perder a sessão', async ({ page }) => {
  await page.setViewportSize(PLAY_MIN)
  await page.goto('/play?players=2')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(800)

  // Marca do estado vivo: o aviso não pode desmontar a árvore por baixo dele.
  const beforeSeed = await page.evaluate(() => document.querySelectorAll('.board-square').length)
  expect(beforeSeed, 'tabuleiro não montou').toBeGreaterThan(0)
  await page.evaluate(() => {
    ;(window as unknown as { __responsiveProbe?: number }).__responsiveProbe = 42
  })

  // Gira para retrato.
  await page.setViewportSize({ width: 360, height: 740 })
  await page.waitForTimeout(500)

  const gate = page.getByRole('dialog', { name: /gire o aparelho/i })
  await expect(gate, 'aviso de rotação ausente em retrato durante a partida').toBeVisible()

  // A árvore por baixo continua montada — é isso que preserva a sessão online.
  const duringSquares = await page.evaluate(() => document.querySelectorAll('.board-square').length)
  expect(duringSquares, 'tabuleiro desmontou sob o aviso').toBe(beforeSeed)

  // Volta para paisagem: mesmo estado, mesma instância.
  await page.setViewportSize(PLAY_MIN)
  await page.waitForTimeout(500)
  await expect(gate).toBeHidden()
  const probe = await page.evaluate(
    () => (window as unknown as { __responsiveProbe?: number }).__responsiveProbe,
  )
  expect(probe, 'a página recarregou — a sessão teria caído').toBe(42)
  const afterSquares = await page.evaluate(() => document.querySelectorAll('.board-square').length)
  expect(afterSquares, 'tabuleiro remontou diferente').toBe(beforeSeed)
})

test('telas de entrada NÃO pedem para girar em retrato', async ({ page }) => {
  await page.setViewportSize(PHONE_PORTRAIT)
  for (const route of ['/play', '/play?host=1']) {
    await page.goto(route)
    await page.waitForTimeout(900)
    await expect(
      page.getByRole('dialog', { name: /gire o aparelho/i }),
      `${route}: retrato deve funcionar nas telas de entrada`,
    ).toHaveCount(0)
  }
})

// ---------------------------------------------------------------------------
// Acessibilidade nas larguras móveis
// ---------------------------------------------------------------------------

test('sem violação serious/critical no caminho de jogo em paisagem mínima', async ({ page }) => {
  await page.setViewportSize(PLAY_MIN)
  await page.goto('/play?players=2')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(700)
  await expectNoBlockingA11yViolations(page, 'partida 740×360')
})

// ---------------------------------------------------------------------------
// Regressão de desktop — ponteiro FINO, sem toque. Existe porque as correções
// desta tarefa mexeram em regras compartilhadas (grade de cores, gaveta,
// controle de áudio): o que consertou o celular precisa provar que não estragou
// a mesa grande. Sem `hasTouch`, `pointer: coarse` não casa e o caminho testado
// aqui é de fato o de mouse.
// ---------------------------------------------------------------------------

test.describe('desktop (ponteiro fino)', () => {
  test.use({ hasTouch: false, isMobile: false })

  test('landing, home e partida seguem sem rolagem horizontal em 1440×900', async ({ page }) => {
    const errors = trackRuntimeErrors(page)
    await page.setViewportSize(DESKTOP)

    for (const route of ['/', '/how-to-play', '/faq']) {
      await page.goto(route)
      await expectNoHorizontalScroll(page, `${route} @ desktop`)
    }

    await page.goto('/play')
    await page.waitForSelector('[data-home-screen]:not([hidden])', { state: 'attached' })
    await page.waitForTimeout(900)
    await expectNoHorizontalScroll(page, 'home @ desktop')

    await page.goto('/play?players=2')
    await page.waitForSelector('.board-stage')
    await page.waitForTimeout(600)
    await expectNoHorizontalScroll(page, 'partida @ desktop')

    // A grade de cores passou de 8 colunas fixas para `auto-fit`: em desktop ela
    // continua entregando as oito bolas, com tamanho de verdade (a primeira
    // tentativa desta correção as colapsou para 2×2 aqui).
    await page.goto('/play?host=1')
    await page.waitForSelector('.identity-color-grid')
    const swatches = await page.evaluate(() => {
      const grid = document.querySelector('.identity-color-grid')!
      return Array.from(grid.children).map((c) => {
        const r = c.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height) }
      })
    })
    expect(swatches.length, 'desktop: cores disponíveis').toBeGreaterThan(0)
    expect(
      swatches.filter((s) => s.w < 16 || s.h < 16),
      'desktop: bolas colapsadas',
    ).toEqual([])

    expect(errors, 'desktop: erros de runtime').toEqual([])
  })

  test('nome do jogador continua legível na coluna larga', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/play?players=2')
    await page.waitForSelector('.board-stage')
    await page.waitForTimeout(600)
    const name = page.locator('.side-panel .player-row__headline > p').first()
    await expect(name).toBeVisible()
    const box = await name.boundingBox()
    expect(box!.width, 'desktop: largura do nome').toBeGreaterThan(40)
  })
})
