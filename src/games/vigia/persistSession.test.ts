import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), cache: vi.fn() }))
vi.mock('../../services/supabase', () => ({ supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.rpc } }))
vi.mock('../core/difficulty', async (original) => ({ ...(await original<object>()), writeDifficulty: mocks.cache }))
import { persistSession } from './persistSession'
import type { VigiaResults } from './engine'

const result = {
  trials: [{ color: 'azul', isTarget: true, responded: true, responseTime: 300, isCorrect: true }],
  difficulty: 3, score: { score: 0.8, nextDifficulty: 4 },
} as VigiaResults
const session = { id: 'partida-1', userId: 'ana', durationMs: 50_000 }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'ana' } }, error: null })
  mocks.rpc.mockResolvedValue({ data: { k_score: 0.812, xp_earned: 156, next_difficulty: 4 }, error: null })
})

describe('salvamento da partida', () => {
  it('envia respostas e duração (não a pontuação) e usa os valores oficiais do servidor', async () => {
    const saved = await persistSession(result, session)
    expect(mocks.rpc).toHaveBeenCalledWith('save_vigia_session', {
      p_session_id: 'partida-1', p_duration_ms: 50_000, p_difficulty: 3, p_trials: result.trials,
    })
    expect(saved).toEqual({ score: 0.812, xpEarned: 156, nextDifficulty: 4 })
    expect(mocks.cache).toHaveBeenCalledWith('ana', 4, 'vigia')
  })
  it('propaga falha do banco sem anunciar progresso salvo', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('offline') })
    await expect(persistSession(result, session)).rejects.toThrow('offline')
    expect(mocks.cache).not.toHaveBeenCalled()
  })
  it('rejeita resposta malformada do servidor', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null })
    await expect(persistSession(result, session)).rejects.toThrow('inesperada')
    expect(mocks.cache).not.toHaveBeenCalled()
  })
  it('recusa salvar na conta de quem não iniciou a partida', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'bruno' } }, error: null })
    await expect(persistSession(result, session)).rejects.toThrow('conta que iniciou')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
