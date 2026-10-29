import { describe, expect, it, beforeEach } from 'vitest'
import { normalizeDifficulty, readDifficulty, writeDifficulty } from './gameProgress'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
} })
beforeEach(() => values.clear())
describe('progresso individual', () => {
  it('não herda dificuldade de outra conta nem do cache antigo', () => {
    values.set('vigia_difficulty', '10')
    writeDifficulty('ana', 8)
    expect(readDifficulty('ana')).toBe(8)
    expect(readDifficulty('bruno')).toBe(3)
    expect(readDifficulty()).toBe(3)
  })
  it('recupera valores inválidos sem produzir NaN ou níveis impossíveis', () => {
    for (const v of ['NaN', '4x', 0, 11, 2.5, Infinity, undefined]) expect(normalizeDifficulty(v)).toBe(3)
    expect(normalizeDifficulty('10')).toBe(10)
    expect(normalizeDifficulty(1)).toBe(1)
  })
  it('continua jogável quando o armazenamento local está bloqueado', () => {
    const original = localStorage.getItem
    localStorage.getItem = () => { throw new Error('bloqueado') }
    expect(readDifficulty('ana')).toBe(3)
    localStorage.getItem = original
  })
})
