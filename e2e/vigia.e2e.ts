// Percursos do Vigia: teclado, pausa, salvamento, recuperação e navegação.
import { expect, test } from '@playwright/test'
import { autoPlay, chooseLevel, mockSupabase, signIn, USER_ID } from './fixtures'

const focusedText = (page: import('@playwright/test').Page) =>
  page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.textContent?.trim().slice(0, 40)}`)

test('tutorial completo só com teclado, sem enviar nada ao servidor', async ({ page }) => {
  const supa = await mockSupabase(page)
  await signIn(page, { tutorialDone: false })
  await page.goto('/jogar/vigia')
  await expect(page.getByRole('heading', { name: /1 de 3/ })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByText('Isso! Você respondeu ao azul.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Próximo' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Muito bem, você esperou.')).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('Enter')
  // Treino: responde só aos azuis, pelo teclado.
  await expect(page.getByRole('heading', { name: /3 de 3/ })).toBeVisible()
  for (let i = 0; i < 6; i++) {
    const stim = page.locator('.arena-stage [role="img"]')
    await expect(stim).toBeVisible({ timeout: 5000 })
    if ((await stim.getAttribute('aria-label')) === 'Círculo azul') await page.keyboard.press('Space')
    await expect(stim).toBeHidden({ timeout: 5000 })
  }
  await expect(page.getByText('você acertou 6 de 6')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('heading', { name: 'Pronto!' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Ir para o jogo' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Vigia' })).toBeFocused()
  expect(supa.saveBodies).toHaveLength(0)
  // Tutorial visto não aparece de novo.
  await page.reload()
  await expect(page.getByRole('button', { name: /Começar nível/ })).toBeVisible()
})

test('partida com teclado: pausa preserva a contagem e envia só o tempo ativo', async ({ page }) => {
  const supa = await mockSupabase(page)
  await signIn(page)
  await page.goto('/jogar/vigia')
  await chooseLevel(page, 10)
  await page.getByRole('button', { name: /Começar nível/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.arena')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.respond-btn')).toBeFocused()
  await autoPlay(page)
  const started = Date.now()
  await expect(page.getByText(/^5 de 30$/)).toBeVisible({ timeout: 15_000 })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Partida pausada' })).toBeFocused()
  const pausedAt = await page.getByText(/de 30/).count() // tela de pausa não mostra contagem
  expect(pausedAt).toBe(0)
  await page.waitForTimeout(2500)
  await page.keyboard.press('Escape')
  await expect(page.getByText('Pontuação da partida')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('✓ Salvo na sua conta')).toBeVisible()
  const total = Date.now() - started
  const body = supa.saveBodies[0]
  const trials = body.p_trials as { isTarget: boolean; responded: boolean; isCorrect: boolean }[]
  expect(trials).toHaveLength(30)
  expect(trials.filter(t => t.isTarget)).toHaveLength(8)
  // Tempo ativo: ao menos 90% do mínimo do nível 10 e menos que o tempo total com pausa e contagens.
  expect(body.p_duration_ms as number).toBeGreaterThanOrEqual(20_250)
  expect(body.p_duration_ms as number).toBeLessThan(total - 2500)
  expect(await focusedText(page)).toMatch(/^H2 /)
})

test('sem conexão: a partida fica guardada e o Dashboard envia depois', async ({ page }) => {
  const supa = await mockSupabase(page, { save: { kind: 'network' } })
  await signIn(page)
  await page.goto('/jogar/vigia')
  await chooseLevel(page, 10)
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await autoPlay(page)
  await expect(page.getByText(/Sem conexão com o servidor/)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('Guardado neste aparelho')).toBeVisible()
  // Recarregar não perde a partida.
  await page.goto('/')
  await expect(page.getByText(/Há 1 partida guardada/)).toBeVisible()
  supa.save = { kind: 'ok' }
  await page.getByRole('button', { name: 'Enviar agora' }).click()
  await expect(page.getByText(/Há 1 partida guardada/)).toBeHidden()
  const ids = supa.saveBodies.map(b => b.p_session_id)
  expect(new Set(ids).size).toBe(1) // reenvio com o mesmo ID
  expect(await page.evaluate(id => localStorage.getItem(`neurobridge:${id}:pending`), USER_ID)).toBeNull()
})

test('partida recusada pelo servidor oferece descartar, não reenviar', async ({ page }) => {
  await mockSupabase(page, { save: { kind: 'error', status: 400, body: { code: 'P0001', message: 'Respostas inválidas', details: null, hint: null } } })
  await signIn(page)
  await page.goto('/jogar/vigia')
  await chooseLevel(page, 10)
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await autoPlay(page)
  await expect(page.getByText(/não aceitou esta partida/)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('button', { name: 'Tentar enviar de novo' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Descartar esta partida' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(/partida guardada/)).toHaveCount(0)
})

test('sessão expirada pede para entrar novamente e mantém a partida guardada', async ({ page }) => {
  await mockSupabase(page, { save: { kind: 'error', status: 401, body: { code: 'PGRST301', message: 'JWT expired', details: null, hint: null } } })
  await signIn(page)
  await page.goto('/jogar/vigia')
  await chooseLevel(page, 10)
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await autoPlay(page)
  await expect(page.getByText(/Sua sessão expirou/)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('button', { name: 'Entrar novamente' })).toBeVisible()
  expect(await page.evaluate(id => localStorage.getItem(`neurobridge:${id}:pending`), USER_ID)).not.toBeNull()
})

test('voltar no meio da partida pede confirmação', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Jogar Vigia' }).click()
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await expect(page.locator('.arena')).toBeVisible({ timeout: 10_000 })
  await page.evaluate(() => history.back())
  await expect(page.getByRole('heading', { name: 'Sair da partida?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar jogando' }).click()
  await expect(page.getByRole('heading', { name: 'Partida pausada' })).toBeVisible()
  await expect(page).toHaveURL(/jogar\/vigia/)
  await page.evaluate(() => history.back())
  await page.getByRole('button', { name: 'Sair sem salvar' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Jogar Vigia' })).toBeVisible()
})

test('troca de aba pausa a partida', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  await page.goto('/jogar/vigia')
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await expect(page.locator('.arena')).toBeVisible({ timeout: 10_000 })
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByText('Pausamos porque a página ficou em segundo plano.')).toBeVisible()
})

test('troca de conta em outra aba não deixa dados nem partida da conta anterior na tela', async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
  await page.goto('/')
  await expect(page.getByText('120', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Jogar Vigia' }).click()
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await expect(page.locator('.arena')).toBeVisible({ timeout: 10_000 })
  // Outra aba entra com a conta B (mesmo canal que o supabase-js usa para sincronizar abas).
  await page.evaluate(() => {
    const now = Math.floor(Date.now() / 1000)
    const user = { id: '22222222-2222-4222-8222-222222222222', aud: 'authenticated', role: 'authenticated', email: 'bia@example.test', user_metadata: { full_name: 'Bia Conta' }, app_metadata: {}, created_at: new Date().toISOString() }
    const session = { access_token: 'e2e-token-b', refresh_token: 'e2e-refresh-b', token_type: 'bearer', expires_in: 86400, expires_at: now + 86400, user }
    localStorage.setItem('sb-127-auth-token', JSON.stringify(session))
    new BroadcastChannel('sb-127-auth-token').postMessage({ event: 'SIGNED_IN', session })
  })
  await expect(page.locator('.arena')).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Olá, Bia!/ })).toBeVisible()
  await expect(page.getByText('999', { exact: true })).toBeVisible()
  await expect(page.getByText('120', { exact: true })).toHaveCount(0)
})
