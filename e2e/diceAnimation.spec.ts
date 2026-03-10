// Gate focado da coreografia real dos dados. Os smokes longos usam reduced-motion para
// não transformar 110 rolagens em minutos de espera, então esta spec preserva a prova de
// que o caminho normal mantém o comando bloqueado enquanto o dado está no ar.
import { expect, test } from '@playwright/test'
import { trackRuntimeErrors } from './script'

test.use({ contextOptions: { reducedMotion: 'no-preference' } })

test('rolagem normal mantém o comando bloqueado durante a coreografia', async ({ page }) => {
  const errors = trackRuntimeErrors(page)
  await page.goto('/play?players=2')

  const roll = page.getByRole('button', { name: 'Rolar dados' })
  await expect(roll).toBeVisible()
  await roll.click()

  const rolling = page.getByRole('button', { name: 'Rolando…' })
  await expect(rolling).toBeDisabled()
  await page.waitForTimeout(500)
  await expect(rolling).toBeDisabled()
  await expect(rolling).toBeHidden({ timeout: 2_000 })

  expect(errors, `erros de runtime: ${JSON.stringify(errors)}`).toEqual([])
})
