import { supabase } from '../../services/supabase'
import { saveVigiaSession, type SavedSession } from '../../services/sessions'
import { writeDifficulty } from '../core/difficulty'
import type { VigiaResults } from './engine'

export interface SessionInfo {
  id: string
  userId: string
  durationMs: number
}

/**
 * Salva a partida. O servidor recalcula pontuação e XP a partir das respostas;
 * o valor devolvido é o oficial. Reenvios com o mesmo ID não duplicam nada.
 */
export async function persistSession(results: VigiaResults, session: SessionInfo): Promise<SavedSession> {
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError || data.user?.id !== session.userId) throw new Error('Entre novamente com a conta que iniciou a partida.')
  const saved = await saveVigiaSession({
    sessionId: session.id,
    durationMs: session.durationMs,
    difficulty: results.difficulty,
    trials: results.trials.map(t => ({ ...t })),
  })
  writeDifficulty(session.userId, saved.nextDifficulty, 'vigia')
  return saved
}
