// Parâmetros do Vigia. Os valores de tempo e cores são repetidos na função
// SQL save_vigia_session — ao mudar aqui, mude lá (o teste de paridade avisa).
import type { DifficultyLevel } from '../core/types'

export const TOTAL_TRIALS = 30
export const TARGET_COUNT = 8
export const COUNTDOWN_FROM = 3

export type StimulusColor = 'azul' | 'vermelho' | 'verde' | 'laranja' | 'ciano' | 'roxo'
export const TARGET_COLOR: StimulusColor = 'azul'

/** Duração do estímulo (= janela de resposta) e intervalo entre estímulos, em ms. */
export const TIMING: Record<DifficultyLevel, { stimulus: number; iti: number }> = {
  1: { stimulus: 1100, iti: 900 },
  2: { stimulus: 1000, iti: 800 },
  3: { stimulus: 900, iti: 700 },
  4: { stimulus: 800, iti: 600 },
  5: { stimulus: 700, iti: 550 },
  6: { stimulus: 650, iti: 500 },
  7: { stimulus: 600, iti: 450 },
  8: { stimulus: 550, iti: 400 },
  9: { stimulus: 500, iti: 350 },
  10: { stimulus: 450, iti: 300 },
}

/** Distratores mais parecidos com o alvo aparecem nos níveis mais altos. */
export function distractorsFor(difficulty: DifficultyLevel): StimulusColor[] {
  if (difficulty <= 3) return ['vermelho', 'verde', 'laranja']
  if (difficulty <= 6) return ['vermelho', 'verde', 'laranja', 'ciano']
  return ['vermelho', 'verde', 'laranja', 'ciano', 'roxo']
}

/**
 * Cor na tela, nome acessível e símbolo de apoio (modo "símbolos nas cores").
 * As cores dos estímulos fazem parte da regra do jogo; o símbolo é escuro porque
 * tem mais contraste que o branco em todos os círculos.
 */
export const COLORS: Record<StimulusColor, { hex: string; label: string; symbol: string; symbolColor: string }> = {
  azul: { hex: '#3b82f6', label: 'azul', symbol: '★', symbolColor: '#0f0f1a' },
  vermelho: { hex: '#ef4444', label: 'vermelho', symbol: '▲', symbolColor: '#0f0f1a' },
  verde: { hex: '#22c55e', label: 'verde', symbol: '■', symbolColor: '#0f0f1a' },
  laranja: { hex: '#f97316', label: 'laranja', symbol: '◆', symbolColor: '#0f0f1a' },
  ciano: { hex: '#06b6d4', label: 'ciano', symbol: '✚', symbolColor: '#0f0f1a' },
  roxo: { hex: '#8b5cf6', label: 'roxo', symbol: '●', symbolColor: '#0f0f1a' },
}
