import { describe, expect, it } from 'vitest'
import { TARGET_COUNT, TIMING, TOTAL_TRIALS, distractorsFor } from './config'
import { computeResults, describeVigia, generateStimuli, makeTrial, scoreVigia, type VigiaStimulus } from './engine'
import type { DifficultyLevel } from '../core/types'

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as DifficultyLevel[]

/** Joga uma partida simulada: `respond` decide a resposta (null = não responde). */
function play(d: DifficultyLevel, respond: (s: VigiaStimulus, i: number) => number | null) {
  return generateStimuli(d).map((s, i) => makeTrial(s, respond(s, i), d))
}

describe('geração de estímulos', () => {
  it.each(LEVELS)('nível %i: 30 estímulos, 8 alvos azuis e só distratores do nível', d => {
    const s = generateStimuli(d)
    expect(s).toHaveLength(TOTAL_TRIALS)
    expect(s.filter(x => x.isTarget)).toHaveLength(TARGET_COUNT)
    expect(s.filter(x => x.isTarget).every(x => x.color === 'azul')).toBe(true)
    expect(s.filter(x => !x.isTarget).every(x => distractorsFor(d).includes(x.color))).toBe(true)
  })
})

describe('registro da tentativa', () => {
  it('limita o tempo à janela do estímulo e arredonda', () => {
    const t = makeTrial({ color: 'azul', isTarget: true }, 1104.6, 1)
    expect(t.responseTime).toBe(TIMING[1].stimulus)
    expect(makeTrial({ color: 'azul', isTarget: true }, 312.4, 1).responseTime).toBe(312)
  })
  it('marca acerto quando responde ao alvo ou ignora distrator', () => {
    expect(makeTrial({ color: 'azul', isTarget: true }, 300, 3).isCorrect).toBe(true)
    expect(makeTrial({ color: 'verde', isTarget: false }, null, 3).isCorrect).toBe(true)
    expect(makeTrial({ color: 'verde', isTarget: false }, 300, 3).isCorrect).toBe(false)
    expect(makeTrial({ color: 'azul', isTarget: true }, null, 3)).toMatchObject({ isCorrect: false, responseTime: null })
  })
})

describe('pontuação e dificuldade adaptativa', () => {
  it.each(LEVELS.slice(0, 9))('nível %i: jogador perfeito e rápido sobe de nível', d => {
    const r = scoreVigia(play(d, s => (s.isTarget ? 250 : null)), d)
    expect(r.score).toBeGreaterThan(0.7)
    expect(r.nextDifficulty).toBe(d + 1)
  })
  it.each(LEVELS)('nível %i: jogador perfeito, mesmo no limite da janela, sobe ou fica no topo', d => {
    const r = scoreVigia(play(d, s => (s.isTarget ? TIMING[d].stimulus : null)), d)
    expect(r.score).toBeGreaterThan(0.7)
    expect(r.nextDifficulty).toBe(Math.min(10, d + 1))
  })
  it.each(LEVELS.slice(1))('nível %i: quem nunca responde desce de nível', d => {
    const r = scoreVigia(play(d, () => null), d)
    expect(r.score).toBe(0)
    expect(r.nextDifficulty).toBe(d - 1)
  })
  it.each(LEVELS.slice(1))('nível %i: quem responde a tudo desce de nível', d => {
    const r = scoreVigia(play(d, () => 300), d)
    expect(r.score).toBeLessThan(0.4)
    expect(r.nextDifficulty).toBe(d - 1)
  })
  it('nos limites, não passa de 1 nem de 10', () => {
    expect(scoreVigia(play(1, () => null), 1).nextDifficulty).toBe(1)
    expect(scoreVigia(play(10, s => (s.isTarget ? 200 : null)), 10).nextDifficulty).toBe(10)
  })
  it('com a mesma precisão, responder mais rápido nunca diminui a pontuação', () => {
    for (const d of LEVELS) {
      let previous = Infinity
      for (let rt = 100; rt <= TIMING[d].stimulus; rt += 50) {
        const score = scoreVigia(play(d, s => (s.isTarget ? rt : null)), d).score
        expect(score).toBeLessThanOrEqual(previous)
        previous = score
      }
    }
  })
  it('erros reduzem a pontuação de forma gradual', () => {
    const d = 5
    const misses = (n: number) => {
      let left = n
      return scoreVigia(play(d, s => (s.isTarget ? (left-- > 0 ? null : 400) : null)), d).score
    }
    expect(misses(0)).toBeGreaterThan(misses(1))
    expect(misses(1)).toBeGreaterThan(misses(2))
    // Perder metade dos alvos mantém o nível; perder 5 de 8 faz descer.
    expect(misses(4)).toBeGreaterThanOrEqual(0.4)
    expect(misses(5)).toBeLessThan(0.4)
  })
  it('arredonda meio milésimo para cima com conta exata (caso que divergia do banco)', () => {
    // Nível 6, 6 de 8 azuis, sem falsos alarmes: valor exato 0,6355 → 0,636.
    const rts = [650, 323, 262, 460, 650, 632]
    const trials = [
      ...rts.map(rt => makeTrial({ color: 'azul', isTarget: true }, rt, 6)),
      ...[0, 1].map(() => makeTrial({ color: 'azul', isTarget: true }, null, 6)),
      ...Array.from({ length: 22 }, () => makeTrial({ color: 'verde', isTarget: false }, null, 6)),
    ]
    expect(scoreVigia(trials, 6).score).toBe(0.636)
  })
  it('pontuação é sempre finita, entre 0 e 1, com 3 casas', () => {
    for (let k = 0; k < 300; k++) {
      const d = LEVELS[k % 10]
      const r = scoreVigia(play(d, () => (Math.random() < 0.5 ? Math.random() * 1500 : null)), d)
      expect(Number.isFinite(r.score)).toBe(true)
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(1)
      expect(Math.round(r.score * 1000)).toBe(r.score * 1000)
    }
  })
})

describe('resultados da partida', () => {
  it('conta acertos, omissões, falsos alarmes e XP coerente', () => {
    const r = computeResults(play(3, (s, i) => (s.isTarget ? 400 : i % 11 === 0 ? 300 : null)), 3)
    expect(r.hits + r.misses).toBe(TARGET_COUNT)
    expect(r.falseAlarms + r.correctRejections).toBe(TOTAL_TRIALS - TARGET_COUNT)
    expect(r.hits).toBe(8)
    expect(r.avgRT).toBe(400)
    expect(r.xpEarned).toBe(50 + Math.round(r.score.score * 100) + 2 * 5 + 15)
  })
})

describe('descrição da partida', () => {
  const build = (hits: number, rt: number, fa: number) => computeResults([
    ...Array.from({ length: 8 }, (_, i) => makeTrial({ color: 'azul', isTarget: true }, i < hits ? rt : null, 3)),
    ...Array.from({ length: 22 }, (_, i) => makeTrial({ color: 'verde', isTarget: false }, i < fa ? rt : null, 3)),
  ], 3)
  it('descreve acertos, outras cores e ritmo a partir do que aconteceu', () => {
    expect(describeVigia(build(8, 900, 0))).toBe('Você respondeu a 8 de 8 azuis e não respondeu a outras cores. Suas respostas foram perto do limite de tempo.')
    expect(describeVigia(build(6, 300, 1))).toBe('Você respondeu a 6 de 8 azuis e a 1 círculo de outra cor. Suas respostas foram rápidas para este nível.')
    expect(describeVigia(build(0, 0, 0))).toBe('Você respondeu a 0 de 8 azuis e não respondeu a outras cores.')
  })
  it('8 de 8 no limite da janela não é descrito como rápido', () => {
    expect(describeVigia(build(8, TIMING[3].stimulus, 0))).not.toMatch(/rápid/)
  })
})
