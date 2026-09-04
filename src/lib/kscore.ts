// ──────────────────────────────────────────────────────────────────────────────
// NeuroBridge — Motor Adaptativo K-Score
//
// ANALOGIA SIMPLES:
// Imagine um professor particular que, depois de cada exercício, avalia:
//   1. Você acertou? (acurácia)
//   2. Foi rápido? (tempo de resposta)
//   3. Foi consistente ou teve sorte? (consistência)
//
// Multiplica esses três fatores → K-Score.
// Se o K-Score é alto → aumenta a dificuldade.
// Se é baixo → diminui. Sempre na zona ideal de aprendizado.
//
// FÓRMULA: K = acurácia × (1 / RT_norm) × consistência
// ──────────────────────────────────────────────────────────────────────────────

import type { Trial, KScoreResult, DifficultyLevel } from '@/types'

// Tempo de referência por dificuldade (em ms)
// Representa o tempo esperado de um usuário "médio" em cada nível.
// Abaixo disso = rápido. Acima = lento.
const REFERENCE_RT: Record<number, number> = {
  1: 1200, 2: 1100, 3: 1000, 4: 900, 5: 800,
  6: 700,  7: 650,  8: 600,  9: 550, 10: 500,
}

// Janela deslizante: quantas trials usamos para calcular o K-Score
// Usar as últimas 20 garante que o score reflita o estado ATUAL,
// não o começo da sessão quando o usuário estava "aquecendo"
const WINDOW_SIZE = 20

/**
 * Calcula o desvio padrão de uma lista de números.
 * Desvio padrão mede o quanto os valores variam entre si.
 * Baixo desvio = consistente. Alto desvio = instável.
 */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Calcula o K-Score a partir de uma janela de trials.
 *
 * @param trials  - Lista de todas as trials da sessão
 * @param difficulty - Dificuldade atual do jogo
 * @returns KScoreResult com o score e a próxima dificuldade recomendada
 */
export function calculateKScore(
  trials: Trial[],
  difficulty: DifficultyLevel,
): KScoreResult {
  // Pega apenas as últimas WINDOW_SIZE trials (janela deslizante)
  const window = trials.slice(-WINDOW_SIZE)

  // Se temos menos de 3 trials, não há dados suficientes
  if (window.length < 3) {
    return {
      kScore: 0,
      accuracy: 0,
      avgResponseTime: 0,
      consistency: 0,
      nextDifficulty: difficulty,
    }
  }

  // ── 1. ACURÁCIA ───────────────────────────────────────────────────────────
  // Quantas trials foram corretas? Divide pelo total.
  const correctTrials = window.filter(t => t.isCorrect)
  const accuracy = correctTrials.length / window.length

  // ── 2. TEMPO DE RESPOSTA ──────────────────────────────────────────────────
  // Usamos apenas os acertos para calcular RT (erros não representam velocidade real)
  const responseTimes = correctTrials.map(t => t.responseTime)

  if (responseTimes.length === 0) {
    return {
      kScore: 0,
      accuracy,
      avgResponseTime: 0,
      consistency: 0,
      nextDifficulty: Math.max(1, difficulty - 1) as DifficultyLevel,
    }
  }

  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
  const refRT = REFERENCE_RT[difficulty] ?? 800

  // RT normalizado: 1.0 = exatamente no tempo de referência
  // < 1.0 = mais rápido que o esperado (bom)
  // > 1.0 = mais lento (até o limite de 2.0)
  const rtNorm = Math.min(avgResponseTime / refRT, 2.0)

  // ── 3. CONSISTÊNCIA ───────────────────────────────────────────────────────
  // Mede o quanto os tempos de resposta variam entre si.
  // Consistência = 1 - (desvio_padrão / média)
  // Se todos os tempos são iguais: consistência = 1 (máximo)
  // Se variam muito: consistência → 0
  const stdDev = standardDeviation(responseTimes)
  const consistency = avgResponseTime > 0
    ? Math.max(0, 1 - stdDev / avgResponseTime)
    : 0

  // ── 4. K-SCORE FINAL ──────────────────────────────────────────────────────
  const kScore = accuracy * (1 / rtNorm) * consistency

  // Garante que o resultado está entre 0 e 1
  const clampedKScore = Math.max(0, Math.min(1, kScore))

  // ── 5. AJUSTE DE DIFICULDADE ──────────────────────────────────────────────
  const nextDifficulty = adjustDifficulty(clampedKScore, difficulty)

  return {
    kScore: clampedKScore,
    accuracy,
    avgResponseTime: Math.round(avgResponseTime),
    consistency,
    nextDifficulty,
  }
}

/**
 * Decide se aumenta, mantém ou diminui a dificuldade.
 *
 * Zona ideal de aprendizado: K entre 0.40 e 0.70
 * - Abaixo de 0.40: muito difícil → diminui
 * - Acima de 0.70: muito fácil → aumenta
 * - Entre 0.40 e 0.70: zona certa → mantém
 *
 * Essa faixa é baseada na teoria do "Flow" de Csikszentmihalyi:
 * aprendizado máximo ocorre quando a tarefa está no limite das habilidades.
 */
function adjustDifficulty(kScore: number, current: DifficultyLevel): DifficultyLevel {
  if (kScore < 0.40) return Math.max(1, current - 1) as DifficultyLevel  // muito difícil
  if (kScore > 0.70) return Math.min(10, current + 1) as DifficultyLevel // muito fácil
  return current                                                            // zona ideal
}

/**
 * Retorna a interpretação textual do K-Score (para exibir ao usuário).
 */
export function interpretKScore(kScore: number): {
  label: string
  description: string
  emoji: string
  color: string
} {
  if (kScore >= 0.75) return {
    label: 'Excelente',
    description: 'Atenção de alta qualidade — rápido, preciso e consistente.',
    emoji: '🏆',
    color: '#34d399',
  }
  if (kScore >= 0.50) return {
    label: 'Bom',
    description: 'Desempenho sólido com espaço para crescer.',
    emoji: '🎯',
    color: '#6c8ef5',
  }
  if (kScore >= 0.30) return {
    label: 'Em desenvolvimento',
    description: 'A prática regular vai elevar sua consistência.',
    emoji: '📊',
    color: '#fbbf24',
  }
  return {
    label: 'Continue praticando',
    description: 'O treino progressivo é exatamente para isso.',
    emoji: '🔄',
    color: '#f87171',
  }
}

/**
 * Calcula quantos XP o usuário ganhou na sessão.
 * Base: 50 XP. Bônus por K-Score e dificuldade.
 */
export function calculateXP(kScore: number, difficulty: DifficultyLevel, trials: number): number {
  const base = 50
  const kBonus = Math.round(kScore * 100)          // até +100 XP
  const diffBonus = (difficulty - 1) * 5           // até +45 XP
  const trialsBonus = Math.min(Math.round(trials * 0.5), 25) // até +25 XP
  return base + kBonus + diffBonus + trialsBonus
}
