// Regressões dos achados do Codex no PR #3 (revisão do commit f608363).
import { expect, test, type Page } from '@playwright/test'
import { chooseLevel, mockSupabase, signIn } from './fixtures'

const completed = (page: Page) => page.evaluate(() => Number((document.body.innerText.match(/(\d+) de 30/) ?? [])[1] ?? -1))

test('Esc com a confirmação de saída aberta não retoma a partida por trás do diálogo', async ({ page }) => {
  const supa = await mockSupabase(page)
  await signIn(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Jogar Vigia' }).click()
  await chooseLevel(page, 10)
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await expect(page.locator('.arena-stage [role="img"]')).toBeVisible({ timeout: 10_000 })
  await page.evaluate(() => history.back())
  await expect(page.getByRole('heading', { name: 'Sair da partida?' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(5000) // contagem (3 s) + várias tentativas, se a partida tivesse voltado a correr
  await expect(page.getByRole('heading', { name: 'Sair da partida?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar jogando' }).click()
  // A partida continua exatamente onde estava: pausada, sem tentativas registradas no escuro.
  await expect(page.getByRole('heading', { name: 'Partida pausada' })).toBeVisible()
  expect(supa.saveBodies).toHaveLength(0)
})

test('manter o botão Responder pressionado por mais de 1 s conta uma única resposta', async ({ page }) => {
  const supa = await mockSupabase(page)
  await signIn(page)
  await page.goto('/jogar/vigia')
  await chooseLevel(page, 10)
  await page.getByRole('button', { name: /Começar nível/ }).click()
  const stim = page.locator('.arena-stage [role="img"]')
  // Pressiona durante o 2º círculo...
  await expect(page.getByText(/^1 de 30$/)).toBeVisible({ timeout: 10_000 })
  await expect(stim).toBeVisible()
  await page.waitForTimeout(100)
  const pressedAt = await completed(page)
  const box = (await page.locator('.respond-btn').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  // ...e solta mais de 1 s depois, com OUTRO círculo na tela.
  await page.waitForTimeout(1100)
  await page.waitForFunction(n => {
    const c = Number((document.body.innerText.match(/(\d+) de 30/) ?? [])[1] ?? -1)
    return c > n && !!document.querySelector('.arena-stage [role="img"]')
  }, pressedAt, { timeout: 5000 })
  await page.waitForTimeout(100)
  await page.mouse.up()
  await expect(page.getByText('✓ Salvo na sua conta')).toBeVisible({ timeout: 60_000 })
  const trials = supa.saveBodies[0].p_trials as { responded: boolean }[]
  expect(trials.filter(t => t.responded)).toHaveLength(1)
})
