import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), abortSignal: vi.fn(), cache: vi.fn() }))
vi.mock('../../services/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, rpc: (...args: unknown[]) => { mocks.rpc(...args); return { abortSignal: mocks.abortSignal } } },
}))
vi.mock('../core/difficulty', async (original) => ({ ...(await original<object>()), writeDifficulty: mocks.cache }))
import { listPending } from '../core/pendingResults'
import { persistSession, sendPending, buildPayload } from './persistSession'
import { SaveError } from '../../services/errors'
import type { VigiaResults } from './engine'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => values.set(k, v),
  removeItem: (k: string) => values.delete(k),
} })

const result = {
  trials: [{ color: 'azul', isTarget: true, responded: true, responseTime: 300, isCorrect: true }],
  difficulty: 3, score: { score: 0.8, nextDifficulty: 4 },
} as VigiaResults
const session = { id: 'partida-1', userId: 'ana', durationMs: 50_000.4 }
const ok = { data: { session_id: 'partida-1', k_score: 0.812, xp_earned: 156, next_difficulty: 4 }, error: null, status: 200 }

beforeEach(() => {
  vi.resetAllMocks()
  values.clear()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'ana' } }, error: null })
  mocks.abortSignal.mockResolvedValue(ok)
})

describe('salvamento da partida', () => {
  it('envia respostas e tempo ativo (não a pontuação) e usa os valores oficiais do servidor', async () => {
    const saved = await persistSession(result, session)
    expect(mocks.rpc).toHaveBeenCalledWith('save_vigia_session', {
      p_session_id: 'partida-1', p_duration_ms: 50_000, p_difficulty: 3, p_trials: result.trials,
    })
    expect(saved).toEqual({ score: 0.812, xpEarned: 156, nextDifficulty: 4 })
    expect(mocks.cache).toHaveBeenCalledWith('ana', 4, 'vigia')
  })

  it('guarda a partida antes de enviar e só apaga depois da confirmação', async () => {
    mocks.abortSignal.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 })
    await expect(persistSession(result, session)).rejects.toMatchObject({ kind: 'network' })
    expect(listPending('ana').map(p => p.sessionId)).toEqual(['partida-1'])
    expect(mocks.cache).not.toHaveBeenCalled()
    mocks.abortSignal.mockResolvedValue(ok)
    await sendPending('ana', listPending('ana')[0].payload as ReturnType<typeof buildPayload>)
    expect(listPending('ana')).toEqual([])
  })

  it.each([
    [{ message: 'AbortError: signal is aborted', code: '' }, 0, 'timeout'],
    [{ message: 'Respostas inválidas', code: 'P0001' }, 400, 'rejected'],
    [{ message: 'Partidas em sequência rápida demais', code: 'P0001' }, 400, 'rate'],
    [{ message: 'JWT expired', code: 'PGRST301' }, 401, 'auth'],
  ])('classifica o erro %o como %s', async (error, status, kind) => {
    mocks.abortSignal.mockResolvedValue({ data: null, error, status })
    await expect(persistSession(result, session)).rejects.toMatchObject({ kind })
  })

  it.each([
    { session_id: 'partida-1', k_score: null, xp_earned: null, next_difficulty: null },
    { session_id: 'outra', k_score: 0.5, xp_earned: 100, next_difficulty: 3 },
    { session_id: 'partida-1', k_score: 1.5, xp_earned: 100, next_difficulty: 3 },
    { session_id: 'partida-1', k_score: 0.5, xp_earned: 10.5, next_difficulty: 3 },
    { session_id: 'partida-1', k_score: 0.5, xp_earned: 100, next_difficulty: 11 },
  ])('recusa resposta fora do contrato %o', async data => {
    mocks.abortSignal.mockResolvedValue({ data, error: null, status: 200 })
    await expect(persistSession(result, session)).rejects.toMatchObject({ kind: 'unexpected' })
    expect(listPending('ana')).toHaveLength(1)
  })

  it('recusa enviar pela conta de quem não iniciou a partida', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'bruno' } }, error: null })
    await expect(persistSession(result, session)).rejects.toBeInstanceOf(SaveError)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('sem conexão para confirmar a conta, classifica como rede (não como conta errada)', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'TypeError: Failed to fetch', status: 0 } })
    await expect(persistSession(result, session)).rejects.toMatchObject({ kind: 'network' })
  })
})
