import type { DifficultyLevel } from '../types'

export function normalizeDifficulty(value: unknown): DifficultyLevel {
  const n = Number(value)
  return (Number.isInteger(n) && n >= 1 && n <= 10 ? n : 3) as DifficultyLevel
}

export function readDifficulty(userId?: string): DifficultyLevel {
  if (!userId) return 3
  try { return normalizeDifficulty(localStorage.getItem(`neurobridge:${userId}:vigia:difficulty`) ?? 3) }
  catch { return 3 }
}

export function writeDifficulty(userId: string, difficulty: DifficultyLevel): void {
  try { localStorage.setItem(`neurobridge:${userId}:vigia:difficulty`, String(normalizeDifficulty(difficulty))) }
  catch { /* A partida já está salva no servidor; cache local é opcional. */ }
}
