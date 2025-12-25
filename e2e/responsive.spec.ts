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
// Retrato de celular (D-079) — o contrato que não pode quebrar.
//
// Este bloco existia ao contrário: até a D-079 ele PROVAVA que retrato exibia
// "gire o aparelho". O aviso era exatamente o que dispensava o layout de baixo
// de funcionar — e, escondido por ele, o layout apodreceu: medido em 320×568,
// a mesa começava a ~410px de uma tela de 568px, quase inteira abaixo da dobra.
// Agora o gate prova o oposto: em retrato se JOGA.
// ---------------------------------------------------------------------------

const PORTRAIT_PLAY_SIZES = [
  PHONE_SMALL_PORTRAIT,
  { width: 360, height: 640 },
  PHONE_PORTRAIT,
] as const

for (const size of PORTRAIT_PLAY_SIZES) {
  test(`retrato ${size.width}×${size.height}: tabuleiro inteiro acima da dobra`, async ({ page }) => {
    const errors = trackRuntimeErrors(page)
    await page.setViewportSize(size)
    await page.goto('/play?players=2')
    await page.waitForSelector('.board-stage')
    await page.waitForTimeout(700)

    // Nenhum aviso de rotação, em orientação nenhuma.
    await expect(
      page.getByRole('dialog', { name: /gire o aparelho/i }),
      'retrato voltou a recusar a partida',
    ).toHaveCount(0)

    const geom = await page.evaluate(() => {
      const frame = document.querySelector('.board-frame')!.getBoundingClientRect()
      return {
        top: frame.top,
        bottom: frame.bottom,
        width: frame.width,
        viewportH: window.innerHeight,
        viewportW: window.innerWidth,
      }
    })

    // O herói: largura inteira, inteiro na tela. Não "visível rolando" — visível.
    expect(geom.top, 'tabuleiro começa fora da tela').toBeGreaterThanOrEqual(-1)
    expect(
      geom.bottom,
      `tabuleiro passa da dobra (${Math.round(geom.bottom)} > ${geom.viewportH})`,
    ).toBeLessThanOrEqual(geom.viewportH + 1)
    expect(
      geom.width,
      'tabuleiro deixou de ocupar a largura da viewport',
    ).toBeGreaterThanOrEqual(geom.viewportW * 0.95)

    await expectNoHorizontalScroll(page, `retrato @ ${size.width}`)
    expect(errors, `retrato @ ${size.width}: erros de runtime`).toEqual([])
  })
}

test('retrato: a gaveta mostra caixa e vez sem exigir toque, e as abas alternam os painéis', async ({ page }) => {
  await page.setViewportSize(PHONE_PORTRAIT)
  await page.goto('/play?players=2')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(700)

  // Cockpit: o que a D-079 promete estar à vista de graça.
  const cockpit = page.locator('.portrait-dock__cockpit')
  await expect(cockpit, 'cockpit ausente em retrato').toBeVisible()
  await expect(cockpit).toContainText(/R\$/)

  // Abas: `tablist` de verdade, e cada uma revela o seu painel.
  const players = page.getByRole('tab', { name: 'Jogadores' })
  const actions = page.getByRole('tab', { name: 'Ações' })
  await expectTouchTarget(players, 'aba Jogadores')
  await expectTouchTarget(actions, 'aba Ações')

  await expect(players).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.side-panel--players')).toBeVisible()
  await expect(page.locator('.side-panel--actions')).toBeHidden()

  await actions.click()
  await expect(actions).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.side-panel--actions')).toBeVisible()
  await expect(page.locator('.side-panel--players')).toBeHidden()
})

test('girar não perde a sessão nem remonta o tabuleiro', async ({ page }) => {
  await page.setViewportSize(PLAY_MIN)
  await page.goto('/play?players=2')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(800)

  const beforeSeed = await page.evaluate(() => document.querySelectorAll('.board-square').length)
  expect(beforeSeed, 'tabuleiro não montou').toBeGreaterThan(0)
  await page.evaluate(() => {
    ;(window as unknown as { __responsiveProbe?: number }).__responsiveProbe = 42
  })

  // Paisagem → retrato: agora a mesa CONTINUA jogável, não some sob um aviso.
  await page.setViewportSize({ width: 360, height: 740 })
  await page.waitForTimeout(500)
  await expect(page.locator('.board-frame')).toBeVisible()
  const duringSquares = await page.evaluate(() => document.querySelectorAll('.board-square').length)
  expect(duringSquares, 'tabuleiro desmontou ao girar').toBe(beforeSeed)

  // E de volta: mesma instância, mesmo estado.
  await page.setViewportSize(PLAY_MIN)
  await page.waitForTimeout(500)
  const probe = await page.evaluate(
    () => (window as unknown as { __responsiveProbe?: number }).__responsiveProbe,
  )
  expect(probe, 'a página recarregou — a sessão teria caído').toBe(42)
  const afterSquares = await page.evaluate(() => document.querySelectorAll('.board-square').length)
  expect(afterSquares, 'tabuleiro remontou diferente').toBe(beforeSeed)
})

// Densidade da gaveta — o gate que FALTAVA, e cuja ausência deixou a primeira versão
// desta feature ir a produção quebrada. Ela media geometria (tabuleiro acima da dobra,
// nada transbordando) e passava, enquanto no aparelho real a gaveta herdava tamanhos de
// desktop e cabiam duas linhas e meia. Geometria certa e densidade errada passam no mesmo
// teste — a menos que alguém meça a densidade.
//
// Altura de viewport de NAVEGADOR (barra de endereço e de navegação já descontadas), que
// é o que o jogador tem de fato, e não a altura nominal do aparelho.
for (const size of [
  { width: 360, height: 640 },
  { width: 412, height: 740 },
] as const) {
  test(`retrato ${size.width}×${size.height}: a gaveta cabe informação de verdade`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto('/play?players=6')
    await page.waitForSelector('.board-stage')
    await page.waitForTimeout(800)

    const m = await page.evaluate(() => {
      const panel = document.querySelector('.side-panel:not([hidden])') as HTMLElement
      const rows = Array.from(document.querySelectorAll('.player-row'))
      const die = document.querySelector('.dice-arena .relative')?.getBoundingClientRect()
      const board = document.querySelector('.board-frame')!.getBoundingClientRect()
      // Seção ESPREMIDA: `.side-panel-section` tem `overflow: hidden`, então quando o flex
      // a comprime o conteúdo é cortado em silêncio — foi o que decapitou a linha do
      // jogador. `scrollHeight > clientHeight` é exatamente esse corte.
      const squeezed = Array.from(document.querySelectorAll('.side-panel:not([hidden]) .side-panel-section'))
        .filter((el) => el.scrollHeight > el.clientHeight + 1)
        .map((el) => el.className.split(/\s+/)[1] ?? 'section')
      return {
        squeezed,
        rowH: rows.length ? Math.round(rows[0].getBoundingClientRect().height) : 0,
        rowsFullyVisible: rows.filter((el) => {
          const b = el.getBoundingClientRect()
          return b.top >= panel.getBoundingClientRect().top - 1 && b.bottom <= window.innerHeight + 1
        }).length,
        dieRatio: die ? die.width / board.width : 0,
        panelScrolls: panel.scrollHeight > panel.clientHeight,
      }
    })

    expect(m.squeezed, 'seção da gaveta espremida — conteúdo cortado sem aviso').toEqual([])
    expect(m.rowH, 'linha do jogador voltou à altura de desktop').toBeLessThanOrEqual(72)
    expect(m.rowsFullyVisible, 'a gaveta não mostra nem dois jogadores inteiros').toBeGreaterThanOrEqual(2)
    // O dado é o objeto que mais destoava: 56px fixos num miolo de ~200px.
    expect(m.dieRatio, 'dado desproporcional ao tabuleiro').toBeLessThanOrEqual(0.12)
    expect(m.panelScrolls, 'com seis jogadores a gaveta tem de rolar, não comprimir').toBe(true)
  })
}

// Negociação em retrato — três defeitos relatados no aparelho, três invariantes.
test('retrato: a negociação não pede arrasto horizontal e não salta de altura', async ({ page }) => {
  await page.setViewportSize(PHONE_SMALL_PORTRAIT)
  // `endgame` semeia títulos dos dois lados — sem propriedade não há o que provar aqui.
  await page.goto('/play?players=2&scenario=endgame')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(700)
  await page.getByRole('tab', { name: 'Ações' }).click()
  await page.getByRole('button', { name: /nova negocia/i }).first().click()
  await page.waitForTimeout(600)

  const geom = await page.evaluate(() => {
    const de = document.documentElement
    const rows = Array.from(document.querySelectorAll('.trade-property-term'))
    return {
      rows: rows.length,
      // O grupo Título/Imunidade era cortado pelo `overflow: hidden` da linha, e chegar na
      // imunidade exigia arrastar. Empilhados, os dois lados têm a largura inteira.
      clipped: rows.filter((el) => el.scrollWidth > el.clientWidth + 1).length,
      offscreen: Array.from(document.querySelectorAll('.trade-property-term__actions'))
        .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 1).length,
      stacked: getComputedStyle(document.querySelector('.trade-composer__sides')!).flexDirection,
    }
  })
  expect(geom.rows, 'cenário sem propriedades — o teste não prova nada').toBeGreaterThan(0)
  expect(geom.clipped, 'linha de propriedade cortada: a imunidade voltou a pedir arrasto').toBe(0)
  expect(geom.offscreen, 'grupo Título/Imunidade fora da tela').toBe(0)
  expect(geom.stacked, 'os dois lados voltaram a dividir a largura').toBe('column')

  // A trava de esvaziamento aparece e some conforme o dinheiro muda. A CAIXA dela é
  // reservada, então o cartão não pode mudar de altura — era isso que fazia o "Confirmar"
  // fugir do dedo no meio do arrasto.
  const cardHeight = () => page.evaluate(() =>
    Math.round(document.querySelector('.trade-composer__veto')!.parentElement!.getBoundingClientRect().height))
  const before = await cardHeight()
  await page.locator('.trade-cash-range').first().evaluate((el: HTMLInputElement) => {
    el.value = String(Math.floor(Number(el.max) / 2))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.waitForTimeout(400)
  expect(await cardHeight(), 'o cartão da negociação saltou de altura').toBe(before)
})

// A escritura muda de FORMA no celular (D-079): balão ancorado pressupõe espaço ao lado da
// casa, e num tabuleiro que ocupa a largura da tela não existe "ao lado".
test('retrato: a escritura da casa é modal centrado, não balão ancorado', async ({ page }) => {
  await page.setViewportSize(PHONE_PORTRAIT)
  await page.goto('/play?players=2')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(700)
  await page.locator('.board-square-button').nth(3).click({ force: true })
  await page.waitForTimeout(500)

  const deed = await page.evaluate(() => {
    const surf = document.querySelector('.deed-popover')
    if (!surf) return null
    const b = surf.getBoundingClientRect()
    return {
      modal: !!document.querySelector('.deed-modal'),
      offscreen: b.right > document.documentElement.clientWidth + 1 || b.left < -1
        || b.bottom > window.innerHeight + 1 || b.top < -1,
    }
  })
  expect(deed, 'escritura não abriu').not.toBeNull()
  expect(deed!.modal, 'a escritura voltou a ser balão ancorado em retrato').toBe(true)
  expect(deed!.offscreen, 'a escritura saiu da tela').toBe(false)
})

// O Diário troca de lugar em retrato: sai do miolo (onde era esmagado a 16px) e vira aba.
test('retrato: o Diário sai do miolo e vira aba com altura de verdade', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/play?players=2')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(700)

  expect(
    await page.locator('.board-frame .center-log').count(),
    'o Diário continua disputando o miolo com os dados',
  ).toBe(0)

  await page.getByRole('tab', { name: 'Diário' }).click()
  await page.waitForTimeout(400)
  const logH = await page.evaluate(() =>
    Math.round(document.querySelector('.side-panel--log .center-log')!.getBoundingClientRect().height))
  expect(logH, 'o Diário voltou a ser uma faixa sem altura').toBeGreaterThan(90)

  // O avatar do miolo nasce com 72px inline; em retrato ele cede espaço ao resto.
  const face = await page.evaluate(() =>
    Math.round(document.querySelector('.dice-arena__face')!.getBoundingClientRect().height))
  expect(face, 'avatar do miolo voltou ao tamanho de desktop').toBeLessThanOrEqual(52)
})

// ---------------------------------------------------------------------------
// Achados do teste em aparelho real (2026-07-31). Cada `test` abaixo nasceu de um
// defeito RELATADO e MEDIDO, não de boa prática genérica.
// ---------------------------------------------------------------------------

test('retrato: o Diário vazio cabe inteiro e é alcançável', async ({ page }) => {
  // A ilustração do estado vazio tem altura própria; o cartão cortava 136px dela e nem o
  // cartão nem a gaveta rolavam — o resto era inalcançável.
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/play?players=2')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(700)
  await page.getByRole('tab', { name: 'Diário' }).click()
  await page.waitForTimeout(400)

  const fim = page.locator('.center-log-empty span').last()
  await expect(fim, 'fim do estado vazio não renderizou').toBeVisible()
  await fim.scrollIntoViewIfNeeded()
  const alcance = await fim.evaluate((el) => {
    const b = el.getBoundingClientRect()
    return { dentro: b.top >= -1 && b.bottom <= window.innerHeight + 1, altura: b.height }
  })
  expect(alcance.altura, 'a última linha do estado vazio tem altura zero').toBeGreaterThan(0)
  expect(alcance.dentro, 'o fim do Diário vazio não é alcançável nem rolando').toBe(true)
})

test('retrato: a gaveta termina com respiro, não colada no rodapé', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/play?players=2')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(700)
  await page.getByRole('tab', { name: 'Ações' }).click()
  await page.waitForTimeout(300)
  await page.evaluate(() => { (document.querySelector('.side-panel--actions') as HTMLElement).scrollTop = 99_999 })
  await page.waitForTimeout(300)

  const folga = await page.evaluate(() => {
    const ultimo = document.querySelector('.trade-panel__new-action')!.getBoundingClientRect()
    const audio = document.querySelector('.audio-control')!.getBoundingClientRect()
    return { ateRodape: window.innerHeight - ultimo.bottom, ateAudio: audio.top - ultimo.bottom }
  })
  // O último elemento encostava no fim da tela e a gaveta parecia cortada mesmo inteira.
  expect(folga.ateRodape, 'a gaveta termina colada no rodapé').toBeGreaterThanOrEqual(48)
  expect(folga.ateAudio, 'o último item encosta no controle de áudio').toBeGreaterThanOrEqual(8)
})

for (const modo of ['bus', 'prisao', 'compra'] as const) {
  test(`retrato: a zona de ação (${modo}) não corta rótulo nem estoura o tabuleiro`, async ({ page }) => {
    // `TurnActionBtn` nasce com padding e corpo de tela larga, e `Button` traz
    // `whitespace-nowrap`: num miolo de ~260px o rótulo era CORTADO em silêncio —
    // "Finalizar turno", "Pagar R$ 50", "Leilão" e "Bilhete de Trem", todos medidos.
    await page.setViewportSize(PHONE_SMALL_PORTRAIT)
    await page.goto(`/play?players=2&scenario=acoes&modo=${modo}`)
    await page.waitForSelector('.board-stage')
    await page.waitForTimeout(800)

    const z = await page.evaluate(() => {
      const frame = document.querySelector('.board-frame')!.getBoundingClientRect()
      const zona = document.querySelector('.dice-arena')!.getBoundingClientRect()
      const btns = Array.from(document.querySelectorAll('.dice-arena button'))
      return {
        cortados: btns.filter((b) => b.scrollWidth > b.clientWidth + 2).map((b) => (b.textContent ?? '').trim().slice(0, 20)),
        baixos: btns.filter((b) => b.getBoundingClientRect().height < 44).length,
        estoura: zona.bottom > frame.bottom + 1,
        quantos: btns.length,
      }
    })
    expect(z.quantos, 'cenário não montou a zona de ação').toBeGreaterThan(0)
    expect(z.cortados, 'rótulo de ação cortado').toEqual([])
    expect(z.baixos, 'ação abaixo do alvo de toque').toBe(0)
    expect(z.estoura, 'a zona de ação passou do tabuleiro').toBe(false)
  })
}

test('retrato: a linha do Bus Ticket vira lista tocável', async ({ page }) => {
  // Lado a lado, 11 paradas davam 24px cada e o nome saía "Ve n..", "Ac a..".
  await page.setViewportSize(PHONE_SMALL_PORTRAIT)
  await page.goto('/play?players=2&scenario=acoes&modo=bus')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /usar bus ticket/i }).first().click()
  await page.waitForTimeout(700)

  const bus = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.bus-stop-card')).map((el) => el.getBoundingClientRect())
    const shell = document.querySelector('.bus-picker-modal')!.getBoundingClientRect()
    return {
      paradas: cards.length,
      alturaMin: Math.min(...cards.map((c) => c.height)),
      larguraMin: Math.min(...cards.map((c) => c.width)),
      nomesCortados: Array.from(document.querySelectorAll('.bus-stop-card__name'))
        .filter((n) => n.scrollWidth > n.clientWidth + 2).length,
      fora: shell.right > document.documentElement.clientWidth + 1 || shell.bottom > window.innerHeight + 1,
      instrucao: (document.querySelector('.bus-picker-body p')?.textContent ?? '').trim(),
    }
  })
  expect(bus.paradas, 'seletor de parada não abriu').toBeGreaterThan(1)
  expect(Math.round(bus.alturaMin), 'parada abaixo do alvo de toque').toBeGreaterThanOrEqual(44)
  expect(Math.round(bus.larguraMin), 'a lista voltou a ser uma linha de colunas estreitas').toBeGreaterThanOrEqual(200)
  expect(bus.nomesCortados, 'nome de parada truncado').toBe(0)
  expect(bus.fora, 'o seletor saiu da tela').toBe(false)
  // No dedo não há cursor para "passar pela linha".
  expect(bus.instrucao, 'instrução ainda descreve um gesto de mouse').toMatch(/toque/i)
})

test('retrato: abrir o convite na home não estoura a largura', async ({ page }) => {
  // Coluna de grade com `min-width: auto` recusa encolher abaixo do conteúdo: com o campo
  // de convite aberto o painel pedia 337px e vazava numa tela de 320.
  await page.setViewportSize(PHONE_SMALL_PORTRAIT)
  for (const rota of ['/play', '/play?map=fuligem']) {
    await page.goto(rota)
    await page.waitForTimeout(700)
    await page.locator('.home-map-panel__invite').click()
    await page.waitForTimeout(500)
    const fora = await page.evaluate(() => {
      const de = document.documentElement
      return Array.from(document.querySelectorAll('.home-map-panel *')).filter((el) => {
        const b = el.getBoundingClientRect()
        if (b.width === 0 || el.closest('[aria-hidden="true"]') || el.tagName === 'svg' || el.closest('svg')) return false
        return b.right > de.clientWidth + 2
      }).length
    })
    expect(fora, `${rota}: o painel do convite vaza para fora da tela`).toBe(0)
    await expectNoHorizontalScroll(page, `convite aberto em ${rota}`)
  }
})

test('retrato: no fim de jogo o rótulo não encosta no valor', async ({ page }) => {
  // `endgame-wealth` ficou fora do grupo que dá `gap`, e o `::before` colava no número:
  // saía "PATRIMÔNIOR$ 3.510".
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/play?players=2&scenario=endgame')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /falir|declarar/i }).first().click()
  await page.waitForTimeout(900)

  const gap = await page.evaluate(() => {
    const el = document.querySelector('.endgame-wealth')
    if (!el) return null
    const s = getComputedStyle(el)
    return { gap: parseFloat(s.columnGap || '0'), display: s.display }
  })
  expect(gap, 'a classificação final não renderizou').not.toBeNull()
  expect(gap!.gap, 'rótulo e valor do patrimônio voltaram a se encostar').toBeGreaterThan(2)
  await expectNoHorizontalScroll(page, 'fim de jogo em retrato')
})

test('retrato: o convite com QR não estoura o modal no menor telefone', async ({ page }) => {
  // A grade do convite tinha piso RÍGIDO de duas colunas (~386px de largura mínima)
  // inclusive no bloco "de celular" — não cabia em 390px e destruía 320px. Piso mínimo
  // não encolhe: transborda. O que se prova aqui é o empilhamento.
  await page.setViewportSize(PHONE_SMALL_PORTRAIT)
  await page.goto('/play')
  await page.waitForTimeout(400)

  const verdict = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.className = 'room-invite-dialog'
    probe.style.width = 'min(100%, 38rem)'
    probe.innerHTML = `
      <div class="room-invite-dialog__body">
        <figure class="room-invite-qr"><svg class="room-invite-qr__image" viewBox="0 0 33 33"></svg></figure>
        <div class="room-invite-dialog__actions">
          <div class="room-invite-dialog__link"><code>https://exemplo.invalido/play?room=8f3c1a7d-4b62-49e0-9a15-2c7e6b0d5f31</code></div>
        </div>
      </div>`
    document.body.appendChild(probe)
    const body = probe.querySelector('.room-invite-dialog__body')!
    const code = probe.querySelector('code')!
    const columns = getComputedStyle(body).gridTemplateColumns.trim().split(/\s+/).length
    const out = {
      columns,
      codeOverflows: code.getBoundingClientRect().right > probe.getBoundingClientRect().right + 1,
    }
    probe.remove()
    return out
  })

  expect(verdict.columns, 'convite continua em duas colunas no menor telefone').toBe(1)
  expect(verdict.codeOverflows, 'o link da sala vaza do cartão').toBe(false)
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

// Retrato entrou no caminho de jogo pela D-079, então entra no mesmo gate: uma orientação
// servida sem auditoria é a orientação anterior de novo, só que sem o aviso.
test('sem violação serious/critical no caminho de jogo em retrato de celular', async ({ page }) => {
  await page.setViewportSize(PHONE_SMALL_PORTRAIT)
  await page.goto('/play?players=2')
  await page.waitForSelector('.board-stage')
  await page.waitForTimeout(700)
  await expectNoBlockingA11yViolations(page, 'partida 320×568 em retrato')

  // A aba fechada não pode deixar conteúdo órfão para o leitor de tela — é a razão de o
  // painel escondido usar `hidden` em vez de sumir só na pintura.
  await page.getByRole('tab', { name: 'Ações' }).click()
  await page.waitForTimeout(400)
  await expectNoBlockingA11yViolations(page, 'partida 320×568, aba Ações')
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
