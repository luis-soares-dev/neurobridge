import { supabase } from '../../lib/supabase'
import { writeDifficulty } from '../../lib/gameProgress'
import type { VigiResults } from './useVigiGame'

export async function persistSession(results: VigiResults, sessionId: string, userId: string, startedAt: string): Promise<void> {
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError || data.user?.id !== userId) throw new Error('Entre novamente com a conta que iniciou a partida.')
  const { error } = await supabase.rpc('save_vigia_session', {
    p_session_id: sessionId,
    p_started_at: startedAt,
    p_difficulty: results.difficulty,
    p_k_score: results.kResult.kScore,
    p_trials: results.trials.map(t => ({ ...t })),
  })
  if (error) throw error
  writeDifficulty(userId, results.kResult.nextDifficulty)
}

