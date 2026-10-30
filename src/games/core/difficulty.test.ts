import { describe, expect, it, beforeEach } from 'vitest'
import { adjustDifficulty, clampDifficulty, normalizeDifficulty, readDifficulty, writeDifficulty } from './difficulty'

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
  it('mantém a chave usada pela versão anterior do Vigia', () => {
    values.set('neurobridge:ana:vigia:difficulty', '7')
    expect(readDifficulty('ana', 'vigia')).toBe(7)
  })
  it('separa o nível de cada jogo', () => {
    writeDifficulty('ana', 8, 'vigia')
    writeDifficulty('ana', 2, 'lente')
    expect(readDifficulty('ana', 'vigia')).toBe(8)
    expect(readDifficulty('ana', 'lente')).toBe(2)
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

describe('ajuste adaptativo', () => {
  it('sobe acima de 0,70, desce abaixo de 0,40 e mantém entre os dois', () => {
    expect(adjustDifficulty(0.71, 5)).toBe(6)
    expect(adjustDifficulty(0.7, 5)).toBe(5)
    expect(adjustDifficulty(0.4, 5)).toBe(5)
    expect(adjustDifficulty(0.39, 5)).toBe(4)
  })
  it('respeita os limites 1 e 10', () => {
    expect(adjustDifficulty(1, 10)).toBe(10)
    expect(adjustDifficulty(0, 1)).toBe(1)
    expect(clampDifficulty(42)).toBe(10)
    expect(clampDifficulty(-3)).toBe(1)
  })
})
