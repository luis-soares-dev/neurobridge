import { useEffect, useState } from 'react'
import { getLastSession } from '../../services/sessions'
import { adjustDifficulty, DEFAULT_DIFFICULTY, readDifficulty, writeDifficulty } from './difficulty'
import type { DifficultyLevel, GameId } from './types'

/**
 * Nível sugerido para a próxima partida: vem da última partida salva no servidor;
 * se o histórico estiver indisponível, usa o cache deste navegador.
 */
export function useRecommendedDifficulty(userId: string | undefined, gameId: GameId) {
  const [state, setState] = useState<{ difficulty: DifficultyLevel; loading: boolean; error: boolean }>(() => ({
    difficulty: readDifficulty(userId, gameId), loading: true, error: false,
  }))

  useEffect(() => {
    let cancelled = false
    setState({ difficulty: readDifficulty(userId, gameId), loading: true, error: false })
    async function load() {
      if (!userId) { if (!cancelled) setState({ difficulty: DEFAULT_DIFFICULTY, loading: false, error: false }); return }
      try {
        const last = await getLastSession(userId, gameId)
        const difficulty = last
          ? (last.score === null ? last.difficulty : adjustDifficulty(last.score, last.difficulty))
          : readDifficulty(userId, gameId)
        if (cancelled) return
        writeDifficulty(userId, difficulty, gameId)
        setState({ difficulty, loading: false, error: false })
      } catch {
        if (!cancelled) setState({ difficulty: readDifficulty(userId, gameId), loading: false, error: true })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [userId, gameId])

  return state
}
