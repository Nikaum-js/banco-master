// Pregão simultâneo com até SEIS lotes (D-078) — na interface real, sobre o bundle.
//
// O cenário `?scenario=pregao&lots=N` DISPARA o gatilho da §7.5 (`maybeOpenLandAuction`) em
// vez de plantar um `landAuction` literal: se a regra quebrar, a tela não abre e estes testes
// falham, que é o comportamento útil de um andaime.
//
// O que se prova aqui e não dá para provar em jsdom: geometria. Alvo de toque medido em
// pixels de verdade, ausência de transbordo horizontal com a máscara de `overflow-x: hidden`
// neutralizada, e a ação principal alcançável dentro da viewport nos dois tamanhos mínimos
// oficiais de celular em paisagem.
import { test, expect, type Page, type Locator } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { trackRuntimeErrors } from './script'

const TOUCH_MIN = 44

const PHONE_LANDSCAPE = { width: 667, height: 375 }
const PLAY_MIN = { width: 740, height: 360 } // mínimo oficial
const TABLET_LANDSCAPE = { width: 1024, height: 768 }
const DESKTOP = { width: 1440, height: 900 }

const MOBILE_LANDSCAPE = [PHONE_LANDSCAPE, PLAY_MIN] as const

test.use({
  contextOptions: { reducedMotion: 'reduce' },
  hasTouch: true,
  isMobile: true,
})

/** Mesma medida do gate responsivo: transbordo REAL, não o que a máscara esconde. */
async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const result = await page.evaluate(() => {
    const style = document.createElement('style')
    style.textContent = 'html,body{overflow-x:visible !important}'
    document.head.appendChild(style)
    const de = document.documentElement
    void de.offsetWidth
    const root = { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth }
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
    `${label}: documento rola ${result.root.scrollWidth - result.root.clientWidth}px na horizontal`,
  ).toBeLessThanOrEqual(result.root.clientWidth + 1)
  expect(result.containers, `${label}: contêiner rolando na horizontal`).toEqual([])
}

/** Área clicável efetiva, incluindo o pseudo-elemento de `.hit-44`. */
async function hitSize(target: Locator): Promise<{ w: number; h: number }> {
  return target.evaluate((el) => {
    const box = el.getBoundingClientRect()
    const after = getComputedStyle(el, '::after')
    const w = parseFloat(after.inlineSize || after.width || '0')
    const h = parseFloat(after.blockSize || after.height || '0')
    const real = after.content !== 'none' && after.position === 'absolute'
    return { w: Math.max(box.width, real ? w : 0), h: Math.max(box.height, real ? h : 0) }
  })
}

async function abrirPregao(page: Page, lots: number, map?: string): Promise<void> {
  await page.goto(`/play?players=3&scenario=pregao&lots=${lots}${map ? `&map=${map}` : ''}`)
  await page.waitForSelector('[role="dialog"] .land-auction')
  await page.waitForTimeout(400)
}

// ---------------------------------------------------------------------------
// O gatilho, visto de fora
// ---------------------------------------------------------------------------

test('o pregão de escassez abre com seis lotes e todos aparecem', async ({ page }) => {
  const errors = trackRuntimeErrors(page)
  await page.setViewportSize(DESKTOP)
  await abrirPregao(page, 6)

  await expect(page.getByRole('heading', { name: 'Leilão de Escassez' })).toBeVisible()
  await expect(page.locator('.lot-card')).toHaveCount(6)
  await expect(page.getByRole('button', { name: /^Cobrir · / })).toHaveCount(6)

  expect(errors, 'pregão @ desktop: erros de runtime').toEqual([])
})

for (const lots of [1, 3, 6]) {
  test(`grade com ${lots} lote(s): sem transbordo em desktop e tablet`, async ({ page }) => {
    for (const size of [DESKTOP, TABLET_LANDSCAPE]) {
      await page.setViewportSize(size)
      await abrirPregao(page, lots)
      await expect(page.locator('.lot-card')).toHaveCount(lots)
      await expectNoHorizontalScroll(page, `${lots} lotes @ ${size.width}`)
    }
  })
}

test('colunas: até três no desktop, até duas no tablet', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await abrirPregao(page, 6)
  expect(await colunasDaGrade(page), 'desktop').toBe(3)

  await page.setViewportSize(TABLET_LANDSCAPE)
  await page.waitForTimeout(300)
  expect(await colunasDaGrade(page), 'tablet').toBe(2)
})

async function colunasDaGrade(page: Page): Promise<number> {
  return page.locator('.lot-grid').evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length,
  )
}

// ---------------------------------------------------------------------------
// Paisagem de celular — os dois tamanhos exigidos
// ---------------------------------------------------------------------------

for (const size of MOBILE_LANDSCAPE) {
  const at = `${size.width}×${size.height}`

  test(`${at}: seis lotes viram faixa de seleção, sem carrossel e sem rolagem horizontal`, async ({ page }) => {
    const errors = trackRuntimeErrors(page)
    await page.setViewportSize(size)
    await abrirPregao(page, 6)

    // Seis cartões completos empilhados é exatamente o que não pode existir.
    await expect(page.locator('.lot-card')).toHaveCount(0)
    await expect(page.getByRole('tab')).toHaveCount(6)
    await expect(page.getByRole('tabpanel')).toHaveCount(1)

    await expectNoHorizontalScroll(page, `pregão @ ${at}`)

    // A faixa CABE: nenhum chip fora da caixa do modal, e nada rolando por dentro dela.
    const faixa = page.getByRole('tablist')
    const geom = await faixa.evaluate((el) => ({
      over: el.scrollWidth - el.clientWidth,
      right: el.getBoundingClientRect().right,
      viewport: window.innerWidth,
    }))
    expect(geom.over, `${at}: faixa rolando na horizontal`).toBeLessThanOrEqual(1)
    expect(geom.right, `${at}: faixa fora da tela`).toBeLessThanOrEqual(geom.viewport + 1)

    expect(errors, `pregão @ ${at}: erros de runtime`).toEqual([])
  })

  test(`${at}: o estado dos outros lotes continua visível enquanto se decide um`, async ({ page }) => {
    await page.setViewportSize(size)
    await abrirPregao(page, 6)

    const chips = page.locator('.lot-chip')
    for (let i = 0; i < 6; i++) {
      const chip = chips.nth(i)
      await expect(chip).toBeInViewport()
      await expect(chip.locator('.lot-chip__name')).not.toBeEmpty()
      await expect(chip.locator('.lot-chip__secs')).not.toBeEmpty()
    }
  })

  test(`${at}: a ação principal de lance é alcançável e é alvo de toque`, async ({ page }) => {
    await page.setViewportSize(size)
    await abrirPregao(page, 6)

    const cobrir = page.getByRole('button', { name: /^Cobrir · / })
    await expect(cobrir).toBeVisible()
    await expect(cobrir).toBeInViewport()

    const box = (await cobrir.boundingBox())!
    expect(Math.round(box.height), `${at}: altura da ação principal`).toBeGreaterThanOrEqual(TOUCH_MIN)

    for (const nome of [/^Lance de R\$ \d+ em /]) {
      const inc = page.getByRole('button', { name: nome }).first()
      const hit = await hitSize(inc)
      expect(Math.round(hit.w), `${at}: largura do incremento`).toBeGreaterThanOrEqual(TOUCH_MIN)
      expect(Math.round(hit.h), `${at}: altura do incremento`).toBeGreaterThanOrEqual(TOUCH_MIN)
    }
  })

  test(`${at}: cada chip da faixa é um alvo de toque`, async ({ page }) => {
    await page.setViewportSize(size)
    await abrirPregao(page, 6)

    const chips = page.locator('.lot-chip')
    for (let i = 0; i < 6; i++) {
      const box = (await chips.nth(i).boundingBox())!
      expect(Math.round(box.height), `${at}: altura do chip ${i}`).toBeGreaterThanOrEqual(TOUCH_MIN)
      expect(Math.round(box.width), `${at}: largura do chip ${i}`).toBeGreaterThanOrEqual(TOUCH_MIN)
    }
  })

  test(`${at}: selecionar um lote troca o painel e mantém a faixa`, async ({ page }) => {
    await page.setViewportSize(size)
    await abrirPregao(page, 6)

    const chips = page.locator('.lot-chip')
    const nomeQuarto = (await chips.nth(3).locator('.lot-chip__name').textContent())!.trim()
    await chips.nth(3).click()

    await expect(chips.nth(3)).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab')).toHaveCount(6) // a faixa não sumiu
    const painel = page.getByRole('tabpanel')
    await expect(painel.locator('.lot-card__name')).toHaveText(new RegExp(nomeQuarto, 'i'))
  })

  test(`${at}: com um lote só, o painel ocupa a tela inteira e não há faixa`, async ({ page }) => {
    await page.setViewportSize(size)
    await abrirPregao(page, 1)

    await expect(page.getByRole('tablist')).toHaveCount(0)
    await expect(page.getByRole('tabpanel')).toHaveCount(1)
    await expect(page.getByRole('button', { name: /^Cobrir · / })).toBeInViewport()
    await expectNoHorizontalScroll(page, `1 lote @ ${at}`)
  })
}

// ---------------------------------------------------------------------------
// Teclado, foco e leitor de tela
// ---------------------------------------------------------------------------

test('teclado: o foco nasce dentro do pregão, fica preso nele e navega a faixa', async ({ page }) => {
  await page.setViewportSize(PHONE_LANDSCAPE)
  await abrirPregao(page, 6)

  // Foco inicial dentro do diálogo (o `Overlay` cuida disso para toda camada modal).
  const dentro = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')!
    return dialog.contains(document.activeElement)
  })
  expect(dentro, 'foco inicial fora do pregão').toBe(true)

  // Tab dá muitas voltas e NUNCA sai do diálogo (trap).
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    const preso = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')!
      return dialog.contains(document.activeElement)
    })
    expect(preso, `foco escapou do pregão na tabulação ${i}`).toBe(true)
  }

  // A faixa navega por setas, com foco rovente (um só ponto de tabulação).
  await page.getByRole('tab').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab').nth(1)).toBeFocused()

  await page.keyboard.press('End')
  await expect(page.getByRole('tab').nth(5)).toHaveAttribute('aria-selected', 'true')
})

test('o lance pode ser dado só pelo teclado', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await abrirPregao(page, 3)

  const alvo = page.getByRole('button', { name: /^Cobrir · / }).nth(2)
  const antes = (await alvo.textContent())!
  await alvo.focus()
  await expect(alvo).toBeFocused()
  await page.keyboard.press('Enter')

  // O lance entrou: o rótulo do botão sobe (o próximo mínimo é maior).
  await expect(alvo).not.toHaveText(antes)
})

test('leitor de tela: lote selecionado, estado, maior lance e encerramento', async ({ page }) => {
  await page.setViewportSize(PHONE_LANDSCAPE)
  await abrirPregao(page, 6)

  const chips = page.getByRole('tab')
  // O nome acessível carrega posição, identidade e estado — nunca só cor.
  await expect(chips.first()).toHaveAttribute('aria-label', /Lote 1 de 6, .+, (Sem lance|Lance de rival|Você lidera)/)
  const comLance = page.getByRole('tab', { name: /maior lance R\$/ })
  expect(await comLance.count(), 'nenhum lote anuncia o maior lance').toBeGreaterThan(0)

  // A contagem regressiva NÃO é anunciada: fora de qualquer região viva.
  const vivos = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.lot-clock__secs')).map((e) => e.getAttribute('aria-live')),
  )
  expect(vivos.every((v) => v === 'off'), 'o cronômetro entrou numa região viva').toBe(true)

  // O prazo continua alcançável sob demanda.
  await expect(page.getByRole('progressbar', { name: /Tempo restante do lote/ }).first()).toBeAttached()

  // O encerramento é anunciado, uma vez, em região polida (24s de janela). A página tem
  // outras regiões `status` (log central, avisos do HUD) — esta é a DO PREGÃO.
  const aviso = page.getByRole('dialog').getByRole('status')
  await expect(aviso).toHaveText('', { timeout: 2_000 })
  await expect(aviso).toHaveText(/fica livre|Arrematado/, { timeout: 30_000 })
})

test('movimento reduzido: a barra do cronômetro continua informando, sem interpolar', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await abrirPregao(page, 3)

  // `reducedMotion: reduce` está ligado no `test.use` deste arquivo: as durações do
  // vocabulário vão a zero, mas o FATO (a barra encolhendo) permanece.
  const zeradas = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement)
    return ['--motion-fast', '--motion-base', '--motion-slow'].map((v) => cs.getPropertyValue(v).trim())
  })
  // O navegador normaliza a duração computada, e nem sempre para a mesma unidade ('0s' no
  // Chromium, '0ms' como escrito). O que importa é o valor.
  expect(
    zeradas.every((v) => v === '0s' || v === '0ms'),
    `as durações não foram zeradas por prefers-reduced-motion: ${zeradas.join(', ')}`,
  ).toBe(true)

  const antes = await larguraDaBarra(page)
  await page.waitForTimeout(3_000)
  const depois = await larguraDaBarra(page)
  expect(depois, 'a barra parou de cair com movimento reduzido').toBeLessThan(antes)
})

async function larguraDaBarra(page: Page): Promise<number> {
  return page.locator('.lot-clock__fill').first().evaluate((el) => el.getBoundingClientRect().width)
}

test('axe não acha violação bloqueante no pregão, em nenhum dos tamanhos', async ({ page }) => {
  for (const size of [DESKTOP, TABLET_LANDSCAPE, PHONE_LANDSCAPE, PLAY_MIN]) {
    await page.setViewportSize(size)
    await abrirPregao(page, 6)
    const results = await new AxeBuilder({ page }).analyze()
    const bloqueantes = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(
      bloqueantes.map((v) => `${v.id} (${v.impact}) × ${v.nodes.length}`),
      `pregão @ ${size.width}×${size.height}: violações serious/critical`,
    ).toEqual([])
  }
})

// ---------------------------------------------------------------------------
// Os dois mapas
// ---------------------------------------------------------------------------

for (const map of ['atlas', 'fuligem'] as const) {
  test(`${map}: seis lotes com identidade do mapa, sem transbordo em nenhum tamanho`, async ({ page }) => {
    const errors = trackRuntimeErrors(page)
    for (const size of [DESKTOP, TABLET_LANDSCAPE, PHONE_LANDSCAPE, PLAY_MIN]) {
      await page.setViewportSize(size)
      await abrirPregao(page, 6, map)

      const nomes = await page.locator('.lot-card__name').allTextContents()
      expect(nomes.length, `${map} @ ${size.width}: lotes na tela`).toBeGreaterThan(0)
      expect(nomes.every((n) => n.trim().length > 0), `${map} @ ${size.width}: lote sem nome`).toBe(true)

      await expectNoHorizontalScroll(page, `${map} @ ${size.width}`)
    }
    expect(errors, `${map}: erros de runtime`).toEqual([])
  })
}

// ---------------------------------------------------------------------------
// O CRONÔMETRO (058/US7)
//
// Relato da jogatina: "o cronômetro pareceu crescer conforme as pessoas davam lances e
// chegou a exibir uns 30 segundos". A janela do SRS §7.3 é de 24s por lote.
//
// A causa era `lot.deadline` (epoch do HOST) menos o `Date.now()` LOCAL, sem corrigir o
// deslocamento de relógio — apesar de o comentário de topo do `LandAuctionLayer` afirmar,
// desde a 031, que corrigia. Aqui a prova é pela INTERFACE, com o relógio do navegador
// deslocado de verdade.
//
// O soft-close continua: um lance válido reinicia AQUELE lote em 24s. É regra (§7.3), e
// nenhum teste abaixo a contraria.
// ---------------------------------------------------------------------------

const JANELA_SEGUNDOS = 24

async function segundosNaTela(page: Page): Promise<number[]> {
  const textos = await page.locator('.lot-clock__secs').allTextContents()
  return textos.map((t) => Number.parseInt(t.replace(/\D+/g, ''), 10)).filter((n) => Number.isFinite(n))
}

for (const skewSegundos of [0, 6, 45]) {
  test(`cronômetro: com o relógio do cliente ${skewSegundos}s atrás do host, nada passa de ${JANELA_SEGUNDOS}s`, async ({ page }) => {
    // Atrasa o relógio DO NAVEGADOR antes de qualquer script do app rodar. O `deadline`
    // dos lotes é gravado pelo cenário com o `Date.now()` já deslocado, então o cliente
    // fica exatamente na situação relatada: prazo do host à frente do relógio local.
    await page.addInitScript((skew) => {
      const real = Date.now
      Date.now = () => real() - skew * 1000
    }, skewSegundos)

    await page.setViewportSize(DESKTOP)
    await abrirPregao(page, 6)

    const segundos = await segundosNaTela(page)
    expect(segundos.length, 'cronômetros na tela').toBeGreaterThan(0)
    for (const s of segundos) {
      expect(s, `segundos exibidos com skew de ${skewSegundos}s`).toBeLessThanOrEqual(JANELA_SEGUNDOS)
      expect(s, 'cronômetro negativo').toBeGreaterThanOrEqual(0)
    }
  })
}

test('cronômetro: decorre para baixo e nunca retrocede', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await abrirPregao(page, 6)

  const primeira = await segundosNaTela(page)
  await page.waitForTimeout(2_600)
  const segunda = await segundosNaTela(page)

  expect(segunda.length).toBe(primeira.length)
  for (let i = 0; i < primeira.length; i++) {
    expect(segunda[i], `lote ${i}: cronômetro voltou no tempo`).toBeLessThanOrEqual(primeira[i])
    expect(segunda[i], `lote ${i}: cronômetro negativo`).toBeGreaterThanOrEqual(0)
  }
  // Andou de verdade — um cronômetro travado passaria no teste acima.
  expect(segunda.some((s, i) => s < primeira[i]), 'nenhum cronômetro andou').toBe(true)
})

test('soft-close: um lance válido reinicia SÓ o lote dele, e sem passar da janela', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await abrirPregao(page, 6)

  // Deixa o tempo correr para a diferença ser mensurável.
  await page.waitForTimeout(3_200)
  const antes = await segundosNaTela(page)

  // Cobre o primeiro lote — o botão principal do primeiro cartão.
  await page.locator('.lot-card .lot-actions__primary').first().click()
  await page.waitForTimeout(500)

  const depois = await segundosNaTela(page)
  expect(depois[0], 'o lote que recebeu o lance voltou à janela').toBeGreaterThan(antes[0])
  expect(depois[0], 'e não passou dela').toBeLessThanOrEqual(JANELA_SEGUNDOS)
  for (let i = 1; i < antes.length; i++) {
    expect(depois[i], `lote ${i} NÃO podia ter sido reiniciado`).toBeLessThanOrEqual(antes[i])
  }
})

// ---------------------------------------------------------------------------
// BANDEIRAS DO LOTE (058/US6)
//
// `CountryFlagDisc` ampliava o SVG a 1,5× e contava com `overflow: hidden`. Item de grade
// MAIOR que a área não fica centrado por `place-items: center`: a borda inicial é ancorada
// e o excesso sai por um lado só. Medido num disco de 30px: 2px cortados à esquerda contra
// 17px à direita — a Itália aparecia sem a faixa vermelha inteira.
// ---------------------------------------------------------------------------

test('bandeiras do pregão cabem no disco, sem corte assimétrico', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await abrirPregao(page, 6)

  const cortes = await page.evaluate(() => {
    const fora: { code: string | null; esquerda: number; direita: number }[] = []
    for (const svg of Array.from(document.querySelectorAll('.lot-card__head svg[viewBox="0 0 60 40"]'))) {
      const host = svg.parentElement!
      const h = host.getBoundingClientRect()
      const s = svg.getBoundingClientRect()
      // Tolerância de 3px cobre a borda de 2px do disco e o arredondamento.
      const esquerda = h.x - s.x
      const direita = (s.x + s.width) - (h.x + h.width)
      if (esquerda > 3 || direita > 3) fora.push({ code: svg.getAttribute('aria-label'), esquerda, direita })
    }
    return fora
  })
  expect(cortes, 'bandeira transbordando o disco').toEqual([])
})
