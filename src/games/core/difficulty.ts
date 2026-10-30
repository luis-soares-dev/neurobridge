// Regras de dificuldade compartilhadas: limites, ajuste adaptativo e cache local.
import type { DifficultyLevel, GameId } from './types'

export const MIN_DIFFICULTY = 1
export const MAX_DIFFICULTY = 10
export const DEFAULT_DIFFICULTY: DifficultyLevel = 3

/** Pontuação acima disto sobe de nível; abaixo de LEVEL_DOWN_BELOW, desce. */
export const LEVEL_UP_ABOVE = 0.7
export const LEVEL_DOWN_BELOW = 0.4

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  1: 'Iniciante', 2: 'Iniciante', 3: 'Básico',
  4: 'Básico+', 5: 'Intermediário', 6: 'Intermediário+',
  7: 'Avançado', 8: 'Avançado+', 9: 'Especialista', 10: 'Mestre',
}

export function normalizeDifficulty(value: unknown): DifficultyLevel {
  const n = Number(value)
  return (Number.isInteger(n) && n >= MIN_DIFFICULTY && n <= MAX_DIFFICULTY ? n : DEFAULT_DIFFICULTY) as DifficultyLevel
}

export function clampDifficulty(n: number): DifficultyLevel {
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, Math.round(n))) as DifficultyLevel
}

/** Mantém o jogador na faixa em que o desafio não é fácil nem frustrante demais. */
export function adjustDifficulty(score: number, current: DifficultyLevel): DifficultyLevel {
  if (score > LEVEL_UP_ABOVE) return clampDifficulty(current + 1)
  if (score < LEVEL_DOWN_BELOW) return clampDifficulty(current - 1)
  return current
}

/** Pontuação com uma casa decimal, no mesmo rigor usado para decidir o nível (ex.: "70,4"). */
export function formatPoints(score: number): string {
  const tenths = Math.round(score * 1000)
  return tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1).replace('.', ',')
}

const UP = formatPoints(LEVEL_UP_ABOVE)
const DOWN = formatPoints(LEVEL_DOWN_BELOW)

/** Explica a decisão de nível com os números exatos que a produziram. */
export function explainDecision(score: number, current: DifficultyLevel, next: DifficultyLevel): string {
  const pts = formatPoints(score)
  if (next > current) return `Sobe para o nível ${next}: ${pts} pontos é mais que ${UP}.`
  if (next < current) return `Desce para o nível ${next}: ${pts} pontos é menos que ${DOWN}.`
  if (score > LEVEL_UP_ABOVE) return `Continua no nível ${current}, o mais difícil.`
  if (score < LEVEL_DOWN_BELOW) return `Continua no nível ${current}, o mais fácil.`
  return `Continua no nível ${current}: para subir é preciso passar de ${UP} pontos (você fez ${pts}).`
}

// Cache local por jogador e por jogo. A chave do Vigia é a mesma da versão anterior.
const cacheKey = (userId: string, gameId: GameId) => `neurobridge:${userId}:${gameId}:difficulty`

export function readDifficulty(userId?: string, gameId: GameId = 'vigia'): DifficultyLevel {
  if (!userId) return DEFAULT_DIFFICULTY
  try { return normalizeDifficulty(localStorage.getItem(cacheKey(userId, gameId)) ?? DEFAULT_DIFFICULTY) }
  catch { return DEFAULT_DIFFICULTY }
}

export function writeDifficulty(userId: string, difficulty: DifficultyLevel, gameId: GameId = 'vigia'): void {
  try { localStorage.setItem(cacheKey(userId, gameId), String(normalizeDifficulty(difficulty))) }
  catch { /* A partida já está salva no servidor; cache local é opcional. */ }
}
