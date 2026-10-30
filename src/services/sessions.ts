// Único ponto de leitura/escrita de partidas e progresso no banco.
// Escritas só acontecem por funções do servidor (RPC); as tabelas são somente leitura para o app.
import { normalizeDifficulty } from '../games/core/difficulty'
import type { DifficultyLevel, GameId, GameProgress } from '../games/core/types'
import { classifySaveError, SaveError } from './errors'
import { supabase } from './supabase'

export async function getProfileXp(userId: string): Promise<number> {
  const { data, error } = await supabase.from('profiles').select('xp_total').eq('id', userId).single()
  if (error) throw error
  return data?.xp_total ?? 0
}

export async function getLastSession(userId: string, gameId: GameId): Promise<{ difficulty: DifficultyLevel; score: number | null } | null> {
  const { data, error } = await supabase.from('sessions')
    .select('difficulty_level, k_score')
    .eq('user_id', userId).eq('game_id', gameId)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data ? { difficulty: normalizeDifficulty(data.difficulty_level), score: data.k_score === null ? null : Number(data.k_score) } : null
}

export async function getProgress(userId: string): Promise<GameProgress[]> {
  const { data, error } = await supabase.from('progress')
    .select('game_id, last_k_score, best_k_score, total_sessions, last_played_at, k_score_history')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map(row => ({
    gameId: row.game_id,
    lastScore: row.last_k_score === null ? null : Number(row.last_k_score),
    bestScore: row.best_k_score === null ? null : Number(row.best_k_score),
    totalSessions: row.total_sessions,
    lastPlayedAt: row.last_played_at,
    scoreHistory: (row.k_score_history ?? []).map(Number),
  }))
}

export interface SaveVigiaPayload {
  sessionId: string
  durationMs: number
  difficulty: DifficultyLevel
  trials: { color: string; isTarget: boolean; responded: boolean; responseTime: number | null; isCorrect: boolean }[]
}

/** Valores oficiais calculados pelo servidor. */
export interface SavedSession {
  score: number
  xpEarned: number
  nextDifficulty: DifficultyLevel
}

/** Tempo máximo de espera pelo servidor ao salvar. */
export const SAVE_TIMEOUT_MS = 15_000

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/** Confere a resposta da RPC; qualquer desvio do contrato é tratado como erro. */
export function parseSavedSession(data: unknown, sessionId: string): SavedSession {
  const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const k = r.k_score
  const validScore = typeof k === 'number' && k >= 0 && k <= 1 && Math.abs(Math.round(k * 1000) - k * 1000) < 1e-6
  // XP do Vigia: mínimo 50 + 0 + 0 + 15 = 65; máximo 50 + 100 + 45 + 15 = 210.
  if (!validScore || !isInt(r.xp_earned, 65, 210) || !isInt(r.next_difficulty, 1, 10) || r.session_id !== sessionId) {
    throw new SaveError('unexpected', 'Resposta do servidor fora do formato esperado.')
  }
  return { score: k, xpEarned: r.xp_earned, nextDifficulty: normalizeDifficulty(r.next_difficulty) }
}

export async function saveVigiaSession(p: SaveVigiaPayload, timeoutMs = SAVE_TIMEOUT_MS): Promise<SavedSession> {
  const { data, error, status } = await supabase.rpc('save_vigia_session', {
    p_session_id: p.sessionId,
    p_duration_ms: p.durationMs,
    p_difficulty: p.difficulty,
    p_trials: p.trials,
  }).abortSignal(AbortSignal.timeout(timeoutMs))
  if (error) throw new SaveError(classifySaveError(error, status), error.message)
  return parseSavedSession(data, p.sessionId)
}
