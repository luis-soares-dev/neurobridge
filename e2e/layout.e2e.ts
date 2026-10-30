// Matriz de telas: cada tela do percurso é medida em todos os tamanhos de VIEWPORTS.
import { expect, test } from '@playwright/test'
import { expectCleanLayout, expectFullyInViewport, measureLayout, mockSupabase, playToResults, signIn, chooseLevel, VIEWPORTS, autoPlay } from './fixtures'

async function eachViewport(page: import('@playwright/test').Page, check: (where: string) => Promise<void>) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.waitForTimeout(60)
    await check(vp.name)
  }
}

test('login', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible()
  await eachViewport(page, async where => expectCleanLayout(await measureLayout(page), `login · ${where}`))
})

test('dashboard', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Jogar Vigia' })).toBeVisible()
  await eachViewport(page, async where => expectCleanLayout(await measureLayout(page), `dashboard · ${where}`))
})

test('tutorial', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page, { tutorialDone: false, sound: null })
  await page.goto('/jogar/vigia')
  await expect(page.getByText('Como jogar o Vigia')).toBeVisible()
  await eachViewport(page, async where => {
    expectCleanLayout(await measureLayout(page), `tutorial · ${where}`)
  })
})

test('instruções no nível 10 (mais cores de exemplo)', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page, { sound: null })
  await page.goto('/jogar/vigia')
  await chooseLevel(page, 10)
  await eachViewport(page, async where => expectCleanLayout(await measureLayout(page), `instruções · ${where}`))
  // Em celular deitado e janelas largas, o botão de começar aparece sem rolar.
  for (const vp of VIEWPORTS.filter(v => v.width >= 640 && v.width > v.height && v.height >= 360)) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.waitForTimeout(60)
    await expectFullyInViewport(page, 'button:has-text("Começar nível")', `instruções · ${vp.name}`)
  }
})

test('arena e pausa durante a partida', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  await page.goto('/jogar/vigia')
  await chooseLevel(page, 1) // nível mais lento: mais tempo para medir
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await expect(page.locator('.arena')).toBeVisible({ timeout: 10_000 })
  await eachViewport(page, async where => {
    expectCleanLayout(await measureLayout(page), `arena · ${where}`)
    // Durante o jogo, o círculo e o botão de responder ficam inteiros na tela, sem rolar.
    await expectFullyInViewport(page, '.arena-stage', `arena · ${where}`)
    await expectFullyInViewport(page, '.respond-btn', `arena · ${where}`)
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Partida pausada' })).toBeVisible()
  await eachViewport(page, async where => expectCleanLayout(await measureLayout(page), `pausa · ${where}`))
})

test('resultados', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  await page.goto('/jogar/vigia')
  await playToResults(page)
  await expect(page.getByText('✓ Salvo na sua conta')).toBeVisible()
  await eachViewport(page, async where => expectCleanLayout(await measureLayout(page), `resultados · ${where}`))
})

test('resultados com erro de salvamento', async ({ page }) => {
  await mockSupabase(page, { save: { kind: 'network' } })
  await signIn(page)
  await page.goto('/jogar/vigia')
  await chooseLevel(page, 10)
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await autoPlay(page)
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 90_000 })
  await eachViewport(page, async where => expectCleanLayout(await measureLayout(page), `resultados com erro · ${where}`))
})
