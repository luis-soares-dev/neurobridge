import { beforeEach, describe, expect, it } from 'vitest'
import { listPending, PENDING_TTL_MS, removePending, savePending, type PendingResult } from './pendingResults'

const values = new Map<string, string>()
let blocked = false
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => { if (blocked) throw new Error('cheio'); values.set(k, v) },
  removeItem: (k: string) => values.delete(k),
} })
beforeEach(() => { values.clear(); blocked = false })

const item = (sessionId: string, createdAt: number): PendingResult => ({
  gameId: 'vigia', sessionId, createdAt, summary: { difficulty: 3, score: 0.5 }, payload: { sessionId },
})

describe('partidas pendentes neste aparelho', () => {
  it('separa por conta e não duplica o mesmo ID', () => {
    savePending('ana', item('a1', 1000), 1000)
    savePending('ana', item('a1', 1000), 1000)
    savePending('bruno', item('b1', 1000), 1000)
    expect(listPending('ana', 2000).map(x => x.sessionId)).toEqual(['a1'])
    expect(listPending('bruno', 2000).map(x => x.sessionId)).toEqual(['b1'])
  })
  it('descarta pendências vencidas e remove após confirmação', () => {
    savePending('ana', item('velha', 0), 0)
    savePending('ana', item('nova', PENDING_TTL_MS), PENDING_TTL_MS)
    expect(listPending('ana', PENDING_TTL_MS + 1).map(x => x.sessionId)).toEqual(['nova'])
    removePending('ana', 'nova')
    expect(listPending('ana')).toEqual([])
  })
  it('informa quando o aparelho não permite guardar, sem quebrar', () => {
    blocked = true
    expect(savePending('ana', item('x', 1), 1)).toBe(false)
    expect(listPending('ana')).toEqual([])
  })
  it('ignora conteúdo corrompido', () => {
    values.set('neurobridge:ana:pending', '{nao é json')
    expect(listPending('ana')).toEqual([])
  })
})
