// Regras do Vigia em funções puras (sem React, sem rede) — fáceis de testar
// e espelhadas pela função SQL que recalcula a pontuação no servidor.
import { adjustDifficulty } from '../core/difficulty'
import { calculateXP, roundScore } from '../core/score'
import type { DifficultyLevel, ScoreResult } from '../core/types'
import { TARGET_COLOR, TARGET_COUNT, TIMING, TOTAL_TRIALS, distractorsFor, type StimulusColor } from './config'

export interface VigiaStimulus {
  color: StimulusColor
  isTarget: boolean
}

export interface VigiaTrial {
  color: StimulusColor
  isTarget: boolean
  responded: boolean
  /** ms desde que o estímulo apareceu; null quando não houve resposta. */
  responseTime: number | null
  isCorrect: boolean
}

export interface VigiaResults {
  trials: VigiaTrial[]
  hits: number
  misses: number
  falseAlarms: number
  correctRejections: number
  /** Alvos respondidos / total de alvos. */
  hitRate: number
  /** Distratores respondidos / total de distratores. */
  falseAlarmRate: number
  /** Tempo médio de resposta nos acertos (ms); 0 sem acertos. */
  avgRT: number
  score: ScoreResult
  xpEarned: number
  difficulty: DifficultyLevel
}

export function generateStimuli(difficulty: DifficultyLevel, random: () => number = Math.random): VigiaStimulus[] {
  const distractors = distractorsFor(difficulty)
  const items: VigiaStimulus[] = [
    ...Array.from({ length: TARGET_COUNT }, () => ({ color: TARGET_COLOR, isTarget: true })),
    ...Array.from({ length: TOTAL_TRIALS - TARGET_COUNT }, (_, i) => ({ color: distractors[i % distractors.length], isTarget: false })),
  ]
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

/** Registra uma tentativa; o tempo fica limitado à janela em que o estímulo esteve visível. */
export function makeTrial(stimulus: VigiaStimulus, rawResponseTime: number | null, difficulty: DifficultyLevel): VigiaTrial {
  const responded = rawResponseTime !== null
  const window = TIMING[difficulty].stimulus
  const responseTime = responded ? Math.min(window, Math.max(0, Math.round(rawResponseTime))) : null
  return {
    color: stimulus.color,
    isTarget: stimulus.isTarget,
    responded,
    responseTime,
    isCorrect: stimulus.isTarget === responded,
  }
}

/**
 * Pontuação do Vigia (0 a 1):
 *   precisão   = taxa de acertos − taxa de falsos alarmes (mínimo 0)
 *   velocidade = 1 − 0,5 × (tempo médio nos acertos ÷ janela do nível)
 *   pontuação  = precisão × (0,6 + 0,4 × velocidade)
 * Não responder nada ou responder a tudo dá precisão 0. Com a mesma
 * precisão, responder mais rápido nunca diminui a pontuação.
 */
export function scoreVigia(trials: VigiaTrial[], difficulty: DifficultyLevel): ScoreResult {
  const targets = trials.filter(t => t.isTarget)
  const nonTargets = trials.filter(t => !t.isTarget)
  const hitRTs = targets.filter(t => t.responded).map(t => t.responseTime ?? 0)
  const falseAlarms = nonTargets.filter(t => t.responded).length

  const hitRate = targets.length ? hitRTs.length / targets.length : 0
  const falseAlarmRate = nonTargets.length ? falseAlarms / nonTargets.length : 0
  const precision = Math.max(0, hitRate - falseAlarmRate)

  const window = TIMING[difficulty].stimulus
  const meanRT = hitRTs.length ? hitRTs.reduce((a, b) => a + b, 0) / hitRTs.length : window
  const speed = hitRTs.length ? Math.min(1, Math.max(0, 1 - 0.5 * (meanRT / window))) : 0

  const score = roundScore(precision * (0.6 + 0.4 * speed))
  return {
    score,
    precision: roundScore(precision),
    speed: roundScore(speed),
    nextDifficulty: adjustDifficulty(score, difficulty),
  }
}

export function computeResults(trials: VigiaTrial[], difficulty: DifficultyLevel): VigiaResults {
  const hits = trials.filter(t => t.isTarget && t.responded).length
  const misses = trials.filter(t => t.isTarget && !t.responded).length
  const falseAlarms = trials.filter(t => !t.isTarget && t.responded).length
  const correctRejections = trials.filter(t => !t.isTarget && !t.responded).length
  const hitRTs = trials.filter(t => t.isTarget && t.responded).map(t => t.responseTime ?? 0)
  const score = scoreVigia(trials, difficulty)
  return {
    trials, hits, misses, falseAlarms, correctRejections,
    hitRate: hits + misses ? hits / (hits + misses) : 0,
    falseAlarmRate: falseAlarms + correctRejections ? falseAlarms / (falseAlarms + correctRejections) : 0,
    avgRT: hitRTs.length ? Math.round(hitRTs.reduce((a, b) => a + b, 0) / hitRTs.length) : 0,
    score,
    xpEarned: calculateXP(score.score, difficulty, trials.length),
    difficulty,
  }
}

/** Duração mínima plausível de uma partida (sem pausas), em ms. Igual à verificação no SQL. */
export function minimumDurationMs(difficulty: DifficultyLevel): number {
  const { stimulus, iti } = TIMING[difficulty]
  return Math.floor(TOTAL_TRIALS * (stimulus + iti) * 0.9)
}
