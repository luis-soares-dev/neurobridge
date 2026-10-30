// Envio da partida do Vigia. A partida é guardada neste aparelho antes do envio e só
// sai de lá depois da confirmação do servidor; reenvios usam o mesmo ID e não duplicam nada.
import { getConfirmedUserId } from '../../services/auth'
import { SaveError } from '../../services/errors'
import { saveVigiaSession, type SavedSession, type SaveVigiaPayload } from '../../services/sessions'
import { writeDifficulty } from '../core/difficulty'
import { removePending, savePending, type PendingResult } from '../core/pendingResults'
import type { VigiaResults } from './engine'

export interface SessionInfo {
  id: string
  userId: string
  /** Tempo ativo de jogo, sem contagem regressiva e sem pausas. */
  durationMs: number
}

export function buildPayload(results: VigiaResults, session: SessionInfo): SaveVigiaPayload {
  return {
    sessionId: session.id,
    durationMs: Math.round(session.durationMs),
    difficulty: results.difficulty,
    trials: results.trials.map(t => ({ ...t })),
  }
}

/** Guarda a partida neste aparelho até a confirmação. Retorna false se não for possível guardar. */
export function storePending(results: VigiaResults, session: SessionInfo, now = Date.now()): boolean {
  const item: PendingResult<SaveVigiaPayload> = {
    gameId: 'vigia',
    sessionId: session.id,
    createdAt: now,
    summary: { difficulty: results.difficulty, score: results.score.score },
    payload: buildPayload(results, session),
  }
  return savePending(session.userId, item, now)
}

/** Envia uma partida guardada. Só a conta que jogou pode enviá-la. */
export async function sendPending(userId: string, payload: SaveVigiaPayload): Promise<SavedSession> {
  const current = await getConfirmedUserId()
  if (current !== userId) throw new SaveError('auth', 'Entre novamente com a conta que iniciou a partida.')
  const saved = await saveVigiaSession(payload)
  removePending(userId, payload.sessionId)
  writeDifficulty(userId, saved.nextDifficulty, 'vigia')
  return saved
}

export async function persistSession(results: VigiaResults, session: SessionInfo): Promise<SavedSession> {
  storePending(results, session)
  return sendPending(session.userId, buildPayload(results, session))
}
