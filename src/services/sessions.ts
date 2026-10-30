// Único ponto de leitura/escrita de partidas e progresso no banco.
// Escritas só acontecem por funções do servidor (RPC); as tabelas são somente leitura para o app.
import { normalizeDifficulty } from '../games/core/difficulty'
import type { DifficultyLevel, GameId, GameProgress } from '../games/core/types'
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

export async function saveVigiaSession(p: SaveVigiaPayload): Promise<SavedSession> {
  const { data, error } = await supabase.rpc('save_vigia_session', {
    p_session_id: p.sessionId,
    p_duration_ms: p.durationMs,
    p_difficulty: p.difficulty,
    p_trials: p.trials,
  })
  if (error) throw error
  const r = (data ?? {}) as Record<string, unknown>
  const score = Number(r.k_score)
  const xpEarned = Number(r.xp_earned)
  if (!Number.isFinite(score) || !Number.isFinite(xpEarned)) throw new Error('Resposta inesperada do servidor.')
  return { score, xpEarned, nextDifficulty: normalizeDifficulty(r.next_difficulty) }
}
