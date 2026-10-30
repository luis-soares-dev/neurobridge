import { describe, expect, it } from 'vitest'
import { calculateXP, levelFromXp, roundScore, scoreToPercent } from './score'

describe('XP e nível', () => {
  it('XP usa arredondamento exato (igual ao SQL) mesmo em valores críticos do ponto flutuante', () => {
    // 0.285 * 100 = 28.499999999999996 em ponto flutuante; o SQL arredonda para 29.
    expect(calculateXP(0.285, 1, 30)).toBe(50 + 29 + 0 + 15)
    expect(calculateXP(0, 1, 30)).toBe(65)
    expect(calculateXP(1, 10, 30)).toBe(50 + 100 + 45 + 15)
  })
  it('pontuação fica entre 0 e 1 com 3 casas', () => {
    expect(roundScore(1.7)).toBe(1)
    expect(roundScore(-1)).toBe(0)
    expect(roundScore(Number.NaN)).toBe(0)
    expect(roundScore(0.12345)).toBe(0.123)
    expect(scoreToPercent(0.805)).toBe(81)
  })
  it('nível a cada 500 XP', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpInLevel: 0, percent: 0 })
    expect(levelFromXp(499).level).toBe(1)
    expect(levelFromXp(750)).toEqual({ level: 2, xpInLevel: 250, percent: 50 })
  })
})
