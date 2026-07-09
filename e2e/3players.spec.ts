// Smoke E2E — 3 jogadores (036/US3/FR-010).
import { test, expect } from '@playwright/test'
import { trackRuntimeErrors, driveTurns } from './script'

const PLAYER_COUNT = 3
const MIN_ROUNDS = 10

test('partida de 3 jogadores roda 10+ rodadas sem erro de runtime', async ({ page }) => {
  const errors = trackRuntimeErrors(page)
  await page.goto(`/?players=${PLAYER_COUNT}`)

  await expect(page.locator('.board-stage')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rolar dados' })).toBeVisible()

  await driveTurns(page, MIN_ROUNDS * PLAYER_COUNT)

  expect(errors, `erros de runtime: ${JSON.stringify(errors)}`).toEqual([])
})
