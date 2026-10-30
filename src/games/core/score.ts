// Pontuação, XP e nível do jogador — regras comuns a todos os jogos.
// A pontuação mede o desempenho na partida; não é avaliação clínica.

/** XP necessário por nível do jogador (igual ao cálculo no banco). */
export const XP_PER_LEVEL = 500

/** Arredonda para 3 casas, como a coluna NUMERIC(4,3) do banco. */
export function roundScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000
}

/** Pontuação em 0–100 para exibição. */
export function scoreToPercent(score: number): number {
  return Math.round(roundScore(score) * 100)
}

/**
 * XP da partida. Usa aritmética inteira para dar exatamente o mesmo
 * resultado que a função SQL (sem erro de ponto flutuante).
 */
export function calculateXP(score: number, difficulty: number, trials: number): number {
  const thousandths = Math.round(roundScore(score) * 1000)
  const scoreBonus = Math.floor((thousandths + 5) / 10)       // até +100
  const difficultyBonus = (difficulty - 1) * 5                 // até +45
  const trialsBonus = Math.min(Math.round(trials * 0.5), 25)   // até +25
  return 50 + scoreBonus + difficultyBonus + trialsBonus
}

export function levelFromXp(xpTotal: number): { level: number; xpInLevel: number; percent: number } {
  const xp = Math.max(0, Math.floor(xpTotal))
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpInLevel = xp - (level - 1) * XP_PER_LEVEL
  return { level, xpInLevel, percent: Math.round((xpInLevel / XP_PER_LEVEL) * 100) }
}

/**
 * Rótulo geral da partida. A descrição do que aconteceu vem de cada jogo
 * (acertos, erros e tempo), não é deduzida só da nota.
 */
export function interpretScore(score: number): { label: string; emoji: string; tone: 'great' | 'good' | 'mid' | 'low' } {
  if (score >= 0.75) return { label: 'Excelente', emoji: '🏆', tone: 'great' }
  if (score >= 0.5) return { label: 'Bom', emoji: '🎯', tone: 'good' }
  if (score >= 0.3) return { label: 'Em progresso', emoji: '📊', tone: 'mid' }
  return { label: 'Continue praticando', emoji: '🔄', tone: 'low' }
}
