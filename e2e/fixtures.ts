// Apoio aos testes E2E: sessão de teste, Supabase simulado e medições de layout.
import { expect, type Page, type Route } from '@playwright/test'

export const SUPABASE = 'http://127.0.0.1:54399'
export const USER_ID = '11111111-1111-4111-8111-111111111111'

export const VIEWPORTS = [
  { name: 'celular 320', width: 320, height: 568 },
  { name: 'celular 360', width: 360, height: 640 },
  { name: 'celular 375', width: 375, height: 667 },
  { name: 'celular 390', width: 390, height: 844 },
  { name: 'tablet retrato', width: 768, height: 1024 },
  { name: 'tablet paisagem', width: 1024, height: 768 },
  { name: 'notebook', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'celular deitado 667', width: 667, height: 375 },
  { name: 'celular deitado 844', width: 844, height: 390 },
  // Zoom do navegador reduz a área em pixels CSS: 1280×720 a 200% e 1280×1024 a 400%.
  { name: 'zoom 200%', width: 640, height: 360 },
  { name: 'zoom 400% (reflow)', width: 320, height: 256 },
]

export type SaveBehavior =
  | { kind: 'ok' }
  | { kind: 'network' }
  | { kind: 'error'; status: number; body: Record<string, unknown> }

/** Simula o Supabase. `save` pode ser trocado durante o teste. */
export async function mockSupabase(page: Page, opts: { save?: SaveBehavior; xp?: number } = {}) {
  const state = { save: opts.save ?? { kind: 'ok' } as SaveBehavior, saveBodies: [] as Record<string, unknown>[] }
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route(`${SUPABASE}/**`, async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/auth/v1/user') return json(route, 200, { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'teste@example.test', user_metadata: { full_name: 'Teste E2E' } })
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 })
    if (url.pathname === '/rest/v1/profiles') {
      // A segunda conta dos testes de troca usa outro token e tem outro XP.
      const isB = (route.request().headers()['authorization'] ?? '').includes('token-b')
      return json(route, 200, { xp_total: isB ? 999 : opts.xp ?? 120 })
    }
    if (url.pathname === '/rest/v1/progress') return json(route, 200, [])
    if (url.pathname === '/rest/v1/sessions') return json(route, 200, [])
    if (url.pathname === '/rest/v1/rpc/save_vigia_session') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      state.saveBodies.push(body)
      const b = state.save
      if (b.kind === 'network') return route.abort('internetdisconnected')
      if (b.kind === 'error') return json(route, b.status, b.body)
      const trials = body.p_trials as { isTarget: boolean; responded: boolean }[]
      const hits = trials.filter(t => t.isTarget && t.responded).length
      const k = Math.round((hits / 8) * 800) / 1000
      return json(route, 200, { session_id: body.p_session_id, k_score: k, xp_earned: 50 + Math.round(k * 100) + ((body.p_difficulty as number) - 1) * 5 + 15, next_difficulty: body.p_difficulty, already_saved: false })
    }
    return json(route, 404, { message: `sem simulação para ${url.pathname}` })
  })
  return state
}

/** Sessão de teste no formato do supabase-js (chave sb-<host>-auth-token). */
export async function signIn(page: Page, opts: { tutorialDone?: boolean; sound?: boolean | null } = {}) {
  await page.addInitScript(({ userId, tutorialDone, sound }) => {
    if (sessionStorage.getItem('e2e-init')) return
    sessionStorage.setItem('e2e-init', '1')
    const now = Math.floor(Date.now() / 1000)
    const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'teste@example.test', user_metadata: { full_name: 'Teste E2E' }, app_metadata: {}, created_at: new Date().toISOString() }
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'e2e-token', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 86400, expires_at: now + 86400, user }))
    if (tutorialDone) localStorage.setItem(`neurobridge:${userId}:vigia:tutorial-done`, '1')
    if (sound !== null) localStorage.setItem('neurobridge:preferences', JSON.stringify({ sound, colorSymbols: false }))
  }, { userId: USER_ID, tutorialDone: opts.tutorialDone ?? true, sound: opts.sound === undefined ? false : opts.sound })
}

/** Escolhe o nível nas instruções (parte do 3 quando não há histórico). */
export async function chooseLevel(page: Page, level: number) {
  const plus = page.getByRole('button', { name: 'Aumentar nível' })
  const minus = page.getByRole('button', { name: 'Diminuir nível' })
  await expect(page.getByRole('button', { name: /Começar nível/ })).toBeVisible()
  for (let i = 0; i < 10; i++) {
    const current = Number((await page.getByRole('button', { name: /Começar nível/ }).textContent())!.match(/\d+/)![0])
    if (current === level) return
    await (current < level ? plus : minus).click()
  }
}

/** Responde automaticamente aos azuis (pelo mesmo atalho de teclado do jogador). */
export async function autoPlay(page: Page, delayMs = 200) {
  await page.evaluate(delay => {
    let last: Element | null = null
    new MutationObserver(() => {
      const el = document.querySelector('.arena-stage [role="img"]')
      if (!el || el === last) return
      last = el
      if (el.getAttribute('aria-label') === 'Círculo azul') {
        setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' })), delay)
      }
    }).observe(document.body, { childList: true, subtree: true })
  }, delayMs)
}

export async function playToResults(page: Page, level = 10) {
  await chooseLevel(page, level)
  await page.getByRole('button', { name: /Começar nível/ }).click()
  await autoPlay(page)
  await expect(page.getByText('Pontuação da partida')).toBeVisible({ timeout: 90_000 })
}

export interface LayoutReport {
  horizontalScroll: boolean
  outside: string[]
  overflowing: string[]
  smallTargets: string[]
  smallText: string[]
}

/** Mede a tela atual: rolagem horizontal, elementos fora da tela, alvos e textos pequenos. */
export function measureLayout(page: Page): Promise<LayoutReport> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const label = (el: Element) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('.sr-only') }
    const all = [...document.querySelectorAll('body *')].filter(visible)
    const outside = all.filter(el => { const r = el.getBoundingClientRect(); return r.left < -0.5 || r.right > vw + 0.5 }).map(label)
    const overflowing = [...document.querySelectorAll('.card, .panel, .stat, .notice, .game-card, .row, .arena')]
      .filter(visible).filter(el => el.scrollWidth > el.clientWidth + 1).map(el => `${label(el)} ${el.scrollWidth}>${el.clientWidth}`)
    // Um campo dentro de <label> tem como alvo o rótulo inteiro (clicar no texto também marca).
    const target = (el: Element) => el.closest('label') ?? el
    const smallTargets = [...document.querySelectorAll('button, a[href], input')].filter(visible)
      .filter(el => { const r = target(el).getBoundingClientRect(); return r.height < 44 || r.width < 44 })
      .map(el => `${label(el)} ${Math.round(target(el).getBoundingClientRect().width)}×${Math.round(target(el).getBoundingClientRect().height)}`)
    const smallText = all.filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim()))
      .filter(el => parseFloat(getComputedStyle(el).fontSize) < 12.8).map(el => `${label(el)} ${getComputedStyle(el).fontSize}`)
    return { horizontalScroll: document.documentElement.scrollWidth > vw, outside: outside.slice(0, 5), overflowing: overflowing.slice(0, 5), smallTargets: smallTargets.slice(0, 5), smallText: smallText.slice(0, 5) }
  })
}

export function expectCleanLayout(report: LayoutReport, where: string) {
  expect.soft(report.horizontalScroll, `${where}: rolagem horizontal`).toBe(false)
  expect.soft(report.outside, `${where}: elementos fora da tela`).toEqual([])
  expect.soft(report.overflowing, `${where}: conteúdo vazando da caixa`).toEqual([])
  expect.soft(report.smallTargets, `${where}: controles menores que 44 px`).toEqual([])
  expect.soft(report.smallText, `${where}: texto menor que 0,8rem`).toEqual([])
}

/** Verifica que o elemento está inteiro dentro da área visível (sem rolar). */
export async function expectFullyInViewport(page: Page, selector: string, where: string) {
  const box = await page.locator(selector).first().boundingBox()
  const vp = page.viewportSize()!
  expect.soft(box, `${where}: ${selector} existe`).not.toBeNull()
  if (!box) return
  expect.soft(box.y >= 0 && box.y + box.height <= vp.height + 0.5 && box.x >= 0 && box.x + box.width <= vp.width + 0.5,
    `${where}: ${selector} inteiro na tela (${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)} em ${vp.width}×${vp.height})`).toBe(true)
}
