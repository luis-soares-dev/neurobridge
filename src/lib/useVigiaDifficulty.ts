import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { readDifficulty, writeDifficulty } from './gameProgress'
import type { DifficultyLevel } from '../types'

export function useVigiaDifficulty(userId?: string) {
  const [state, setState] = useState<{ difficulty: DifficultyLevel; loading: boolean; error: boolean }>({
    difficulty: readDifficulty(userId), loading: true, error: false,
  })
  useEffect(() => {
    let cancelled = false
    setState({ difficulty: readDifficulty(userId), loading: true, error: false })
    async function load() {
      if (!userId) { if (!cancelled) setState({ difficulty: 3, loading: false, error: false }); return }
      try {
        const { data, error } = await supabase.from('sessions')
          .select('difficulty_level, k_score').eq('user_id', userId).eq('game_id', 'vigia')
          .not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(1).maybeSingle()
        if (error) throw error
        // Nos limites, mantém o nível em vez de voltar ao padrão.
        const difficulty = data ? Math.min(10, Math.max(1, data.difficulty_level + (
          data.k_score !== null && data.k_score > 0.7 ? 1 : data.k_score !== null && data.k_score < 0.4 ? -1 : 0
        ))) as DifficultyLevel : readDifficulty(userId)
        if (!cancelled) {
          writeDifficulty(userId, difficulty)
          setState({ difficulty, loading: false, error: false })
        }
      } catch {
        if (!cancelled) setState({ difficulty: readDifficulty(userId), loading: false, error: true })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [userId])
  return state
}
