// Gate focado da coreografia real dos dados. Os smokes longos usam reduced-motion para
// não transformar 110 rolagens em minutos de espera, então esta spec preserva a prova de
// que o caminho normal mantém o comando bloqueado enquanto o dado está no ar.
import { expect, test } from '@playwright/test'
import { trackRuntimeErrors } from './script'

test.use({ contextOptions: { reducedMotion: 'no-preference' } })

test('rolagem normal mantém o comando bloqueado durante a coreografia', async ({ page }) => {
  const errors = trackRuntimeErrors(page)
  await page.goto('/play?players=2')

  // Espera o TABULEIRO antes do botão, com o mesmo teto de 20s dos smokes. Sem isto o gate
  // media o tempo de boot do servidor e do bundle no lugar da coreografia: passa na máquina
  // com o dev server quente e reprova no runner frio, que foi o que aconteceu.
  await expect(page.locator('.board-stage')).toBeVisible({ timeout: 20_000 })

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
