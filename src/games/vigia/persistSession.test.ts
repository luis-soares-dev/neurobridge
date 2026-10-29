import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), cache: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.rpc } }))
vi.mock('../../lib/gameProgress', () => ({ writeDifficulty: mocks.cache }))
import { persistSession } from './persistSession'
import type { VigiResults } from './useVigiGame'
const result = {
  trials: [{ color: 'azul', isTarget: true, responded: true, responseTime: 300, isCorrect: true }],
  difficulty: 3, kResult: { kScore: 0.8, nextDifficulty: 4 },
} as VigiResults
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'ana' } }, error: null })
  mocks.rpc.mockResolvedValue({ error: null })
})
describe('salvamento da partida', () => {
  it('envia o mesmo ID nas tentativas e só atualiza cache após confirmação', async () => {
    await persistSession(result, 'partida-1', 'ana', '2026-10-29T17:00:00Z')
    expect(mocks.rpc).toHaveBeenCalledWith('save_vigia_session', expect.objectContaining({ p_session_id: 'partida-1', p_trials: result.trials }))
    expect(mocks.cache).toHaveBeenCalledWith('ana', 4)
  })
  it('propaga falha do banco sem anunciar progresso salvo', async () => {
    mocks.rpc.mockResolvedValue({ error: new Error('offline') })
    await expect(persistSession(result, 'partida-1', 'ana', '2026-10-29T17:00:00Z')).rejects.toThrow('offline')
    expect(mocks.cache).not.toHaveBeenCalled()
  })
  it('recusa salvar na conta de quem não iniciou a partida', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'bruno' } }, error: null })
    await expect(persistSession(result, 'partida-1', 'ana', '2026-10-29T17:00:00Z')).rejects.toThrow('conta que iniciou')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
