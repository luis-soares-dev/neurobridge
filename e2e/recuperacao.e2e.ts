// Regressões da revisão do PR #3: retomada no intervalo final, saída sem cópia recuperável,
// fila cheia e registros guardados ilegíveis.
import { expect, test, type Page } from '@playwright/test'
import { autoPlay, chooseLevel, mockSupabase, signIn, USER_ID } from './fixtures'

/** Executa o script uma única vez por aba (não repete em recarregamentos). */
async function once(page: Page, name: string, fn: (arg: { userId: string; now: number }) => void) {
  await page.addInitScript(({ name, src, userId }) => {
    if (sessionStorage.getItem(name)) return
    sessionStorage.setItem(name, '1')
    new Function('arg', `(${src})(arg)`)({ userId, now: Date.now() })
  }, { name, src: fn.toString(), userId: USER_ID })
}

async function playLevel10(page: Page) {
  await page.goto('/jogar/vigia')
  await chooseLevel(page, 10)
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await autoPlay(page)
}

test('pausa no intervalo depois do último círculo: a partida termina e é salva com tempo ativo válido', async ({ page }) => {
  const supa = await mockSupabase(page)
  await signIn(page)
  await page.goto('/jogar/vigia')
  await chooseLevel(page, 10)
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await autoPlay(page)
  // Assim que o 30º círculo é concluído (intervalo final), pausa e continua.
  await page.evaluate(() => {
    const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }))
    const obs = new MutationObserver(() => {
      if (!/\b30 de 30\b/.test(document.body.innerText)) return
      obs.disconnect()
      press('Escape')
      setTimeout(() => press('Escape'), 400)
    })
    obs.observe(document.body, { childList: true, subtree: true, characterData: true })
  })
  await expect(page.getByRole('heading', { name: 'Partida pausada' })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('✓ Salvo na sua conta')).toBeVisible({ timeout: 30_000 })
  const body = supa.saveBodies[0]
  expect(body.p_trials as unknown[]).toHaveLength(30)
  expect(body.p_duration_ms as number).toBeGreaterThanOrEqual(20_250)
})

test('sem cópia neste aparelho e sem rede: sair, voltar e fechar pedem confirmação', async ({ page }) => {
  await mockSupabase(page, { save: { kind: 'network' } })
  await signIn(page)
  // Armazenamento bloqueado só para as pendências (o resto do app funciona).
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k.includes(':pending')) throw new DOMException('cheio', 'QuotaExceededError')
      return original.call(this, k, v)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Jogar Vigia' }).click()
  await chooseLevel(page, 10)
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await autoPlay(page)
  await expect(page.getByText('Este aparelho não permitiu guardar a partida')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('button', { name: 'Jogar de novo' })).toBeDisabled()

  await page.getByRole('button', { name: 'Sair sem salvar' }).click()
  await expect(page.getByRole('heading', { name: 'Sair sem salvar o resultado?' })).toBeVisible()
  await page.getByRole('button', { name: 'Ficar e tentar enviar' }).click()
  await expect(page.getByText('Pontuação da partida')).toBeVisible()

  await page.evaluate(() => history.back())
  await expect(page.getByRole('heading', { name: 'Sair sem salvar o resultado?' })).toBeVisible()
  await page.getByRole('button', { name: 'Ficar e tentar enviar' }).click()

  const dialog = page.waitForEvent('dialog')
  void page.close({ runBeforeUnload: true })
  const d = await dialog
  expect(d.type()).toBe('beforeunload')
  await d.dismiss()
})

test('fila cheia: a nova partida não apaga nenhuma guardada e a saída é protegida', async ({ page }) => {
  await mockSupabase(page, { save: { kind: 'network' } })
  await signIn(page)
  await once(page, 'seed-full', ({ userId, now }) => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      v: 1, gameId: 'vigia', sessionId: `antiga-${i}`, createdAt: now - 60_000 + i,
      summary: { difficulty: 3, score: 0.5 }, payload: { sessionId: `antiga-${i}` },
    }))
    localStorage.setItem(`neurobridge:${userId}:pending`, JSON.stringify(items))
  })
  await playLevel10(page)
  await expect(page.getByText(/Já há 10 partidas aguardando envio/)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('button', { name: 'Sair sem salvar' })).toBeVisible()
  const ids = await page.evaluate(id => JSON.parse(localStorage.getItem(`neurobridge:${id}:pending`)!).map((x: { sessionId: string }) => x.sessionId), USER_ID)
  expect(ids).toEqual(Array.from({ length: 10 }, (_, i) => `antiga-${i}`))
})

test('registro guardado ilegível não derruba o Dashboard e pode ser limpo', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  await once(page, 'seed-invalid', ({ userId, now }) => {
    localStorage.setItem(`neurobridge:${userId}:pending`, JSON.stringify([
      { sessionId: 'quebrado', createdAt: now },
      { v: 1, gameId: 'vigia', sessionId: 'ok', createdAt: now, summary: { difficulty: 4, score: 0.6 }, payload: { sessionId: 'ok' } },
    ]))
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Olá/ })).toBeVisible()
  await expect(page.getByText(/Há 1 partida guardada/)).toBeVisible()
  await expect(page.getByText(/Um registro guardado neste aparelho não pôde ser lido/)).toBeVisible()
  await page.getByRole('button', { name: 'Limpar registros ilegíveis' }).click()
  await expect(page.getByText(/não pôde ser lido/)).toHaveCount(0)
  await expect(page.getByText(/Há 1 partida guardada/)).toBeVisible()
})
