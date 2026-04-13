import { expect, test, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const AVATARS = [
  ['Clássico Vivo', 'classic-alive'],
  ['Olhos Orbitais', 'orbital-eyes'],
  ['Linha Única', 'single-line'],
  ['Prisma', 'prism-face'],
  ['Robô', 'totem-face'],
] as const

const SKINS = [
  ['Careca', 'careca'],
  ['Cavanhaque', 'cavanhaque'],
  ['Topete', 'topete'],
  ['Cartola', 'cartola'],
  ['Safári', 'safari'],
  ['Aviador', 'aviador'],
  ['Astronauta', 'astronauta'],
] as const

async function expectNoBlockingA11y(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(
    violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => `${violation.impact} ${violation.id}: ${violation.help}`),
  ).toEqual([])
}

async function openIdentity(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/play?host=1')
  await expect(page.getByLabel('Seu nome')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Escolher avatar / })).toHaveCount(5)
  await expect(page.getByRole('button', { name: /^Escolher skin / })).toHaveCount(7)
}

async function choose(
  page: Page,
  avatar: (typeof AVATARS)[number],
  skin: (typeof SKINS)[number],
): Promise<void> {
  await page.getByRole('button', { name: `Escolher avatar ${avatar[0]}` }).click()
  await page.getByRole('button', { name: `Escolher skin ${skin[0]}` }).click()
  const preview = page.getByRole('img', { name: `Avatar ${avatar[0]} com skin ${skin[0]}` })
  await expect(preview).toHaveAttribute('data-avatar', avatar[1])
  await expect(preview).toHaveAttribute('data-skin', skin[1])
  await expect(preview.locator(`svg[data-avatar="${avatar[1]}"][data-skin="${skin[1]}"]`)).toBeVisible()
}

test('as trinta e cinco combinações renderizam no menu e o layout desktop permanece íntegro', async ({ page }, testInfo: TestInfo) => {
  await page.setViewportSize({ width: 1440, height: 820 })
  await openIdentity(page)

  for (const avatar of AVATARS) {
    for (const skin of SKINS) await choose(page, avatar, skin)
  }

  await choose(page, AVATARS[4], SKINS[5])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await expectNoBlockingA11y(page)
  await page.screenshot({ path: testInfo.outputPath('avatar-skins-desktop.png'), fullPage: true })
})

test('o seletor inteiro permanece legível e sem rolagem em 390px', async ({ page }, testInfo: TestInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openIdentity(page)
  await choose(page, AVATARS[1], SKINS[6])

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await expectNoBlockingA11y(page)
  await page.screenshot({ path: testInfo.outputPath('avatar-skins-mobile.png'), fullPage: true })

  const submit = page.getByRole('button', { name: 'Criar sala' })
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeInViewport()
  expect(await page.locator('div.overflow-y-auto.overscroll-contain').evaluate((stage) => stage.scrollTop)).toBe(0)
  await page.screenshot({ path: testInfo.outputPath('avatar-skins-mobile-controls.png') })
})

test('a identidade composta chega aos tokens reais do tabuleiro', async ({ page }, testInfo: TestInfo) => {
  await page.setViewportSize({ width: 1440, height: 820 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/play?players=2&scenario=avatar-skin')
  await expect(page.locator('.board-stage')).toBeVisible()

  await expect(page.locator('.board-live-token [data-avatar="prism-face"][data-skin="cartola"]')).toBeVisible()
  await expect(page.locator('.board-live-token [data-avatar="totem-face"][data-skin="astronauta"]')).toBeVisible()
  await expect(page.getByText('Cartola').first()).toBeVisible()
  await expect(page.getByText('Astronauta').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('avatar-skins-board.png'), fullPage: true })
})
